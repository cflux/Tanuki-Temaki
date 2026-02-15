import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { SeriesCacheService } from '../services/seriesCache.js';
import { RelationshipTracer } from '../services/relationshipTracer.js';
import { UserService } from '../services/user.js';
import { optionalAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

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
  filterAdult: z.boolean().optional(), // When true, sets isAdult: false to exclude adult content
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
    const { title, mediaType, filterAdult } = searchOneSchema.parse(req.body);

    logger.info('Searching for series by title', { title, mediaType, filterAdult });

    const series = await seriesCache.searchAndCacheByTitle(title, mediaType, filterAdult);

    res.json(series);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    next(error);
  }
});

/**
 * POST /api/series/search-many
 * Search for series and return multiple results for user selection
 */
router.post('/search-many', async (req, res, next) => {
  try {
    const { title, mediaType, limit = 10, filterAdult } = searchOneSchema.extend({
      limit: z.number().min(1).max(20).optional(),
    }).parse(req.body);

    logger.info('Searching for multiple series', { title, mediaType, limit, filterAdult });

    const results = await seriesCache.searchMultipleResults(title, mediaType, limit, filterAdult);

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new AppError(400, error.errors[0].message));
    }
    next(error);
  }
});

/**
 * POST /api/series/fetch-by-anilist-id
 * Fetch a series by its AniList ID
 */
router.post('/fetch-by-anilist-id', async (req, res, next) => {
  try {
    const { anilistId, mediaType } = z.object({
      anilistId: z.number(),
      mediaType: z.enum(['ANIME', 'MANGA']),
    }).parse(req.body);

    logger.info('Fetching series by AniList ID', { anilistId, mediaType });

    const series = await seriesCache.fetchByAniListId(anilistId, mediaType);

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
 * GET /api/series/services
 * Get all unique streaming/reading platforms from cached series
 */
router.get('/services', async (req, res, next) => {
  try {
    // Normalize service names to canonical versions
    const normalizeServiceName = (name: string): string => {
      const lower = name.toLowerCase();

      // Amazon variations
      if (lower.includes('amazon') || lower === 'prime video') {
        return 'Amazon Prime Video';
      }
      // Crunchyroll variations
      if (lower.includes('crunchyroll') && !lower.includes('manga')) {
        return 'Crunchyroll';
      }
      if (lower.includes('crunchyroll') && lower.includes('manga')) {
        return 'Crunchyroll Manga';
      }
      // HBO variations
      if (lower.includes('hbo')) {
        return 'HBO Max';
      }
      // Return original if no normalization needed
      return name;
    };

    // Predefined list of common anime/manga services
    const commonServices = [
      // Anime Streaming
      'Crunchyroll',
      'Funimation',
      'HIDIVE',
      'Netflix',
      'Hulu',
      'Amazon Prime Video',
      'Disney+',
      'HBO Max',
      'VRV',
      'AnimeLab',
      'Wakanim',
      'bilibili',
      // Manga Reading
      'Manga Plus by SHUEISHA',
      'VIZ Media',
      'Crunchyroll Manga',
      'ComiXology',
      'Kindle',
      'BookWalker',
      'Kodansha Comics',
      'Seven Seas Entertainment',
      'Yen Press',
      'INKR',
      'Azuki Manga',
      'Manga Planet',
      'K MANGA',
    ];

    const servicesSet = new Set<string>(commonServices);

    const series = await prisma.series.findMany({
      select: {
        metadata: true,
      },
    });

    // Add services discovered from series metadata (normalized)
    series.forEach(s => {
      const metadata = s.metadata as any;

      // Add streaming links (platforms from AniList)
      if (metadata?.streamingLinks && typeof metadata.streamingLinks === 'object') {
        Object.keys(metadata.streamingLinks).forEach((platform: string) => {
          const normalized = normalizeServiceName(platform);
          servicesSet.add(normalized);
        });
      }

      // Add provider as fallback
      if (metadata?.provider) {
        const normalized = normalizeServiceName(metadata.provider);
        servicesSet.add(normalized);
      }
    });

    const services = Array.from(servicesSet).sort();

    res.json(services);
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
 * Get series by ID (with optional user data if authenticated)
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const series = await seriesCache.getSeriesById(id);

    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    // If user is authenticated, include their rating, note, and tag votes
    if (req.user) {
      const [rating, note, tagVotes] = await Promise.all([
        UserService.getUserRating(req.user.userId, id),
        UserService.getNote(req.user.userId, id),
        UserService.getSeriesTagVotes(req.user.userId, id),
      ]);

      // Convert tag votes to a map for easier frontend consumption
      const tagVotesMap: Record<string, number> = {};
      tagVotes.forEach(vote => {
        tagVotesMap[vote.tagValue] = vote.vote;
      });

      res.json({
        ...series,
        userRating: rating?.rating ?? null,
        userNote: note?.note ?? null,
        userTagVotes: tagVotesMap,
      });
    } else {
      res.json(series);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/series/:id/trace-stream
 * Trace relationship graph with SSE progress updates
 */
router.get('/:id/trace-stream', optionalAuth, async (req, res, next) => {
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

      // If user is authenticated, add user ratings/notes/votes to all series
      if (req.user) {
        const seriesIds = relationship.nodes.map(n => n.series.id);

        // Fetch all user data for these series in parallel
        const [ratingsMap, notesMap, votesMap] = await Promise.all([
          UserService.getRatingsMap(req.user.userId, seriesIds),
          Promise.all(seriesIds.map(async (sid) => {
            const note = await UserService.getNote(req.user!.userId, sid);
            return [sid, note?.note ?? null] as [string, string | null];
          })).then(pairs => new Map(pairs)),
          UserService.getTagVotesMap(req.user.userId, seriesIds),
        ]);

        // Attach user data to each series
        relationship.nodes.forEach(node => {
          const sid = node.series.id;
          (node.series as any).userRating = ratingsMap.get(sid) ?? null;
          (node.series as any).userNote = notesMap.get(sid) ?? null;

          // Convert tag votes to map
          const tagVotes = votesMap.get(sid);
          const tagVotesObj: Record<string, number> = {};
          if (tagVotes) {
            tagVotes.forEach((vote, tag) => {
              tagVotesObj[tag] = vote;
            });
          }
          (node.series as any).userTagVotes = tagVotesObj;
        });
      }

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
router.post('/:id/trace', optionalAuth, async (req, res, next) => {
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

    // If user is authenticated, add user ratings/notes/votes to all series
    if (req.user) {
      const seriesIds = relationship.nodes.map(n => n.series.id);

      // Fetch all user data for these series in parallel
      const [ratingsMap, notesMap, votesMap] = await Promise.all([
        UserService.getRatingsMap(req.user.userId, seriesIds),
        Promise.all(seriesIds.map(async (sid) => {
          const note = await UserService.getNote(req.user!.userId, sid);
          return [sid, note?.note ?? null] as [string, string | null];
        })).then(pairs => new Map(pairs)),
        UserService.getTagVotesMap(req.user.userId, seriesIds),
      ]);

      // Attach user data to each series
      relationship.nodes.forEach(node => {
        const sid = node.series.id;
        (node.series as any).userRating = ratingsMap.get(sid) ?? null;
        (node.series as any).userNote = notesMap.get(sid) ?? null;

        // Convert tag votes to map
        const tagVotes = votesMap.get(sid);
        const tagVotesObj: Record<string, number> = {};
        if (tagVotes) {
          tagVotes.forEach((vote, tag) => {
            tagVotesObj[tag] = vote;
          });
        }
        (node.series as any).userTagVotes = tagVotesObj;
      });
    }

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
