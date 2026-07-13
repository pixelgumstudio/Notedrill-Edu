import { z } from 'zod';

export const orgRegisterSchema = z.object({
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
  adminName: z.string().min(2, 'Your name must be at least 2 characters'),
  schoolType: z.enum(['university', 'secondary', 'primary', 'tutoring_center', 'other']),
  state: z.string().min(2, 'State is required'),
  city: z.string().min(2, 'City is required'),
  examFocus: z.array(z.string()).min(1, 'At least one exam focus is required'),
  estimatedStudents: z.number().int().positive('Estimated students must be a positive number'),
  adminEmail: z.string().email('Invalid admin email format'),
  domain: z.string().optional(),
});

export const orgOtpRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  schoolId: z.string().min(1, 'School ID is required'),
});

export const orgOtpVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  schoolId: z.string().min(1, 'School ID is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const addStudentSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
});

export const recoverSchoolIdSchema = z.object({
  adminEmail: z.string().email('Invalid email format'),
});

export const resendInviteSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// ── backend.notedrill.com contract (password-based org auth, no School ID) ───
// Kept separate from orgRegisterSchema/addStudentSchema above, which the
// local api/ workspace's OTP-based controllers still validate against.

export const orgRegisterProdSchema = z.object({
  schoolName: z.string().min(2, 'Organisation name must be at least 2 characters'),
  schoolType: z.enum(['primary', 'secondary', 'tertiary', 'tutorial_center', 'other']),
  state: z.string().min(2, 'State is required'),
  city: z.string().min(2, 'City is required'),
  examFocus: z.array(z.enum(['WAEC', 'JAMB', 'NECO', 'other'])).min(1, 'At least one exam focus is required'),
  estimatedStudents: z.number().int().positive('Estimated students must be a positive number'),
  adminName: z.string().min(2, 'Your name must be at least 2 characters'),
  adminRole: z.string().min(2, 'Your role is required'),
  adminEmail: z.string().email('Invalid admin email format'),
  adminPhone: z.string().min(7, 'Phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const addOrgStudentProdSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(7, 'Phone number is required'),
});

export type OrgRegisterInput = z.infer<typeof orgRegisterSchema>;
export type OrgOtpRequestInput = z.infer<typeof orgOtpRequestSchema>;
export type OrgOtpVerifyInput = z.infer<typeof orgOtpVerifySchema>;
export type AddStudentInput = z.infer<typeof addStudentSchema>;
export type RecoverSchoolIdInput = z.infer<typeof recoverSchoolIdSchema>;
export type ResendInviteInput = z.infer<typeof resendInviteSchema>;
export type OrgRegisterProdInput = z.infer<typeof orgRegisterProdSchema>;
export type AddOrgStudentProdInput = z.infer<typeof addOrgStudentProdSchema>;
