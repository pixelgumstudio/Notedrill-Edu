import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  otp: string;
  type: 'signup' | 'login' | 'reset_password' | 'org_invite';
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
  /** Set for org_invite OTPs so the student endpoint can create the User in the right org. */
  orgId?: string;
}

const otpSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['signup', 'login', 'reset_password', 'org_invite'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index - auto delete when expired
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    orgId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for quick lookup
otpSchema.index({ email: 1, type: 1, verified: 1 }); // Compound index for verification queries

export const OTP = mongoose.model<IOTP>('OTP', otpSchema);
