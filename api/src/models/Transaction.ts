import mongoose, { Document, Schema } from 'mongoose';

export type TransactionGateway = 'paystack' | 'polar';
export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface ITransaction extends Document {
  orgId: mongoose.Types.ObjectId;
  gateway: TransactionGateway;
  gatewayReferenceId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Org',
      required: true,
      index: true,
    },
    gateway: {
      type: String,
      enum: ['paystack', 'polar'],
      required: true,
    },
    gatewayReferenceId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

TransactionSchema.index({ orgId: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
