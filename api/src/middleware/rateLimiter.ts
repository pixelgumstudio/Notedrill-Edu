import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

const isTest = () => process.env.NODE_ENV === 'test';

// ── IP extractor ──────────────────────────────────────────────────────────────
// Nginx may forward a comma-separated list (client, proxy1, proxy2…). We want
// only the leftmost entry — the real client IP.
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}

// ── Hybrid key ────────────────────────────────────────────────────────────────
// Returns 'user:<userId>' for any authenticated request (prevents shared Wi-Fi
// from pooling users into a single bucket), falls back to 'ip:<address>' for
// unauthenticated guests.
// Checks req.user first (set by the authenticate middleware for routes that run
// it upstream), then decodes the JWT header directly for routes where the
// rate limiter fires before authenticate.
function hybridKey(req: Request): string {
  // Fast path: authenticate middleware already ran
  const authedReq = req as any;
  if (authedReq.user?.userId) {
    return `user:${authedReq.user.userId}`;
  }

  // Slow path: decode the JWT from the Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      if (decoded.userId) return `user:${decoded.userId}`;
    } catch {
      // expired or tampered — fall through to IP
    }
  }

  return `ip:${clientIp(req)}`;
}

// ── No-op middleware for tests ────────────────────────────────────────────────
// In test mode, bypass all rate limiting
const noOp = (_req: Request, _res: Response, next: NextFunction): void => next();

// ── Global limiter ────────────────────────────────────────────────────────────
// Applied app-wide as a catch-all floor. 500 req / 15 min is comfortable for a
// mobile app that fires several parallel requests at launch. Keyed per user so
// one busy account on shared Wi-Fi can't exhaust the bucket for everyone else.
const _globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: hybridKey,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'GLOBAL_RATE_LIMITED',
  },
});

export const globalLimiter = isTest() ? noOp : _globalLimiter;

// ── Auth limiter ──────────────────────────────────────────────────────────────
// Covers credential submission only: login, register, OTP send/verify, and any
// future password-reset routes. Intentionally IP-keyed so an attacker can't
// bypass it by cycling user accounts. 5 attempts / 15 min per IP.
let _authLimiter: any;

function getAuthLimiter() {
  if (isTest()) {
    return noOp;
  }

  if (!_authLimiter) {
    _authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: clientIp,
      message: {
        success: false,
        message: 'Too many login attempts. Try again later.',
        code: 'AUTH_RATE_LIMITED',
      },
    });
  }

  return _authLimiter;
}

export const authLimiter = (req: Request, res: Response, next: NextFunction) => {
  return getAuthLimiter()(req, res, next);
};

// ── AI generation limiters ────────────────────────────────────────────────────
// Two tiers: free (10 req / 15 min) and Pro (50 req / 15 min). Both keyed by
// userId when authenticated so shared networks don't pool users into one bucket.
// The exported aiGenerationLimiter middleware peeks at the JWT and routes to
// the appropriate tier — no DB lookup required.

const _aiGenerationLimiterFree = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: hybridKey,
  message: {
    success: false,
    message: 'AI generation limit reached. Please wait before trying again.',
    code: 'AI_GENERATION_RATE_LIMITED',
  },
});

const _aiGenerationLimiterPro = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: hybridKey,
  message: {
    success: false,
    message: 'You are generating too fast. Please wait a moment before trying again.',
    code: 'AI_GENERATION_RATE_LIMITED',
  },
});

// Smart wrapper: routes to the Pro limiter when the JWT carries subscription=PRO,
// falls back to the free limiter for unauthenticated or free-tier requests.
export const aiGenerationLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (isTest()) { next(); return; }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      if (decoded.subscription === 'PRO') {
        _aiGenerationLimiterPro(req, res, next);
        return;
      }
    } catch {
      // invalid or expired token — apply free limits
    }
  }
  _aiGenerationLimiterFree(req, res, next);
};
