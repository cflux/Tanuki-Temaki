import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware to require authentication
 * Returns 401 if no valid token is present
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = AuthService.verifyToken(accessToken);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = {
    userId: payload.userId,
    username: payload.username,
  };

  next();
};

/**
 * Middleware to optionally include user if authenticated
 * Does not return error if no token is present
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const accessToken = req.cookies.access_token;

  if (accessToken) {
    const payload = AuthService.verifyToken(accessToken);

    if (payload) {
      req.user = {
        userId: payload.userId,
        username: payload.username,
      };
    }
  }

  next();
};
