import { Org, IOrg } from '../models/Org';
import { User } from '../models/User';
import { OTP } from '../models/OTP';
import { Types } from 'mongoose';
import { generateOTP, sendOrgInviteOTPEmail, sendOrgWelcomeEmail, sendSchoolIdRecoveryEmail } from './email.service';

interface CreateOrgInput {
  name: string;
  adminName: string;
  schoolType: IOrg['schoolType'];
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  adminEmail: string;
  domain?: string;
}

/** Uppercased alnum-only prefix from the org's first name word, e.g. "Greenwood High" -> "GREENWOOD". */
function schoolIdPrefix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] || '';
  const cleaned = firstWord.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 12) || 'SCHOOL';
}

/**
 * Generates a human-readable, unique school ID like "GREENWOOD-8392".
 * Exported so the one-off backfill migration (scripts/backfill-school-ids.ts)
 * can reuse the exact same generation/uniqueness logic for pre-existing orgs.
 */
export async function generateUniqueSchoolId(name: string): Promise<string> {
  const prefix = schoolIdPrefix(name);
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}-${suffix}`;
    const existing = await Org.findOne({ schoolId: candidate });
    if (!existing) return candidate;
  }

  throw Object.assign(new Error('Could not generate a unique school ID. Please try again.'), { status: 500 });
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
  const schoolId = await generateUniqueSchoolId(input.name);

  const org = new Org({
    ...input,
    schoolId,
    plan: 'free',
    seatLimit,
    amountDue,
    isVerified: false,
  });

  await org.save();

  // Best-effort — a flaky send here shouldn't undo an org that was already created.
  const frontendUrl = process.env.FRONTEND_URL || 'https://edu.notedrill.com';
  await sendOrgWelcomeEmail({
    adminEmail: org.adminEmail,
    adminName: org.adminName,
    orgName: org.name,
    schoolId: org.schoolId,
    loginUrl: `${frontendUrl}/org/login`,
  });

  return org;
}

/**
 * Looks up every org registered under an admin email and (if any exist)
 * emails their School IDs back. Always resolves without error and never
 * reveals whether the email matched anything, to avoid leaking which admin
 * emails have accounts.
 */
export async function recoverSchoolId(adminEmail: string): Promise<void> {
  const normalizedEmail = adminEmail.toLowerCase().trim();
  const orgs = await Org.find({ adminEmail: normalizedEmail }).lean();
  if (orgs.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL || 'https://edu.notedrill.com';
  await sendSchoolIdRecoveryEmail({
    adminEmail: normalizedEmail,
    schools: orgs.map((o) => ({ name: o.name, schoolId: o.schoolId })),
    loginUrl: `${frontendUrl}/org/login`,
  });
}

export async function getOrgById(orgId: string): Promise<IOrg | null> {
  return Org.findById(orgId);
}

export async function getOrgStudents(orgId: string) {
  return User.find({ orgId: new Types.ObjectId(orgId), role: 'student' })
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

// The invite record's own OTP code is never shown to the student (see
// sendOrgInviteOTPEmail) and gets fully replaced the moment they actually try
// to log in (sendStudentLoginOTP deletes it and issues a fresh 10-minute
// code). What this record actually needs to survive is the org-link lookup
// students rely on for their *first* login — so it gets a much longer window
// than a real OTP would, since nobody could act on it as a code even if they
// wanted to.
const INVITE_EXPIRY_DAYS = 7;

/**
 * Send an org invite to an email address for a given org.
 * Called by org_admin via POST /api/v1/org/:orgId/students/invite.
 * Returns the email and expiry so the controller can respond.
 */
export async function inviteStudentToOrg(
  orgId: string,
  email: string,
  firstName?: string,
  lastName?: string
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
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await OTP.create({
    email: email.toLowerCase().trim(),
    otp,
    type: 'org_invite',
    expiresAt,
    orgId,
    firstName: firstName?.trim() || undefined,
    lastName: lastName?.trim() || undefined,
  });

  const frontendUrl = process.env.FRONTEND_URL || 'https://edu.notedrill.com';
  const sent = await sendOrgInviteOTPEmail({
    email,
    firstName,
    schoolName: org.name,
    schoolId: org.schoolId,
    loginUrl: `${frontendUrl}/student/login`,
  });
  if (!sent) throw Object.assign(new Error('Failed to send invite email. Please try again.'), { status: 502 });

  return { email, expiresIn: INVITE_EXPIRY_DAYS * 24 * 60 * 60 };
}

function calculateAmountDue(seats: number): number {
  if (seats <= 50) return 0;
  if (seats <= 200) return seats * 2;
  return seats * 1.5;
}
