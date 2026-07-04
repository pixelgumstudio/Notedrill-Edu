import { z } from 'zod';

export const orgRegisterSchema = z.object({
  name: z.string().min(2, 'Organisation name must be at least 2 characters'),
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
  orgId: z.string().min(1, 'Organisation ID is required'),
});

export const orgOtpVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  orgId: z.string().min(1, 'Organisation ID is required'),
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

export type OrgRegisterInput = z.infer<typeof orgRegisterSchema>;
export type OrgOtpRequestInput = z.infer<typeof orgOtpRequestSchema>;
export type OrgOtpVerifyInput = z.infer<typeof orgOtpVerifySchema>;
export type AddStudentInput = z.infer<typeof addStudentSchema>;
export type RecoverSchoolIdInput = z.infer<typeof recoverSchoolIdSchema>;
