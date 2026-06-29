import { Request, Response } from 'express';
import { OTP } from '../models/OTP';
import { User } from '../models/User';
import { generateOTP, sendOTPEmail } from '../services/email.service';
import { issueAndStoreTokens } from '../services/auth.service';
import { successResponse, errorResponse, ERROR_CODES } from '../utils/response';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// Send OTP — works for both new and existing users (unified sign-in/sign-up)
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await OTP.create({ email, otp, type: 'signup', expiresAt });

    const emailSent = await sendOTPEmail(email, otp, 'signup');

    if (!emailSent) {
      res.status(500).json(
        errorResponse('Failed to send OTP email. Please try again.', ERROR_CODES.SERVER_ERROR)
      );
      return;
    }

    res.status(200).json(
      successResponse({ email, expiresIn: OTP_EXPIRY_MINUTES * 60 }, 'OTP sent successfully')
    );
  } catch (error: any) {
    console.error('Send OTP error:', error);
    res.status(500).json(errorResponse('Failed to send OTP', ERROR_CODES.SERVER_ERROR));
  }
};

// Send OTP for signup
export const sendSignupOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json(
        errorResponse('Email already registered. Please login instead.', ERROR_CODES.CONFLICT)
      );
      return;
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, type: 'signup' });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Save OTP to database
    await OTP.create({
      email,
      otp,
      type: 'signup',
      expiresAt,
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, 'signup');

    if (!emailSent) {
      res.status(500).json(
        errorResponse('Failed to send OTP email. Please try again.', ERROR_CODES.SERVER_ERROR)
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          email,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
        'OTP sent successfully'
      )
    );
  } catch (error: any) {
    console.error('Send signup OTP error:', error);
    res.status(500).json(
      errorResponse('Failed to send OTP', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Send OTP for login
export const sendLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      res.status(404).json(
        errorResponse('No account found with this email. Please sign up first.', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email, type: 'login' });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Save OTP to database
    await OTP.create({
      email,
      otp,
      type: 'login',
      expiresAt,
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, 'login');

    if (!emailSent) {
      res.status(500).json(
        errorResponse('Failed to send OTP email. Please try again.', ERROR_CODES.SERVER_ERROR)
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          email,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
        'OTP sent successfully'
      )
    );
  } catch (error: any) {
    console.error('Send login OTP error:', error);
    res.status(500).json(
      errorResponse('Failed to send OTP', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Verify OTP and complete signup
export const verifySignupOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, name, username } = req.body;

    // Find OTP record
    const otpRecord = await OTP.findOne({
      email,
      type: 'signup',
      verified: false,
    });

    if (!otpRecord) {
      res.status(400).json(
        errorResponse('OTP not found or already used. Please request a new one.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(
        errorResponse('OTP has expired. Please request a new one.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(
        errorResponse('Too many failed attempts. Please request a new OTP.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      res.status(400).json(
        errorResponse(`Invalid OTP. ${MAX_ATTEMPTS - otpRecord.attempts} attempts remaining.`, ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // OTP is valid - check if user already exists (might have been created in a previous attempt)
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // User already exists - just log them in
      // Mark OTP as verified and delete
      await OTP.deleteOne({ _id: otpRecord._id });

      const tokens = await issueAndStoreTokens(user);

      res.status(200).json(
        successResponse(
          {
            user: {
              id: user._id,
              email: user.email,
              name: user.name,
              username: user.username,
              subscription: user.subscription,
              profilePicture: user.profilePicture,
              authProvider: user.authProvider,
              isEmailVerified: user.isEmailVerified,
              hasCompletedSignup: user.hasCompletedSignup,
              createdAt: user.createdAt,
            },
            tokens,
            isNewUser: false,
            needsProfileSetup: !user.hasCompletedSignup,
          },
          'Login successful'
        )
      );
      return;
    }

    // Create new user
    isNewUser = true;
    // Sanitize username: replace any non-alphanumeric/underscore chars with underscore
    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    const generatedUsername = username || emailPrefix + '_' + Date.now().toString(36);

    // Check if username is taken
    const existingUsername = await User.findOne({ username: generatedUsername });
    if (existingUsername) {
      res.status(400).json(
        errorResponse('Username already taken. Please choose another.', ERROR_CODES.CONFLICT)
      );
      return;
    }

    user = new User({
      email,
      name: name || email.split('@')[0],
      username: generatedUsername,
      authProvider: 'local',
      isEmailVerified: true,
      hasCompletedSignup: false,
    });

    await user.save();

    // Mark OTP as verified and delete
    await OTP.deleteOne({ _id: otpRecord._id });

    const tokens = await issueAndStoreTokens(user);

    res.status(201).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            hasCompletedSignup: user.hasCompletedSignup,
            createdAt: user.createdAt,
          },
          tokens,
          isNewUser: true,
          needsProfileSetup: true,
        },
        'Account created successfully'
      )
    );
  } catch (error: any) {
    console.error('Verify signup OTP error:', error);
    res.status(500).json(
      errorResponse('Failed to verify OTP', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Verify OTP and login
export const verifyLoginOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    // Find OTP record
    const otpRecord = await OTP.findOne({
      email,
      type: 'login',
      verified: false,
    });

    if (!otpRecord) {
      res.status(400).json(
        errorResponse('OTP not found or already used. Please request a new one.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(
        errorResponse('OTP has expired. Please request a new one.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Check attempts
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json(
        errorResponse('Too many failed attempts. Please request a new OTP.', ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      res.status(400).json(
        errorResponse(`Invalid OTP. ${MAX_ATTEMPTS - otpRecord.attempts} attempts remaining.`, ERROR_CODES.VALIDATION_ERROR)
      );
      return;
    }

    // OTP is valid - find user
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json(
        errorResponse('User not found', ERROR_CODES.NOT_FOUND)
      );
      return;
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await user.save();

    // Delete OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    const tokens = await issueAndStoreTokens(user);

    res.status(200).json(
      successResponse(
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            username: user.username,
            subscription: user.subscription,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            hasCompletedSignup: user.hasCompletedSignup,
            createdAt: user.createdAt,
          },
          tokens,
          isNewUser: false,
          needsProfileSetup: !user.hasCompletedSignup,
        },
        'Login successful'
      )
    );
  } catch (error: any) {
    console.error('Verify login OTP error:', error);
    res.status(500).json(
      errorResponse('Failed to verify OTP', ERROR_CODES.SERVER_ERROR)
    );
  }
};

// Resend OTP
export const resendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, type } = req.body;

    // Delete any existing OTP for this email and type
    await OTP.deleteMany({ email, type });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Save OTP to database
    await OTP.create({
      email,
      otp,
      type,
      expiresAt,
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, type as 'signup' | 'login');

    if (!emailSent) {
      res.status(500).json(
        errorResponse('Failed to send OTP email. Please try again.', ERROR_CODES.SERVER_ERROR)
      );
      return;
    }

    res.status(200).json(
      successResponse(
        {
          email,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
        'OTP resent successfully'
      )
    );
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    res.status(500).json(
      errorResponse('Failed to resend OTP', ERROR_CODES.SERVER_ERROR)
    );
  }
};
