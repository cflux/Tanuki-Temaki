import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { SeriesCacheService } from '../services/seriesCache.js';
import { RelationshipTracer } from '../services/relationshipTracer.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router: RouterType = Router();

// Request validation schemas
const fetchSeriesSchema = z.object({
  url: z.string().url('Invalid URL format'),
  forceRefresh: z.boolean().optional().default(false),
});

const traceRelationshipsSchema = z.object({
  maxDepth: z.number().int().min(1).max(5).optional().default(3),
});

const searchOneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  mediaType: z.enum(['ANIME', 'MANGA']).optional().default('ANIME'),
});

// Dependency injection - will be set in main server file
let seriesCache: SeriesCacheService;
let relationshipTracer: RelationshipTracer;

export function setDependencies(
  cache: SeriesCacheService,
  tracer: RelationshipTracer
) {
  seriesCache = cache;
  relationshipTracer = tracer;
}

/**
 * POST /api/series/fetch
 * Fetch series by URL (with caching)
 */
router.post('/fetch', async (req, res, next) => {
  try {
    const { url, forceRefresh } = fetchSeriesSchema.parse(req.body);

    logger.info('Fetching series', { url, forceRefresh });

    const series = await seriesCache.getSeries(url, forceRefresh);

    res.json(series);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    next(error);
  }
});

/**
 * GET /api/series/search
 * Search series by title (in cache)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError(400, 'Query parameter "q" is required');
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      throw new AppError(400, 'Limit must be between 1 and 50');
    }

    const results = await seriesCache.searchByTitle(q, limitNum);

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/series/search-one
 * Search for a single series by title (searches AniList and caches)
 */
router.post('/search-one', async (req, res, next) => {
  try {
    const { title, mediaType } = searchOneSchema.parse(req.body);

    logger.info('Searching for series by title', { title, mediaType });

    const series = await seriesCache.searchAndCacheByTitle(title, mediaType);

    res.json(series);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    next(error);
  }
});

/**
 * GET /api/series/stats
 * Get cache statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await seriesCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/series/clear
 * Clear all cached data (for testing)
 */
router.delete('/clear', async (req, res, next) => {
  try {
    logger.warn('Clearing all database data');

    // Delete in order due to foreign key constraints
    await prisma.tag.deleteMany();
    await prisma.relationship.deleteMany();
    await prisma.series.deleteMany();

    logger.info('Database cleared successfully');

    res.json({
      success: true,
      message: 'All cached data cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/series/:id
 * Get series by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const series = await seriesCache.getSeriesById(id);

    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    res.json(series);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/series/:id/trace-stream
 * Trace relationship graph with SSE progress updates
 */
router.get('/:id/trace-stream', async (req, res, next) => {
  try {
    const { id } = req.params;
    const maxDepth = parseInt(req.query.maxDepth as string) || 3;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    logger.info('Starting SSE trace', { seriesId: id, maxDepth });

    // Get series to get URL
    const series = await seriesCache.getSeriesById(id);
    if (!series) {
      res.write(`data: ${JSON.stringify({ error: 'Series not found' })}\n\n`);
      res.end();
      return;
    }

    // Send progress updates via SSE
    const sendProgress = (progress: any) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    try {
      // Trace relationships with progress callback
      const relationship = await relationshipTracer.traceRelationships(
        series.url,
        maxDepth,
        sendProgress
      );

      // Send final result
      res.write(`data: ${JSON.stringify({ result: relationship })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('Trace error', { error });
      res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/series/:id/trace
 * Trace relationship graph from series
 */
router.post('/:id/trace', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { maxDepth } = traceRelationshipsSchema.parse(req.body);

    logger.info('Tracing relationships', { seriesId: id, maxDepth });

    // Get series to get URL
    const series = await seriesCache.getSeriesById(id);
    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    // Trace relationships
    const relationship = await relationshipTracer.traceRelationships(
      series.url,
      maxDepth
    );

    res.json(relationship);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    next(error);
  }
});

/**
 * GET /api/series/debug-anilist/:anilistId?type=ANIME|MANGA
 * Debug endpoint to see raw AniList query and response
 */
router.get('/debug-anilist/:anilistId', async (req, res, next) => {
  try {
    const anilistId = parseInt(req.params.anilistId);
    const mediaType = (req.query.type as string)?.toUpperCase() || 'ANIME';

    if (isNaN(anilistId)) {
      throw new AppError(400, 'Invalid AniList ID');
    }

    if (!['ANIME', 'MANGA'].includes(mediaType)) {
      throw new AppError(400, 'Media type must be ANIME or MANGA');
    }

    logger.info('Debug: Fetching from AniList', { anilistId, mediaType });

    // Get the AniList adapter through seriesCache
    const anilistAdapter = (seriesCache as any).anilistMatcher.getAdapter();

    // Get the raw response based on media type
    const media = mediaType === 'MANGA'
      ? await anilistAdapter.getMangaWithRelations(anilistId)
      : await anilistAdapter.getAnimeWithRelations(anilistId);

    if (!media) {
      throw new AppError(404, `No ${mediaType.toLowerCase()} found on AniList`);
    }

    // Extract relations info
    const relations = media.relations?.edges?.map(edge => ({
      id: edge.node.id,
      title: edge.node.title.english || edge.node.title.romaji,
      type: edge.node.type,
      relationType: edge.relationType,
      format: edge.node.format,
      externalLinks: edge.node.externalLinks,
    })) || [];

    // Extract recommendations info
    const recommendations = media.recommendations?.edges?.map(edge => ({
      id: edge.node.mediaRecommendation?.id,
      title: edge.node.mediaRecommendation?.title.english || edge.node.mediaRecommendation?.title.romaji,
      type: edge.node.mediaRecommendation?.type,
      rating: edge.node.rating,
      format: edge.node.mediaRecommendation?.format,
      externalLinks: edge.node.mediaRecommendation?.externalLinks,
    })).filter(r => r.id) || [];

    // Get the processed result from getRelatedAnimeAllPlatforms
    const relatedMedia = anilistAdapter.getRelatedAnimeAllPlatforms(media);

    res.json({
      query: `
query ($id: Int) {
  Media(id: $id, type: ${mediaType}) {
    id
    type
    title { romaji english native }
    ${mediaType === 'MANGA' ? 'chapters\n    volumes\n    ' : ''}relations {
      edges {
        relationType
        node {
          id
          title { romaji english }
          type
          format
          status
          externalLinks { url site type }
        }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 20) {
      edges {
        node {
          rating
          mediaRecommendation {
            id
            title { romaji english }
            type
            format
            status
            externalLinks { url site type }
          }
        }
      }
    }
  }
}
      `.trim(),
      variables: { id: anilistId },
      rawResponse: {
        media: {
          id: media.id,
          type: media.type,
          title: media.title,
          ...(mediaType === 'MANGA' && {
            chapters: (media as any).chapters,
            volumes: (media as any).volumes
          }),
          tags: media.tags?.length || 0,
          relationsCount: relations.length,
          recommendationsCount: recommendations.length,
        },
        relations,
        recommendations,
      },
      interpretation: {
        totalRelatedMedia: relatedMedia.length,
        byType: {
          anime: relatedMedia.filter(r => r.type === 'ANIME').length,
          manga: relatedMedia.filter(r => r.type === 'MANGA').length,
        },
        relatedMedia: relatedMedia.map(r => ({
          id: r.anilistId,
          title: r.title,
          type: r.type,
          relationType: r.relationType,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
