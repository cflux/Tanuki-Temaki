import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Get cache statistics
 * Admin only
 */
router.get('/cache/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get basic counts
    const totalSeries = await prisma.series.count();
    const totalTags = await prisma.tag.count();
    const totalRelationships = await prisma.relationship.count();

    // Initialize empty arrays
    let byProvider: Array<{ provider: string; count: number }> = [];
    let byMediaType: Array<{ mediaType: string; count: number }> = [];

    // Only query groupBy if there are series
    if (totalSeries > 0) {
      try {
        const seriesByProvider = await prisma.series.groupBy({
          by: ['provider'],
          _count: {
            id: true,
          },
        });

        byProvider = (seriesByProvider || []).map(item => ({
          provider: item?.provider || 'Unknown',
          count: item?._count?.id || 0,
        }));

        const seriesByMediaType = await prisma.series.groupBy({
          by: ['mediaType'],
          _count: {
            id: true,
          },
        });

        byMediaType = (seriesByMediaType || []).map(item => ({
          mediaType: item?.mediaType || 'Unknown',
          count: item?._count?.id || 0,
        }));
      } catch (groupError) {
        logger.error('Error in groupBy queries', {
          error: groupError instanceof Error ? groupError.message : 'Unknown error',
        });
        // Continue with empty arrays
      }
    }

    res.json({
      totalSeries,
      totalTags,
      totalRelationships,
      byProvider,
      byMediaType,
    });
  } catch (error) {
    logger.error('Error fetching cache stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Failed to fetch cache statistics' });
  }
});

/**
 * Clear all cached data
 * Admin only - WARNING: Destructive operation
 */
router.delete('/cache/clear', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.warn('Admin clearing cache', { adminUser: req.user?.username });

    // Delete in order of dependencies
    await prisma.relationship.deleteMany({});
    await prisma.seriesTag.deleteMany({});
    await prisma.tag.deleteMany({});
    await prisma.series.deleteMany({});

    logger.info('Cache cleared successfully', { adminUser: req.user?.username });

    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Error clearing cache', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: req.user?.username
    });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
