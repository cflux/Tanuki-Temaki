import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Middleware to authenticate requests using a long-lived API key.
 * Reads Authorization: Bearer <key> header.
 * Sets req.user on success (same shape as JWT auth).
 */
export const requireApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'API key required. Set Authorization: Bearer <key>' });
    return;
  }

  const rawKey = authHeader.slice(7);

  if (!rawKey.startsWith('ttk_') || rawKey.length < 12) {
    res.status(401).json({ error: 'Invalid API key format' });
    return;
  }

  // Use the key prefix to narrow the bcrypt comparison to one record
  const keyPrefix = rawKey.slice(0, 8);

  try {
    const candidates = await prisma.apiKey.findMany({
      where: { keyPrefix },
      include: { user: { select: { id: true, username: true } } },
    });

    let matched: (typeof candidates)[0] | null = null;
    for (const candidate of candidates) {
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
      const ok = await bcrypt.compare(rawKey, candidate.keyHash);
      if (ok) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      res.status(401).json({ error: 'Invalid or expired API key' });
      return;
    }

    req.user = {
      userId: matched.user.id,
      username: matched.user.username,
      isAdmin: false,
    };

    // Fire-and-forget lastUsedAt update
    prisma.apiKey.update({
      where: { id: matched.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => logger.warn('Failed to update lastUsedAt', { error: err }));

    next();
  } catch (error) {
    logger.error('API key auth error', { error });
    res.status(500).json({ error: 'Authentication error' });
  }
};
