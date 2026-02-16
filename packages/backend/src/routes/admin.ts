import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { AniListAdapter } from '../adapters/anilist.js';
import { SeriesCacheService } from '../services/seriesCache.js';
import { RelationshipTracer } from '../services/relationshipTracer.js';

const router = express.Router();
const prisma = new PrismaClient();

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
 * Get cache statistics
 * Admin only
 */
router.get('/cache/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get basic counts
    const totalSeries = await prisma.series.count();
    const totalTags = await prisma.tag.count();
    const totalRelationships = await prisma.relationship.count();

    // Initialize empty array
    let byMediaType: Array<{ mediaType: string; count: number }> = [];

    // Only query groupBy if there are series
    if (totalSeries > 0) {
      try {
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

/**
 * Seed database with popular series from AniList
 * Fetches top 10 most popular series and traces relationships 1 level deep
 * Admin only
 */
router.post('/seed/popular', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('Starting popular series seed', { adminUser: req.user?.username });

    // Return immediately with accepted status
    res.status(202).json({
      success: true,
      message: 'Seeding started in background',
      status: 'processing'
    });

    // Process in background
    (async () => {
      const anilistAdapter = new AniListAdapter();
      const seededSeries: string[] = [];
      const errors: Array<{ title: string; error: string }> = [];

      try {
        logger.info('Fetching top 10 popular series from AniList');

        // Query for top 10 popular anime from AniList
        const query = `
          query {
            Page(page: 1, perPage: 10) {
              media(type: ANIME, sort: POPULARITY_DESC) {
                id
                title {
                  romaji
                  english
                  native
                }
                externalLinks {
                  url
                  site
                  type
                }
              }
            }
          }
        `;

        const { fetchAniList } = await import('../adapters/anilistClient.js');
        const data = await fetchAniList(query, {});

        const popularMedia = data?.Page?.media || [];
        logger.info(`Found ${popularMedia.length} popular series on AniList`);

        // For each popular series, fetch and trace relationships
        for (const media of popularMedia) {
          try {
            const title = media.title.english || media.title.romaji || media.title.native;
            logger.info(`Processing popular series: ${title}`, { anilistId: media.id });

            // Fetch the series by AniList ID (this will cache it)
            const series = await seriesCache.fetchByAniListId(media.id, 'ANIME');

            if (series) {
              logger.info(`Fetched series: ${series.title}`, { seriesId: series.id });

              // Trace relationships 1 level deep
              logger.info(`Tracing relationships for: ${series.title}`, { depth: 1 });
              await relationshipTracer.traceRelationships(series.url, 1);

              seededSeries.push(series.title);
              logger.info(`Successfully seeded: ${series.title}`, {
                seriesId: series.id,
                total: seededSeries.length
              });
            } else {
              logger.warn(`Could not fetch series: ${title}`, { anilistId: media.id });
              errors.push({ title, error: 'Failed to fetch series' });
            }
          } catch (error) {
            const title = media.title.english || media.title.romaji || media.title.native;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error processing series: ${title}`, { error: errorMessage });
            errors.push({ title, error: errorMessage });
          }
        }

        logger.info('Popular series seed complete', {
          adminUser: req.user?.username,
          seededCount: seededSeries.length,
          errorCount: errors.length,
          seededSeries,
          errors
        });
      } catch (error) {
        logger.error('Error during popular series seed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          adminUser: req.user?.username,
          seededCount: seededSeries.length,
          errorCount: errors.length
        });
      }
    })();
  } catch (error) {
    logger.error('Error starting popular series seed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: req.user?.username
    });
    res.status(500).json({ error: 'Failed to start seeding' });
  }
});

/**
 * Seed database with popular series - with streaming progress
 * Admin only
 */
router.post('/seed/popular-stream', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('Starting popular series seed (streaming)', { adminUser: req.user?.username });

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (step: string, message: string, data?: any) => {
      res.write(`data: ${JSON.stringify({ step, message, ...data })}\n\n`);
    };

    const seededSeries: string[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    try {
      sendProgress('init', 'Fetching top 10 popular series from AniList...');

      // Query for top 10 popular anime from AniList
      const query = `
        query {
          Page(page: 1, perPage: 10) {
            media(type: ANIME, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
                native
              }
              externalLinks {
                url
                site
                type
              }
            }
          }
        }
      `;

      const { fetchAniList } = await import('../adapters/anilistClient.js');
      const data = await fetchAniList(query, {});

      const popularMedia = data?.Page?.media || [];
      sendProgress('fetched', `Found ${popularMedia.length} popular series`, { count: popularMedia.length });

      // For each popular series, fetch and trace relationships
      for (let i = 0; i < popularMedia.length; i++) {
        const media = popularMedia[i];
        try {
          const title = media.title.english || media.title.romaji || media.title.native;
          sendProgress('processing', `[${i + 1}/${popularMedia.length}] Processing: ${title}`);

          // Fetch the series by AniList ID (this will cache it)
          const series = await seriesCache.fetchByAniListId(media.id, 'ANIME');

          if (series) {
            sendProgress('fetched_series', `Fetched: ${series.title}`);

            // Trace relationships 1 level deep
            sendProgress('tracing', `Tracing relationships for: ${series.title}`);
            await relationshipTracer.traceRelationships(series.url, 1);

            seededSeries.push(series.title);
            sendProgress('completed_series', `✓ Completed: ${series.title}`, {
              progress: i + 1,
              total: popularMedia.length,
              seededCount: seededSeries.length
            });
          } else {
            sendProgress('error', `Failed to fetch: ${title}`);
            errors.push({ title, error: 'Failed to fetch series' });
          }
        } catch (error) {
          const title = media.title.english || media.title.romaji || media.title.native;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          sendProgress('error', `Error processing: ${title} - ${errorMessage}`);
          errors.push({ title, error: errorMessage });
        }
      }

      sendProgress('complete', 'Seeding complete!', {
        seededCount: seededSeries.length,
        errorCount: errors.length,
        seededSeries,
        errors
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendProgress('error', `Fatal error: ${errorMessage}`);
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Error starting popular series seed stream', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: req.user?.username
    });
    res.status(500).json({ error: 'Failed to start seeding' });
  }
});

/**
 * Expand database by seeding series with no relationships
 * Finds first 10 series with no relationships and traces them 1 level deep
 * Admin only
 */
router.post('/seed/expand', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('Starting expand seed (series with no relationships)', {
      adminUser: req.user?.username
    });

    // Return immediately with accepted status
    res.status(202).json({
      success: true,
      message: 'Expansion started in background',
      status: 'processing'
    });

    // Process in background
    (async () => {
      const seededSeries: string[] = [];
      const errors: Array<{ title: string; error: string }> = [];

      try {
        logger.info('Finding series with no relationships');

        // Query for series that have no relationships (neither from nor to)
        const seriesWithNoRelationships = await prisma.series.findMany({
          where: {
            AND: [
              {
                relatedFrom: {
                  none: {}
                }
              },
              {
                relatedTo: {
                  none: {}
                }
              }
            ]
          },
          take: 10,
          orderBy: {
            fetchedAt: 'asc' // Oldest first - likely need updating
          }
        });

        logger.info(`Found ${seriesWithNoRelationships.length} series with no relationships`);

        // For each series, trace relationships
        for (const series of seriesWithNoRelationships) {
          try {
            logger.info(`Processing series: ${series.title}`, { seriesId: series.id });

            // Trace relationships 1 level deep
            logger.info(`Tracing relationships for: ${series.title}`, { depth: 1 });
            await relationshipTracer.traceRelationships(series.url, 1);

            seededSeries.push(series.title);
            logger.info(`Successfully traced relationships: ${series.title}`, {
              seriesId: series.id,
              total: seededSeries.length
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error processing series: ${series.title}`, {
              seriesId: series.id,
              error: errorMessage
            });
            errors.push({ title: series.title, error: errorMessage });
          }
        }

        logger.info('Expand seed complete', {
          adminUser: req.user?.username,
          processedCount: seededSeries.length,
          errorCount: errors.length,
          processedSeries: seededSeries,
          errors
        });
      } catch (error) {
        logger.error('Error during expand seed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          adminUser: req.user?.username,
          processedCount: seededSeries.length,
          errorCount: errors.length
        });
      }
    })();
  } catch (error) {
    logger.error('Error starting expand seed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: req.user?.username
    });
    res.status(500).json({ error: 'Failed to start expansion' });
  }
});

/**
 * Expand database - with streaming progress
 * Admin only
 */
router.post('/seed/expand-stream', requireAuth, requireAdmin, async (req, res) => {
  try {
    logger.info('Starting expand seed (streaming)', { adminUser: req.user?.username });

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (step: string, message: string, data?: any) => {
      res.write(`data: ${JSON.stringify({ step, message, ...data })}\n\n`);
    };

    const processedSeries: string[] = [];
    const errors: Array<{ title: string; error: string }> = [];

    try {
      sendProgress('init', 'Finding series with no relationships...');

      // Query for series that have no relationships (neither from nor to)
      const seriesWithNoRelationships = await prisma.series.findMany({
        where: {
          AND: [
            {
              relatedFrom: {
                none: {}
              }
            },
            {
              relatedTo: {
                none: {}
              }
            }
          ]
        },
        take: 10,
        orderBy: {
          fetchedAt: 'asc' // Oldest first - likely need updating
        }
      });

      sendProgress('found', `Found ${seriesWithNoRelationships.length} series to process`, {
        count: seriesWithNoRelationships.length
      });

      // For each series, trace relationships
      for (let i = 0; i < seriesWithNoRelationships.length; i++) {
        const series = seriesWithNoRelationships[i];
        try {
          sendProgress('processing', `[${i + 1}/${seriesWithNoRelationships.length}] Processing: ${series.title}`);

          // Trace relationships 1 level deep
          sendProgress('tracing', `Tracing relationships for: ${series.title}`);
          await relationshipTracer.traceRelationships(series.url, 1);

          processedSeries.push(series.title);
          sendProgress('completed_series', `✓ Completed: ${series.title}`, {
            progress: i + 1,
            total: seriesWithNoRelationships.length,
            processedCount: processedSeries.length
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          sendProgress('error', `Error processing: ${series.title} - ${errorMessage}`);
          errors.push({ title: series.title, error: errorMessage });
        }
      }

      sendProgress('complete', 'Expansion complete!', {
        processedCount: processedSeries.length,
        errorCount: errors.length,
        processedSeries,
        errors
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sendProgress('error', `Fatal error: ${errorMessage}`);
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Error starting expand seed stream', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminUser: req.user?.username
    });
    res.status(500).json({ error: 'Failed to start expansion' });
  }
});

export default router;
