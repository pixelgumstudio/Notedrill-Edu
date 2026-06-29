import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Job, IJob, JobType } from '../models/Job';

export async function createJob(userId: string, type: JobType): Promise<string> {
  const jobId = randomUUID();
  await Job.create({
    jobId,
    userId: new mongoose.Types.ObjectId(userId),
    type,
    status: 'processing',
  });
  return jobId;
}

export async function updateJob(
  jobId: string,
  patch: Partial<Pick<IJob, 'status' | 'result' | 'error' | 'userMessage'>>
): Promise<void> {
  await Job.findOneAndUpdate({ jobId }, { $set: patch });
}

export async function getJobForUser(jobId: string, userId: string): Promise<IJob | null> {
  return Job.findOne({
    jobId,
    userId: new mongoose.Types.ObjectId(userId),
  });
}
