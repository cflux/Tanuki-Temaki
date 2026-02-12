import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 10 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export const rateLimiter = (options: RateLimitOptions) => {
  const { windowMs, maxRequests } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Use IP address as identifier
    const identifier = req.ip || 'unknown';
    const now = Date.now();

    if (!store[identifier] || store[identifier].resetTime < now) {
      // Initialize or reset
      store[identifier] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Increment counter
    store[identifier].count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, maxRequests - store[identifier].count)
    );
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(store[identifier].resetTime).toISOString()
    );

    // Check if limit exceeded
    if (store[identifier].count > maxRequests) {
      const retryAfter = Math.ceil((store[identifier].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      throw new AppError(
        429,
        'Too many requests, please try again later.'
      );
    }

    next();
  };
};
