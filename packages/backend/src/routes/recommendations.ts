import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { PersonalizedRecommendationService } from '../services/personalizedRecommendations.js';
import { RelationshipTracer } from '../services/relationshipTracer.js';
import { SeriesCacheService } from '../services/seriesCache.js';
import { TagSearchService } from '../services/tagSearch.js';
import type { SeriesRelationship } from '@tanuki-temaki/shared';

const router: RouterType = Router();
let recommendationService: PersonalizedRecommendationService;

// Dependency injection - will be set in main server file
let relationshipTracer: RelationshipTracer;
let seriesCache: SeriesCacheService;

export function setDependencies(tracer: RelationshipTracer, cache: SeriesCacheService) {
  relationshipTracer = tracer;
  seriesCache = cache;
  // Initialize recommendation service with tracer for smart expansion
  recommendationService = new PersonalizedRecommendationService(tracer);
}

const personalizedSchema = z.object({
  seriesId: z.string(),
  maxDepth: z.number().min(1).max(5).optional().default(2),
});

const tagRecommendationsSchema = z.object({
  tagValue: z.string(),
  mediaType: z.enum(['ANIME', 'MANGA', 'all']).optional().default('all'),
  maxDepth: z.number().min(1).max(3).optional().default(1),
  topSeriesCount: z.number().min(1).max(10).optional().default(5),
  personalized: z.boolean().optional().default(false),
});

/**
 * POST /api/recommendations/personalized
 * Get personalized recommendations for a series
 * Requires authentication
 */
router.post('/personalized', requireAuth, async (req, res, next) => {
  try {
    const { seriesId, maxDepth } = personalizedSchema.parse(req.body);
    const userId = req.user!.userId;

    logger.info('Generating personalized recommendations', {
      userId,
      seriesId,
      maxDepth,
    });

    // Get series to get URL
    const series = await seriesCache.getSeriesById(seriesId);
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    // First, get the base relationship graph
    const baseGraph = await relationshipTracer.traceRelationships(series.url, maxDepth);

    // Apply personalization
    const personalizedGraph = await recommendationService.getPersonalizedRecommendations(
      baseGraph,
      userId
    );

    res.json(personalizedGraph);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Error generating personalized recommendations', { error });
    res.status(500).json({ error: 'Failed to generate personalized recommendations' });
  }
});

/**
 * POST /api/recommendations/from-tag-stream
 * Get recommendations based on a tag/genre with SSE progress updates
 * Optionally personalized if user is authenticated
 */
router.post('/from-tag-stream', optionalAuth, async (req, res, next) => {
  try {
    const { tagValue, mediaType, maxDepth, topSeriesCount, personalized } =
      tagRecommendationsSchema.parse(req.body);
    const userId = req.user?.userId;

    // Personalization requires authentication
    if (personalized && !userId) {
      return res.status(401).json({ error: 'Authentication required for personalized recommendations' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendProgress = (step: string, message: string, data?: any) => {
      const payload = { step, message, ...data };
      logger.debug('Sending SSE progress', { step, messageLength: message.length });
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      sendProgress('searching', `🔍 Searching for "${tagValue}" tag...`);

      logger.info('Generating tag-based recommendations', {
        tagValue,
        mediaType,
        maxDepth,
        topSeriesCount,
        personalized,
        userId,
      });

      // Get top-rated series for this tag
      sendProgress('fetching', `📊 Finding top series with "${tagValue}" tag...`);
      const topSeries = await TagSearchService.getTopSeriesForTag(
        tagValue,
        mediaType,
        topSeriesCount
      );
      logger.info('Fetched top series', { count: topSeries.length });

      if (topSeries.length === 0) {
        const allTags = await TagSearchService.searchTags('', 10);
        const suggestions = allTags.map(t => t.tag);

        sendProgress('error', `No series found with the tag "${tagValue}"`, {
          error: true,
          suggestions,
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      logger.info(`Found ${topSeries.length} top series for tag "${tagValue}"`);

      // Trace relationships from each top series and merge graphs
      const graphs: SeriesRelationship[] = [];
      const actualSeedIds: string[] = []; // Track the actual database IDs after tracing

      for (let i = 0; i < topSeries.length; i++) {
        const series = topSeries[i];
        try {
          const progress = Math.round(((i + 1) / topSeries.length) * 100);
          sendProgress('tracing', `🔄 Exploring relationships [${i + 1}/${topSeries.length}] depth ${maxDepth}: "${series.title}"`, {
            current: i + 1,
            total: topSeries.length,
            progress,
            maxDepth,
          });

          logger.info(`[${i + 1}/${topSeries.length}] Tracing relationships for "${series.title}"`, {
            url: series.url,
            progress: `${progress}%`,
            maxDepth,
          });

          const graph = await relationshipTracer.traceRelationships(series.url, maxDepth);

          logger.info(`[${i + 1}/${topSeries.length}] Successfully traced "${series.title}"`, {
            nodes: graph.nodes.length,
            edges: graph.edges.length
          });

          graphs.push(graph);

          // Track the root series ID from this graph (the seed series after tracing)
          if (graph.rootId) {
            actualSeedIds.push(graph.rootId);
          }
        } catch (error) {
          logger.warn(`[${i + 1}/${topSeries.length}] Failed to trace relationships for "${series.title}"`, {
            error,
            url: series.url
          });
        }
      }

      logger.info(`Relationship tracing complete`, {
        totalSeries: topSeries.length,
        successfulTraces: graphs.length,
        failedTraces: topSeries.length - graphs.length
      });

      if (graphs.length === 0) {
        sendProgress('error', `Found series with the tag "${tagValue}" but failed to trace their relationships`, {
          error: true,
        });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // Merge all graphs into one
      sendProgress('merging', '🔀 Merging relationship graphs...');
      const mergedGraph = mergeRelationshipGraphs(graphs, tagValue, actualSeedIds);
      logger.info('Graphs merged', {
        nodes: mergedGraph.nodes.length,
        edges: mergedGraph.edges.length,
        seedSeriesIds: actualSeedIds,
      });

      // Apply personalization if requested
      let finalGraph = mergedGraph;
      if (personalized && userId) {
        sendProgress('personalizing', '✨ Personalizing results...');
        finalGraph = await recommendationService.getPersonalizedRecommendations(
          mergedGraph,
          userId
        );
        logger.info('Personalization applied', { nodes: finalGraph.nodes.length, edges: finalGraph.edges.length });
      }

      logger.info('Sending complete event with result', {
        nodes: finalGraph.nodes.length,
        edges: finalGraph.edges.length,
        rootId: finalGraph.rootId,
        seedSeriesIds: finalGraph.seedSeriesIds,
      });

      sendProgress('complete', '✅ Complete!', {
        result: finalGraph,
      });

      logger.info('Complete event sent, ending stream');
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      logger.error('Error generating tag-based recommendations', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: String(error),
      });
      sendProgress('error', 'Failed to generate tag-based recommendations', {
        error: true,
        details: error instanceof Error ? error.message : String(error),
      });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

/**
 * POST /api/recommendations/from-tag
 * Get recommendations based on a tag/genre
 * Optionally personalized if user is authenticated
 */
router.post('/from-tag', optionalAuth, async (req, res, next) => {
  try {
    const { tagValue, mediaType, maxDepth, topSeriesCount, personalized } =
      tagRecommendationsSchema.parse(req.body);
    const userId = req.user?.userId;

    // Personalization requires authentication
    if (personalized && !userId) {
      return res.status(401).json({ error: 'Authentication required for personalized recommendations' });
    }

    logger.info('Generating tag-based recommendations', {
      tagValue,
      mediaType,
      maxDepth,
      topSeriesCount,
      personalized,
      userId,
    });

    // Get top-rated series for this tag
    logger.info('Fetching top series for tag...', { tagValue, mediaType, topSeriesCount });
    const topSeries = await TagSearchService.getTopSeriesForTag(
      tagValue,
      mediaType,
      topSeriesCount
    );
    logger.info('Fetched top series', { count: topSeries.length });

    if (topSeries.length === 0) {
      // Get some popular tags to suggest
      const allTags = await TagSearchService.searchTags('', 10);
      const suggestions = allTags.map(t => t.tag);

      return res.status(404).json({
        error: 'No series found for this tag',
        tagValue,
        suggestions,
        message: `No series found with the tag "${tagValue}". Try one of these popular tags instead: ${suggestions.slice(0, 5).join(', ')}`,
      });
    }

    logger.info(`Found ${topSeries.length} top series for tag "${tagValue}"`);

    // Trace relationships from each top series and merge graphs
    const graphs: SeriesRelationship[] = [];
    const actualSeedIds: string[] = []; // Track the actual database IDs after tracing

    for (let i = 0; i < topSeries.length; i++) {
      const series = topSeries[i];
      try {
        logger.info(`[${i + 1}/${topSeries.length}] Tracing relationships for "${series.title}"`, {
          url: series.url,
          progress: `${Math.round(((i + 1) / topSeries.length) * 100)}%`
        });

        const graph = await relationshipTracer.traceRelationships(series.url, maxDepth);

        logger.info(`[${i + 1}/${topSeries.length}] Successfully traced "${series.title}"`, {
          nodes: graph.nodes.length,
          edges: graph.edges.length
        });

        graphs.push(graph);

        // Track the root series ID from this graph (the seed series after tracing)
        if (graph.rootId) {
          actualSeedIds.push(graph.rootId);
        }
      } catch (error) {
        logger.warn(`[${i + 1}/${topSeries.length}] Failed to trace relationships for "${series.title}"`, {
          error,
          url: series.url
        });
      }
    }

    logger.info(`Relationship tracing complete`, {
      totalSeries: topSeries.length,
      successfulTraces: graphs.length,
      failedTraces: topSeries.length - graphs.length
    });

    if (graphs.length === 0) {
      return res.status(500).json({
        error: 'Failed to generate recommendations',
        tagValue,
        message: `Found series with the tag "${tagValue}" but failed to trace their relationships. Please try again.`,
      });
    }

    // Merge all graphs into one
    const mergedGraph = mergeRelationshipGraphs(graphs, tagValue, actualSeedIds);

    // Apply personalization if requested
    let finalGraph = mergedGraph;
    if (personalized && userId) {
      finalGraph = await recommendationService.getPersonalizedRecommendations(
        mergedGraph,
        userId
      );
    }

    res.json(finalGraph);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    logger.error('Error generating tag-based recommendations', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: String(error),
    });
    res.status(500).json({
      error: 'Failed to generate tag-based recommendations',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Helper function to merge multiple relationship graphs into one
 */
function mergeRelationshipGraphs(
  graphs: SeriesRelationship[],
  tagValue: string,
  seedSeriesIds: string[]
): SeriesRelationship {
  const allNodes = new Map<string, any>();
  const allEdges: any[] = [];

  // Collect all nodes and edges from all graphs
  for (const graph of graphs) {
    // Add all nodes (deduplicate by series ID)
    graph.nodes.forEach((node) => {
      if (!allNodes.has(node.series.id)) {
        allNodes.set(node.series.id, node);
      }
    });

    // Add all edges
    allEdges.push(...graph.edges);
  }

  // Deduplicate edges by from-to pair
  const uniqueEdges = new Map<string, any>();
  allEdges.forEach((edge) => {
    const key = `${edge.from}-${edge.to}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.set(key, edge);
    }
  });

  // For tag search, we don't have a single root series
  // Set rootId to empty string to prevent similarity-based filtering
  const rootId = '';

  return {
    rootId,
    nodes: Array.from(allNodes.values()),
    edges: Array.from(uniqueEdges.values()),
    seedSeriesIds, // Track the original seed series for multi-root tree view
  };
}

export default router;
