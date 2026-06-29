import mongoose, { Document, Schema } from 'mongoose';

export interface IOrg extends Document {
  name: string;
  schoolType: 'university' | 'secondary' | 'primary' | 'tutoring_center' | 'other';
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  amountDue: number;
  seatLimit: number;
  domain?: string;
  adminEmail: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrgSchema = new Schema<IOrg>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    schoolType: {
      type: String,
      enum: ['university', 'secondary', 'primary', 'tutoring_center', 'other'],
      required: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    examFocus: {
      type: [String],
      default: [],
    },
    estimatedStudents: {
      type: Number,
      required: true,
      min: 1,
    },
    plan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free',
    },
    amountDue: {
      type: Number,
      default: 0,
    },
    seatLimit: {
      type: Number,
      default: 0,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

OrgSchema.index({ adminEmail: 1 });
OrgSchema.index({ domain: 1 }, { sparse: true });

export const Org = mongoose.model<IOrg>('Org', OrgSchema);
