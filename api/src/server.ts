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
import billingRoutes from './routes/billing.routes';
import webhookRoutes from './routes/webhook.routes';
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
// CRITICAL: mounted before express.json() so the raw body bytes reach the
// gateway signature verification untouched — once express.json() parses a
// request, the original bytes needed for HMAC verification are gone.
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

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
app.use('/api/v1/org/billing', billingRoutes);

app.use(notFoundHandler);
app.use(multerErrorHandler);
app.use(errorLogger);

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI environment variable is required');
    // Bounded so an unreachable Mongo fails fast and loudly instead of hanging
    // on whatever the driver's internal default happens to be.
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log('📦 MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Starts the transcription worker and vector DB connection in the background.
 * Neither is required to serve HTTP traffic — a lecture-transcription job or a
 * semantic-search call is what actually needs them, not routes like /health —
 * so a slow or unreachable Redis/Qdrant must never delay app.listen().
 */
function startBackgroundServices(): void {
  try {
    require('./worker/transcription.worker');
    console.log('⚙️  Transcription worker started');
  } catch (error) {
    console.error('⚠️ Transcription worker failed to start, continuing without it:', error);
  }

  withTimeout(vectorDbService.waitForInitialization(), 10_000, 'Vector DB initialization')
    .catch((error) => {
      console.error('⚠️ Vector DB initialization failed or timed out, continuing without it:', error);
    });
}

const startServer = async () => {
  // Only MongoDB gates server startup — nothing else Caddy/Docker health
  // checks depend on should be able to hold the HTTP server hostage.
  await connectDB();

  const server = app.listen(parseInt(PORT as string, 10), '0.0.0.0', () => {
    console.log(`🚀 Notedrill Edu API running on http://0.0.0.0:${PORT}`);
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

  startBackgroundServices();
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
