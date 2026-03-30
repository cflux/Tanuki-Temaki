import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { corvidCacheService } from '../services/corvidCache.js';

const router: RouterType = Router();

const requestSchema = z.object({
  seriesId: z.string().uuid(),
  service: z.string().min(1),
  url: z.string().url(),
});

/**
 * GET /api/downloads/services
 * Returns list of services supported by Corvid Cache.
 * Returns empty list if Corvid Cache is unavailable.
 */
router.get('/services', async (_req, res, next) => {
  try {
    const services = await corvidCacheService.getSupportedServices();
    res.json({ services: services.map(s => s.name) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/downloads/request
 * Request a download via Corvid Cache.
 * Looks up series for title/image, then forwards to Corvid Cache.
 */
router.post('/request', requireAuth, async (req, res, next) => {
  try {
    const { seriesId, service, url } = requestSchema.parse(req.body);

    // Look up series for display info
    const series = await prisma.series.findUnique({
      where: { id: seriesId },
      select: { title: true, titleImage: true },
    });

    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    logger.info('Sending download request to Corvid Cache', {
      seriesId,
      service,
      url,
      title: series.title,
    });

    const result = await corvidCacheService.createRequest({
      url,
      service,
      title: series.title,
      image: series.titleImage ?? undefined,
    });

    res.json({ success: true, requestId: result.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    // Corvid Cache connectivity errors
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Corvid Cache request failed', { error: message });
    next(new AppError(502, `Download service unavailable: ${message}`));
  }
});

export default router;
