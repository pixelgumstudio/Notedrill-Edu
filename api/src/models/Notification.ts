import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  jobId: string;
  type: 'job_completed' | 'job_failed' | 'other';
  jobType?: 'note' | 'chat' | 'quiz' | 'flashcard' | 'youtube';
  status?: string; // 'completed' or 'failed'
  title: string;
  body: string;
  data?: Record<string, any>;
  deliveryStatus: 'pending' | 'sent' | 'failed';
  deliveryError?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['job_completed', 'job_failed', 'other'],
      default: 'job_completed',
    },
    jobType: {
      type: String,
      enum: ['note', 'chat', 'quiz', 'flashcard', 'youtube'],
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    deliveryError: String,
    sentAt: Date,
  },
  {
    timestamps: true,
  }
);

// Auto-delete notifications after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
