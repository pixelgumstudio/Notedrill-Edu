import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { errorResponse, ERROR_CODES } from '../utils/response';

type Role = 'student' | 'org_admin' | 'superadmin';

export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('Authentication required.', ERROR_CODES.UNAUTHORIZED));
      return;
    }

    const userRole: Role = req.user.role ?? 'student';

    if (!roles.includes(userRole)) {
      res.status(403).json(
        errorResponse(
          `Access denied. Required role: ${roles.join(' or ')}.`,
          ERROR_CODES.FORBIDDEN
        )
      );
      return;
    }

    next();
  };
};
