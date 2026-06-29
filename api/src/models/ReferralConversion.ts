import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReferralConversion extends Document {
  partner_id: Types.ObjectId;
  partner_code: string;
  user_id: Types.ObjectId;
  revenue_cat_user_id: string;
  plan: string;
  price: number;
  currency: string;
  event_type: string;
  converted_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralConversionSchema: Schema = new Schema(
  {
    partner_id: {
      type: Schema.Types.ObjectId,
      ref: 'ReferralPartner',
      required: true,
      index: true,
    },
    partner_code: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    revenue_cat_user_id: {
      type: String,
      required: true,
      index: true,
    },
    plan: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
    },
    event_type: {
      type: String,
      required: true,
    },
    converted_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const ReferralConversion = mongoose.model<IReferralConversion>(
  'ReferralConversion',
  ReferralConversionSchema
);
