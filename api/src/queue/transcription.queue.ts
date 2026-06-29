import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Instantiate Redis client using your environment variable
const connection = new IORedis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('❌ Redis connection failed after 3 retries');
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Explicitly set family to 4 to use IPv4
  family: 4,
});

export const transcriptionQueue = new Queue('transcriptionQueue', {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const addTranscriptionJob = async (noteId: string, youtubeUrl: string) => {
  console.log(`Adding transcription job for Note ID: ${noteId}`);
  await transcriptionQueue.add('processNote', { noteId, youtubeUrl });
};