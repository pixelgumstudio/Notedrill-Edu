import { Org, IOrg } from '../models/Org';
import { User } from '../models/User';
import { OTP } from '../models/OTP';
import { Types } from 'mongoose';
import { generateOTP, sendOTPEmail } from './email.service';

interface CreateOrgInput {
  name: string;
  schoolType: IOrg['schoolType'];
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  adminEmail: string;
  domain?: string;
}

export async function createOrg(input: CreateOrgInput): Promise<IOrg> {
  if (input.domain) {
    const existing = await Org.findOne({ domain: input.domain.toLowerCase() });
    if (existing) {
      throw Object.assign(new Error('An organisation with this domain already exists.'), { status: 409 });
    }
  }

  const seatLimit = input.estimatedStudents;
  const amountDue = calculateAmountDue(seatLimit);

  const org = new Org({
    ...input,
    plan: 'free',
    seatLimit,
    amountDue,
    isVerified: false,
  });

  await org.save();
  return org;
}

export async function getOrgById(orgId: string): Promise<IOrg | null> {
  return Org.findById(orgId);
}

export async function getOrgStudents(orgId: string) {
  return User.find({ orgId: new Types.ObjectId(orgId), role: { $in: ['student', 'org_admin'] } })
    .select('-password -refreshTokenHashes -deviceTokens')
    .lean();
}

export async function getOrgSeatUsage(orgId: string): Promise<{ used: number; limit: number }> {
  const org = await Org.findById(orgId).lean();
  if (!org) throw Object.assign(new Error('Organisation not found.'), { status: 404 });

  const used = await User.countDocuments({ orgId: new Types.ObjectId(orgId) });
  return { used, limit: org.seatLimit };
}

export async function removeStudentFromOrg(orgId: string, userId: string): Promise<void> {
  await User.findOneAndUpdate(
    { _id: userId, orgId: new Types.ObjectId(orgId) },
    { $unset: { orgId: 1 }, role: 'student' }
  );
}

const OTP_EXPIRY_MINUTES = 10;

/**
 * Send an OTP invite to an email address for a given org.
 * Called by org_admin via POST /api/v1/org/:orgId/students/invite.
 * Returns the email and expiry so the controller can respond.
 */
export async function inviteStudentToOrg(
  orgId: string,
  email: string
): Promise<{ email: string; expiresIn: number }> {
  const org = await Org.findById(orgId);
  if (!org) throw Object.assign(new Error('Organisation not found.'), { status: 404 });

  const usedSeats = await User.countDocuments({ orgId: new Types.ObjectId(orgId) });
  if (org.seatLimit > 0 && usedSeats >= org.seatLimit) {
    throw Object.assign(new Error('Seat limit reached. Remove a student before inviting more.'), { status: 403 });
  }

  // Replace any existing pending invite for this email+org combination
  await OTP.deleteMany({ email: email.toLowerCase().trim(), type: 'org_invite' });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await OTP.create({ email: email.toLowerCase().trim(), otp, type: 'org_invite', expiresAt, orgId });

  const sent = await sendOTPEmail(email, otp, 'signup');
  if (!sent) throw Object.assign(new Error('Failed to send invite email. Please try again.'), { status: 502 });

  return { email, expiresIn: OTP_EXPIRY_MINUTES * 60 };
}

function calculateAmountDue(seats: number): number {
  if (seats <= 50) return 0;
  if (seats <= 200) return seats * 2;
  return seats * 1.5;
}
