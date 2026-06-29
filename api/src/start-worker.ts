// Worker Entry Point
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { transcriptionWorker } from './worker/transcription.worker';

// Load environment variables - explicitly from apps/api/.env
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('🚀 Starting Transcription Worker...');

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI as string;
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('📦 MongoDB connected for worker');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Handle worker events
transcriptionWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

transcriptionWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

transcriptionWorker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

console.log('✅ Transcription worker is running and listening for jobs...');

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down worker gracefully...');
  await transcriptionWorker.close();
  await mongoose.disconnect();
  process.exit(0);
});
