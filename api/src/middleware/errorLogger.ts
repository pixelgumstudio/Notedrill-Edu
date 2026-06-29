import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Request logging middleware
 * Logs all incoming requests with correlation ID
 */
export const requestLogger = (req: AuthRequest, res: Response, next: NextFunction) => {
  const correlationId = req.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = correlationId;

  const startTime = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('user-agent') || 'unknown';
  const userId = req.user?._id || 'anonymous';

  console.log(`[${correlationId}] 📥 ${method} ${originalUrl} - User: ${userId} - IP: ${ip}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    const logLevel = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';

    console.log(
      `[${correlationId}] ${logLevel} ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
    );
  });

  next();
};

/**
 * Error details interface
 */
interface ErrorDetails {
  correlationId?: string;
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  message: string;
  stack?: string;
  userId?: string;
  ip: string;
  userAgent: string;
  body?: any;
  query?: any;
  params?: any;
}

/**
 * Comprehensive error logging and handling middleware
 * This should be the last middleware in the chain
 */
export const errorLogger = (
  err: any,
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const correlationId = req.correlationId || 'unknown';
  const statusCode = err.statusCode || err.status || 500;
  const timestamp = new Date().toISOString();

  // Build error details
  const errorDetails: ErrorDetails = {
    correlationId,
    timestamp,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?._id,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };

  // Add request details for 500 errors to help debugging
  if (statusCode >= 500) {
    errorDetails.body = sanitizeBody(req.body);
    errorDetails.query = req.query;
    errorDetails.params = req.params;
  }

  // Log based on severity
  if (statusCode >= 500) {
    console.error(`[${correlationId}] ❌ SERVER ERROR:`, JSON.stringify(errorDetails, null, 2));
  } else if (statusCode >= 400) {
    console.warn(`[${correlationId}] ⚠️ CLIENT ERROR:`, JSON.stringify(errorDetails, null, 2));
  }

  // Send error response
  const responseBody: any = {
    success: false,
    message: errorDetails.message,
    correlationId,
    timestamp,
  };

  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development' && err.stack) {
    responseBody.stack = err.stack;
  }

  // Add validation errors if present (Zod errors)
  if (err.name === 'ZodError' && err.issues) {
    responseBody.validationErrors = err.issues;
  }

  res.status(statusCode).json(responseBody);
};

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body: any): any {
  if (!body) return body;

  const sanitized = { ...body };
  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Not Found (404) handler
 * This should be added before the error logger
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error: any = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Async handler wrapper to catch promise rejections
 * Wraps async route handlers to automatically catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler for multer file upload errors
 */
export const multerErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.name === 'MulterError') {
    const errorMessages: { [key: string]: string } = {
      LIMIT_FILE_SIZE: 'File size exceeds the maximum allowed limit',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field in file upload',
      LIMIT_PART_COUNT: 'Too many parts in multipart upload',
    };

    const message = errorMessages[err.code] || 'File upload error';

    return res.status(400).json({
      success: false,
      message,
      error: err.message,
    });
  }

  next(err);
};
