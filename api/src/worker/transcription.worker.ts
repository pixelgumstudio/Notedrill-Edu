import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processYouTubeNote } from '../services/transcription.service';

// Get Redis URL from environment variables
const redisUrl = process.env.REDIS_URL as string;

// Initialize the Redis connection client for BullMQ.
// NOTE: IORedis is typically the preferred client for BullMQ.
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('❌ Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  family: 4,
});

// Log connection status for debugging
connection.on('connect', () => console.log('✅ Redis connection established for Worker.'));
connection.on('error', (err) => console.error('❌ Redis connection error for Worker:', err.message));
connection.on('ready', () => console.log('✅ Redis client ready for Worker.'));


export const transcriptionWorker = new Worker('transcriptionQueue', async (job) => {
  const { noteId, youtubeUrl } = job.data;
  console.log(`🔥 Worker starting transcription job for Note ID: ${noteId} from URL: ${youtubeUrl}`);

  await processYouTubeNote(noteId, youtubeUrl);

}, {
  connection: connection as any,
  concurrency: 2 // concurrency: limit simultaneous expensive jobs
});