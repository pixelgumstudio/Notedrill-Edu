import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User';

import type { IFreeUsage, IBonusCredits } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    userId: string;
    email: string;
    username: string;
    subscription: 'FREE' | 'PRO';
    role: 'student' | 'org_admin' | 'superadmin';
    /** Populated for org_admin and org students; absent for standard mobile users. */
    orgId?: string;
    freeUsage: IFreeUsage;
    bonusCredits: IBonusCredits;
    studyLanguage?: string | null;
    preferredLanguage?: string;
  };
  correlationId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : queryToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Please authenticate.',
      });
      return;
    }
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Please authenticate.',
      });
      return;
    }

    req.user = {
      _id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      subscription: user.subscription,
      role: user.role ?? 'student',
      orgId: user.orgId?.toString(),
      studyLanguage: user.studyLanguage,
      preferredLanguage: user.preferredLanguage,
      freeUsage: user.freeUsage ?? {
        notes:      { count: 0 },
        quizzes:    { count: 0 },
        flashcards: { count: 0 },
        chats:      { count: 0 },
      },
      bonusCredits: user.bonusCredits ?? {
        notes: 0,
        quizzes: 0,
        flashcards: 0,
        chats: 0,
      },
    };

    // Fire-and-forget — update lastActiveAt without blocking the request
    User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() }).exec().catch(() => {});

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Please authenticate.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    console.error('[auth] Authentication error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};
