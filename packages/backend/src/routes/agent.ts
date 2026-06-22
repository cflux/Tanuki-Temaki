import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { requireApiKey } from '../middleware/apiKeyAuth.js';
import { SeriesCacheService } from '../services/seriesCache.js';
import { RelationshipTracer } from '../services/relationshipTracer.js';
import { UserService } from '../services/user.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router: RouterType = Router();

// Dependency injection
let seriesCache: SeriesCacheService;
let relationshipTracer: RelationshipTracer;

export function setDependencies(cache: SeriesCacheService, tracer: RelationshipTracer) {
  seriesCache = cache;
  relationshipTracer = tracer;
}

// ==================== OPENAPI SPEC (no auth) ====================

router.get('/openapi.yaml', (_req, res) => {
  try {
    const specPath = join(__dirname, 'agent.openapi.yaml');
    const spec = readFileSync(specPath, 'utf-8');
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.send(spec);
  } catch {
    res.status(500).json({ error: 'Could not read OpenAPI spec' });
  }
});

// All routes below require API key
router.use(requireApiKey);

// ==================== SERIES ====================

/**
 * GET /api/agent/series/stats
 * Summary statistics about the series cache.
 */
router.get('/series/stats', async (req, res, next) => {
  try {
    const stats = await seriesCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/series/search?q=&mediaType=ANIME|MANGA&limit=10
 * Search cached series by title.
 */
router.get('/series/search', async (req, res, next) => {
  try {
    const schema = z.object({
      q: z.string().min(1),
      mediaType: z.enum(['ANIME', 'MANGA']).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message);
    }

    const { q, limit } = parsed.data;
    let results = await seriesCache.searchByTitle(q, limit);

    if (parsed.data.mediaType) {
      results = results.filter(s => s.mediaType === parsed.data.mediaType);
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/series/:id
 * Get a single series by internal UUID, with the requesting user's ratings/notes/votes attached.
 */
router.get('/series/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const series = await seriesCache.getSeriesById(id);

    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    const [rating, note, tagVotes] = await Promise.all([
      UserService.getUserRating(req.user!.userId, id),
      UserService.getNote(req.user!.userId, id),
      UserService.getSeriesTagVotes(req.user!.userId, id),
    ]);

    const tagVotesMap: Record<string, number> = {};
    tagVotes.forEach(v => { tagVotesMap[v.tagValue] = v.vote; });

    res.json({
      ...series,
      userRating: rating?.rating ?? null,
      userNote: note?.note ?? null,
      userTagVotes: tagVotesMap,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/series/:id/relationships?maxDepth=3
 * Trace the relationship graph from a series (synchronous, no SSE).
 * Attaches user ratings/notes/votes to each node.
 */
router.get('/series/:id/relationships', async (req, res, next) => {
  try {
    const { id } = req.params;
    const maxDepth = Math.min(parseInt(req.query.maxDepth as string) || 3, 5);

    const series = await seriesCache.getSeriesById(id);
    if (!series) {
      throw new AppError(404, 'Series not found');
    }

    logger.info('Agent: tracing relationships', { seriesId: id, maxDepth, userId: req.user!.userId });

    const relationship = await relationshipTracer.traceRelationships(series.url, maxDepth);

    const seriesIds = relationship.nodes.map((n: { series: { id: string } }) => n.series.id);
    const [ratingsMap, notesMap, votesMap] = await Promise.all([
      UserService.getRatingsMap(req.user!.userId, seriesIds),
      UserService.getNotesMap(req.user!.userId, seriesIds),
      UserService.getTagVotesMap(req.user!.userId, seriesIds),
    ]);

    relationship.nodes.forEach((node: { series: { id: string } }) => {
      const sid = node.series.id;
      (node.series as any).userRating = ratingsMap.get(sid) ?? null;
      (node.series as any).userNote = notesMap.get(sid) ?? null;
      const tagVotes = votesMap.get(sid);
      const tagVotesObj: Record<string, number> = {};
      if (tagVotes) tagVotes.forEach((vote, tag) => { tagVotesObj[tag] = vote; });
      (node.series as any).userTagVotes = tagVotesObj;
    });

    res.json(relationship);
  } catch (error) {
    next(error);
  }
});

// ==================== USER DATA ====================

/**
 * GET /api/agent/user/profile
 * Basic profile info for the key owner.
 */
router.get('/user/profile', async (req, res, next) => {
  try {
    const { username, userId } = req.user!;
    res.json({ id: userId, username });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/user/ratings?minRating=1&mediaType=ANIME
 * All series rated by the key owner.
 */
router.get('/user/ratings', async (req, res, next) => {
  try {
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;
    const mediaType = req.query.mediaType as string | undefined;

    let ratings = await UserService.getAllRatings(req.user!.userId);

    if (minRating !== undefined && !isNaN(minRating)) {
      ratings = ratings.filter(r => r.rating >= minRating);
    }
    if (mediaType === 'ANIME' || mediaType === 'MANGA') {
      ratings = ratings.filter(r => r.series.mediaType === mediaType);
    }

    res.json(ratings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/user/watchlist?status=watching
 * Full watchlist for the key owner, optionally filtered by status.
 */
router.get('/user/watchlist', async (req, res, next) => {
  try {
    const VALID_STATUSES = ['plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped'];
    const statusFilter = req.query.status as string | undefined;

    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      throw new AppError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    let watchlist = await UserService.getWatchlist(req.user!.userId);

    if (statusFilter) {
      watchlist = watchlist.filter(w => w.status === statusFilter);
    }

    res.json(watchlist);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/user/notes
 * All series with private notes for the key owner.
 */
router.get('/user/notes', async (req, res, next) => {
  try {
    const noted = await UserService.getNotedSeries(req.user!.userId);
    res.json(noted);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/user/tag-preferences
 * Aggregated tag vote scores across all series for the key owner.
 * Returns { tagValue: score } where score is sum of +1/-1 votes.
 */
router.get('/user/tag-preferences', async (req, res, next) => {
  try {
    const prefs = await UserService.getUserTagPreferences(req.user!.userId);
    res.json(Object.fromEntries(prefs));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agent/user/preferences
 * App preferences for the key owner (theme, media_filter, etc.).
 */
router.get('/user/preferences', async (req, res, next) => {
  try {
    const prefs = await UserService.getAllPreferences(req.user!.userId);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
});

export default router;
