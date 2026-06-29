import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from './config/env';
validateEnv();

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { globalLimiter, authLimiter, aiGenerationLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import otpRoutes from './routes/otp.routes';
import noteRoutes from './routes/note.routes';
import uploadRoutes from './routes/upload.routes';
import flashcardRoutes from './routes/flashcard.routes';
import quizRoutes from './routes/quiz.routes';
import orgRoutes from './routes/org.routes';
import vectorDbService from './services/vectorDb.service';
import {
  requestLogger,
  errorLogger,
  notFoundHandler,
  multerErrorHandler,
} from './middleware/errorLogger';

const app: Application = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 8081;

app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3002',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((req: any, res, next) => {
  req.correlationId = req.get('X-Correlation-ID') || uuidv4();
  res.set('X-Correlation-ID', req.correlationId);
  next();
});

app.use(requestLogger);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development', service: 'Notedrill Edu API' });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Notedrill Edu API', version: '1.0.0' });
});

app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({ message: 'Notedrill Edu API v1', version: '1.0.0' });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

app.use('/api/v1', globalLimiter);

app.post('/api/v1/auth/login', authLimiter);
app.post('/api/v1/auth/register', authLimiter);
app.post('/api/v1/otp/send', authLimiter);
app.post('/api/v1/otp/send/signup', authLimiter);
app.post('/api/v1/otp/send/login', authLimiter);
app.post('/api/v1/otp/verify/signup', authLimiter);
app.post('/api/v1/otp/verify/login', authLimiter);
app.post('/api/v1/otp/resend', authLimiter);

app.post('/api/v1/notes/generate', aiGenerationLimiter);
app.put('/api/v1/notes/:noteId/enhance', aiGenerationLimiter);
app.put('/api/v1/notes/:noteId/translate', aiGenerationLimiter);
app.put('/api/v1/notes/:noteId/retranscribe', aiGenerationLimiter);
app.post('/api/v1/flashcards/generate', aiGenerationLimiter);
app.post('/api/v1/flashcards', aiGenerationLimiter);
app.post('/api/v1/quizzes/generate', aiGenerationLimiter);
app.post('/api/v1/quizzes', aiGenerationLimiter);
app.post('/api/v1/upload/image-ocr', aiGenerationLimiter);
app.post('/api/v1/upload/audio-transcribe', aiGenerationLimiter);
app.post('/api/v1/upload/pdf-extract', aiGenerationLimiter);

// ── Route mounts ──────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/otp', otpRoutes);
app.use('/api/v1/notes', noteRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/flashcards', flashcardRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/org', orgRoutes);

app.use(notFoundHandler);
app.use(multerErrorHandler);
app.use(errorLogger);

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI environment variable is required');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();

  require('./worker/transcription.worker');
  console.log('⚙️  Transcription worker started');

  try {
    await vectorDbService.waitForInitialization();
  } catch (error) {
    console.error('⚠️ Vector DB initialization failed, continuing without it:', error);
  }

  const server = app.listen(parseInt(PORT as string, 10), '0.0.0.0', () => {
    console.log(`🚀 Notedrill Edu API running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Health check: http://localhost:${PORT}/health`);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️ Shutting down gracefully...');
    process.exit(0);
  });
}

export { app, startServer };
