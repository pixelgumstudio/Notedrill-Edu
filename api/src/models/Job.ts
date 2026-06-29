import mongoose, { Document, Schema } from 'mongoose';

export type JobType = 'note_generation' | 'chat_message';
export type JobStatus = 'processing' | 'completed' | 'failed';

export interface IJob extends Document {
  jobId: string;
  userId: mongoose.Types.ObjectId;
  type: JobType;
  status: JobStatus;
  result?: any;
  error?: string;
  userMessage?: string;
  createdAt: Date;
}

const JobSchema = new Schema<IJob>({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['note_generation', 'chat_message'],
    required: true,
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
  result: {
    type: Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
  },
  userMessage: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 1800, // TTL: MongoDB deletes documents 30 minutes after createdAt
  },
});

export const Job = mongoose.model<IJob>('Job', JobSchema);
