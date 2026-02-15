import { Router } from 'express';
import { TagSearchService } from '../services/tagSearch';
import { optionalAuth } from '../middleware/auth';
import type { Series } from '@tanuki-temaki/shared';

const router = Router();

/**
 * Search for tags by name
 * GET /api/tags/search?q=action&limit=20
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    const tags = await TagSearchService.searchTags(q, limitNum);

    res.json(tags);
  } catch (error) {
    next(error);
  }
});

/**
 * Get all tags
 * GET /api/tags
 */
router.get('/', async (req, res, next) => {
  try {
    const tags = await TagSearchService.getAllTags();
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

/**
 * Get top-rated series for a specific tag
 * GET /api/tags/:tagValue/series?mediaType=ANIME&limit=20
 */
router.get('/:tagValue/series', async (req, res, next) => {
  try {
    const { tagValue } = req.params;
    const { mediaType, limit } = req.query;

    const mediaTypeValue = (mediaType as 'ANIME' | 'MANGA' | 'all') || 'all';
    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    const series = await TagSearchService.getTopSeriesForTag(
      tagValue,
      mediaTypeValue,
      limitNum
    );

    res.json(series);
  } catch (error) {
    next(error);
  }
});

/**
 * Get series count for a tag
 * GET /api/tags/:tagValue/count
 */
router.get('/:tagValue/count', async (req, res, next) => {
  try {
    const { tagValue } = req.params;
    const count = await TagSearchService.getSeriesCountForTag(tagValue);
    res.json({ tag: tagValue, count });
  } catch (error) {
    next(error);
  }
});

export default router;
