import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { ADMIN_USERNAMES } from '../config/constants';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        isAdmin: boolean;
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
    isAdmin: ADMIN_USERNAMES.has(payload.username.toUpperCase()),
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
        isAdmin: ADMIN_USERNAMES.has(payload.username.toUpperCase()),
      };
    }
  }

  next();
};

/**
 * Middleware to require admin privileges
 * Returns 403 if user is not an admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }

  next();
};
