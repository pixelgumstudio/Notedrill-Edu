import { Request, Response, NextFunction } from 'express';

export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['x-admin-key'];

  if (!process.env.ADMIN_API_KEY) {
    res.status(500).json({ success: false, message: 'Admin key not configured.' });
    return;
  }

  if (!key || key !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  next();
};
