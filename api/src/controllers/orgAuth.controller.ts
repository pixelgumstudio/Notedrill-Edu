import { Request, Response } from 'express';
import { OTP } from '../models/OTP';
import { User } from '../models/User';
import { Org } from '../models/Org';
import { generateOTP, sendOTPEmail } from '../services/email.service';
import { issueAndStoreTokens } from '../services/auth.service';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';
import { orgOtpRequestSchema, orgOtpVerifySchema } from '@notedrill/validation';
import { Types } from 'mongoose';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export const sendOrgInviteOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = orgOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const { email, orgId } = parsed.data;

    const org = await Org.findById(orgId);
    if (!org) {
      res.status(404).json(errorResponse('Organisation not found.', ERROR_CODES.NOT_FOUND));
      return;
    }

    const usedSeats = await User.countDocuments({ orgId: new Types.ObjectId(orgId) });
    if (org.seatLimit > 0 && usedSeats >= org.seatLimit) {
      res.status(403).json(errorResponse('Organisation seat limit reached.', ERROR_CODES.FORBIDDEN));
      return;
    }

    await OTP.deleteMany({ email, type: 'org_invite' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OTP.create({ email, otp, type: 'org_invite', expiresAt });

    const emailSent = await sendOTPEmail(email, otp, 'signup');
    if (!emailSent) {
      res.status(500).json(errorResponse('Failed to send invite OTP.', ERROR_CODES.SERVER_ERROR));
      return;
    }

    res.status(200).json(
      successResponse({ email, orgId, expiresIn: OTP_EXPIRY_MINUTES * 60 }, 'Invite OTP sent successfully.')
    );
  } catch (err: any) {
    console.error('[orgAuth] sendOrgInviteOTP error:', err.message);
    res.status(500).json(errorResponse('Failed to send invite OTP.', ERROR_CODES.SERVER_ERROR));
  }
};

// ── Student login (no orgId needed from client) ───────────────────────────────

export const sendStudentLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json(errorResponse('Email is required.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Get orgId from existing User (returning student) or pending invite OTP (new student)
    let orgId: string | undefined;
    const user = await User.findOne({ email: normalizedEmail });
    if (user?.orgId) {
      orgId = user.orgId.toString();
    } else {
      const pending = await OTP.findOne({ email: normalizedEmail, type: 'org_invite', verified: false });
      if (pending?.orgId) orgId = pending.orgId;
    }

    if (!orgId) {
      // Silent 200 — don't reveal whether the email is registered
      res.status(200).json(successResponse(
        { email: normalizedEmail, expiresIn: OTP_EXPIRY_MINUTES * 60 },
        'If this email is registered, a sign-in code has been sent.',
      ));
      return;
    }

    await OTP.deleteMany({ email: normalizedEmail, type: 'org_invite' });
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await OTP.create({ email: normalizedEmail, otp, type: 'org_invite', expiresAt, orgId });

    const emailSent = await sendOTPEmail(normalizedEmail, otp, 'signup');
    if (!emailSent) {
      res.status(500).json(errorResponse('Failed to send sign-in code.', ERROR_CODES.SERVER_ERROR));
      return;
    }

    res.status(200).json(successResponse(
      { email: normalizedEmail, expiresIn: OTP_EXPIRY_MINUTES * 60 },
      'Sign-in code sent successfully.',
    ));
  } catch (err: any) {
    console.error('[orgAuth] sendStudentLoginOTP error:', err.message);
    res.status(500).json(errorResponse('Failed to send sign-in code.', ERROR_CODES.SERVER_ERROR));
  }
};

export const verifyStudentLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json(errorResponse('Email and code are required.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await OTP.findOne({ email: normalizedEmail, type: 'org_invite', verified: false });
    if (!otpRecord) {
      res.status(400).json(errorResponse('No pending sign-in code found. Please request a new one.', ERROR_CODES.NOT_FOUND));
      return;
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(429).json(errorResponse('Too many attempts. Please request a new code.', ERROR_CODES.RATE_LIMITED));
      return;
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(errorResponse('Code has expired. Please request a new one.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    if (otpRecord.otp !== otp) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      res.status(400).json(errorResponse('Invalid code.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    await OTP.updateOne({ _id: otpRecord._id }, { verified: true });

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // First-time student: create account using the orgId stored on the invite OTP
      if (!otpRecord.orgId) {
        res.status(400).json(errorResponse('No organisation associated with this invite. Ask your admin to re-send the invite.', ERROR_CODES.VALIDATION_ERROR));
        return;
      }
      const username = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.random().toString(36).slice(2, 6);
      const invitedName = [otpRecord.firstName, otpRecord.lastName].filter(Boolean).join(' ').trim();
      user = new User({
        email: normalizedEmail,
        name: invitedName || username,
        username,
        orgId: new Types.ObjectId(otpRecord.orgId),
        role: 'student',
        authMethod: 'org_otp',
        authProvider: 'local',
        isEmailVerified: true,
        hasCompletedSignup: false,
      });
      await user.save();
    }

    const tokens = await issueAndStoreTokens(user);

    res.status(200).json(successResponse(
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          orgId: user.orgId?.toString(),
          role: user.role,
        },
        tokens,
      },
      'Sign-in successful.',
    ));
  } catch (err: any) {
    console.error('[orgAuth] verifyStudentLoginOTP error:', err.message);
    res.status(500).json(errorResponse('Sign-in verification failed.', ERROR_CODES.SERVER_ERROR));
  }
};

export const verifyOrgInviteOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = orgOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse(parsed.error.errors[0].message, ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    const { email, orgId, otp } = parsed.data;

    const otpRecord = await OTP.findOne({ email, type: 'org_invite', verified: false });
    if (!otpRecord) {
      res.status(400).json(errorResponse('No pending invite OTP found for this email.', ERROR_CODES.NOT_FOUND));
      return;
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(429).json(errorResponse('Too many attempts. Please request a new OTP.', ERROR_CODES.RATE_LIMITED));
      return;
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(errorResponse('OTP has expired. Please request a new one.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    if (otpRecord.otp !== otp) {
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      res.status(400).json(errorResponse('Invalid OTP.', ERROR_CODES.VALIDATION_ERROR));
      return;
    }

    await OTP.updateOne({ _id: otpRecord._id }, { verified: true });

    // Determine role: the email that registered the org is the admin; everyone else is a student.
    const org = await Org.findById(orgId);
    if (!org) {
      res.status(404).json(errorResponse('Organisation not found.', ERROR_CODES.NOT_FOUND));
      return;
    }
    const assignedRole: 'org_admin' | 'student' =
      org.adminEmail.toLowerCase() === email.toLowerCase() ? 'org_admin' : 'student';

    let user = await User.findOne({ email });
    if (!user) {
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + '_' + Math.random().toString(36).slice(2, 6);
      user = new User({
        email,
        name: username,
        username,
        orgId: new Types.ObjectId(orgId),
        role: assignedRole,
        authMethod: 'org_otp',
        authProvider: 'local',
        isEmailVerified: true,
        hasCompletedSignup: false,
      });
      await user.save();
    } else {
      await User.updateOne(
        { _id: user._id },
        { orgId: new Types.ObjectId(orgId), role: assignedRole, authMethod: 'org_otp' }
      );
      // Sync the in-memory object so issueAndStoreTokens reads the updated role
      user.role = assignedRole;
    }

    const tokens = await issueAndStoreTokens(user);

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            orgId,
            role: user.role,
          },
          tokens,
        },
        'Organisation login successful.'
      )
    );
  } catch (err: any) {
    console.error('[orgAuth] verifyOrgInviteOTP error:', err.message);
    res.status(500).json(errorResponse('OTP verification failed.', ERROR_CODES.SERVER_ERROR));
  }
};
