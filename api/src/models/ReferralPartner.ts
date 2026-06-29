import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReferralPartner extends Document {
  code: string;
  name: string;
  description?: string;
  total_paid_conversions: number;
  total_revenue: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralPartnerSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    total_paid_conversions: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_revenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const ReferralPartner = mongoose.model<IReferralPartner>(
  'ReferralPartner',
  ReferralPartnerSchema
);
