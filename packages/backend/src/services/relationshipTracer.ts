import type {
  Series,
  SeriesRelationship,
  SeriesNode,
  RelationshipEdge,
  Tag,
} from '@tanuki-temaki/shared';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { SeriesCacheService } from './seriesCache.js';
import { AniListMatcherService } from './anilistMatcher.js';
import type { RelatedAnimeInfo } from '../adapters/anilist.js';

export interface TraceProgress {
  step: 'fetching_root' | 'fetching_relations' | 'processing_series' | 'complete' | 'rate_limited';
  current: number;
  total: number;
  message: string;
  rateLimitInfo?: {
    waitTimeMs: number;
    attempt: number;
    maxRetries: number;
  };
}

export type ProgressCallback = (progress: TraceProgress) => void;

/**
 * Relationship tracing service
 * Builds graph of related series with tag-based clustering
 * Now uses AniList's relationship data instead of scraping pages
 */
export class RelationshipTracer {
  private anilistMatcher: AniListMatcherService;
  private graphCache: Map<string, { graph: SeriesRelationship; timestamp: number }> = new Map();
  private readonly GRAPH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private seriesCache: SeriesCacheService
  ) {
    this.anilistMatcher = new AniListMatcherService();
  }

  /**
   * Trace relationships from root series
   */
  async traceRelationships(
    rootUrl: string,
    maxDepth: number = 3,
    onProgress?: ProgressCallback
  ): Promise<SeriesRelationship> {
    logger.info('Starting relationship trace', { rootUrl, maxDepth });

    // Get root series first to get the ID for cache lookup
    onProgress?.({
      step: 'fetching_root',
      current: 0,
      total: 1,
      message: 'Fetching root series...',
    });

    const root = await this.seriesCache.getSeries(rootUrl);

    // Check graph cache
    const graphCacheKey = `${root.id}_${maxDepth}`;
    const cached = this.graphCache.get(graphCacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.GRAPH_CACHE_TTL) {
        logger.info('Using cached relationship graph', {
          rootId: root.id,
          maxDepth,
          ageMinutes: Math.round(age / 60000),
          nodeCount: cached.graph.nodes.length,
        });

        // Send progress updates to simulate the work
        onProgress?.({
          step: 'complete',
          current: cached.graph.nodes.length,
          total: cached.graph.nodes.length,
          message: `Loaded ${cached.graph.nodes.length} cached series`,
        });

        return cached.graph;
      } else {
        // Cache expired
        logger.info('Cached graph expired, rebuilding', { rootId: root.id, maxDepth });
        this.graphCache.delete(graphCacheKey);
      }
    }

    const visited = new Set<string>();
    const nodes: SeriesNode[] = [];
    const edges: RelationshipEdge[] = [];

    nodes.push({ series: root, depth: 0 });
    visited.add(root.id);

    // Breadth-first traversal with root tags for filtering
    await this.traverseBFS(root, root.tags, 0, maxDepth, visited, nodes, edges, onProgress);

    // Cluster by tag similarity
    const clustered = this.clusterByTags(nodes);

    // Store relationships in database
    await this.persistRelationships(edges);

    onProgress?.({
      step: 'complete',
      current: clustered.length,
      total: clustered.length,
      message: `Discovered ${clustered.length} related series`,
    });

    logger.info('Relationship trace complete', {
      rootId: root.id,
      nodeCount: clustered.length,
      edgeCount: edges.length,
    });

    const graph: SeriesRelationship = {
      rootId: root.id,
      nodes: clustered,
      edges,
    };

    // Cache the graph for future requests
    this.graphCache.set(graphCacheKey, {
      graph,
      timestamp: Date.now(),
    });

    logger.info('Cached relationship graph', {
      rootId: root.id,
      maxDepth,
      nodeCount: clustered.length,
      cacheSize: this.graphCache.size,
    });

    return graph;
  }

  /**
   * Breadth-first traversal to build relationship graph
   * Filters depth 1+ series by tag overlap with root
   */
  private async traverseBFS(
    current: Series,
    rootTags: Tag[],
    depth: number,
    maxDepth: number,
    visited: Set<string>,
    nodes: SeriesNode[],
    edges: RelationshipEdge[],
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (depth >= maxDepth) {
      logger.info('Reached max depth', { depth, maxDepth });
      return;
    }

    // Set up rate limit callback to notify UI
    if (onProgress) {
      this.anilistMatcher.getAdapter().setRateLimitCallback((waitTimeMs, attempt, maxRetries) => {
        onProgress({
          step: 'rate_limited',
          current: nodes.length,
          total: nodes.length,
          message: `Waiting for API cooldown (${Math.ceil(waitTimeMs / 1000)}s)...`,
          rateLimitInfo: {
            waitTimeMs,
            attempt,
            maxRetries,
          },
        });
      });
    }

    // Get AniList ID from metadata
    const metadata = current.metadata as Record<string, any>;
    const anilistId = metadata?.anilistId;

    if (!anilistId) {
      logger.warn('No AniList ID found for series', {
        seriesId: current.id,
        title: current.title,
      });
      return;
    }

    // Check if we have cached AniList relations in metadata
    let relatedAnime;
    const lastFetched = metadata?.relationsLastFetched;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isStale = !lastFetched ||
      (Date.now() - new Date(lastFetched as string).getTime()) > SEVEN_DAYS_MS;

    logger.info('Checking for cached relations', {
      seriesId: current.id,
      title: current.title,
      hasAnilistRelations: !!metadata?.anilistRelations,
      relationsCount: metadata?.anilistRelations?.length ?? 0,
      hasLastFetched: !!lastFetched,
      lastFetched: lastFetched,
      isStale,
    });

    if (metadata?.anilistRelations && Array.isArray(metadata.anilistRelations) && !isStale) {
      logger.info('Using cached AniList relations', {
        seriesId: current.id,
        cachedCount: metadata.anilistRelations.length,
        age: lastFetched ? `${Math.round((Date.now() - new Date(lastFetched as string).getTime()) / (24 * 60 * 60 * 1000))} days` : 'unknown',
      });
      relatedAnime = metadata.anilistRelations;
    } else {
      if (isStale && metadata?.anilistRelations) {
        logger.info('Cached relations are stale, refreshing from AniList', {
          seriesId: current.id,
          lastFetched,
        });
      }
      // Fetch related media from AniList (anime or manga)
      const mediaType = current.mediaType || 'ANIME';
      const anilistMedia = mediaType === 'MANGA'
        ? await this.anilistMatcher.getAdapter().getMangaWithRelations(anilistId)
        : await this.anilistMatcher.getAdapter().getAnimeWithRelations(anilistId);

      if (!anilistMedia) {
        logger.warn('No AniList data found', { anilistId, mediaType });
        return;
      }

      // Get related media with all streaming platforms
      relatedAnime = this.anilistMatcher
        .getAdapter()
        .getRelatedAnimeAllPlatforms(anilistMedia);

      // Also collect recommendations from all sequels (mainline seasons only)
      // This gives us better recommendation coverage across the entire series
      // Re-enabled with detailed logging to debug the issue
      const collectSequelRecs = true; // Always enabled now
      if (collectSequelRecs && depth === 0) {
        try {
          const sequelRecommendations = await this.collectSequelRecommendations(
            anilistMedia,
            mediaType,
            true
          );

          if (sequelRecommendations.length > 0) {
            logger.info('Adding sequel recommendations', {
              seriesId: current.id,
              title: current.title,
              sequelRecsCount: sequelRecommendations.length,
            });
            // Merge sequel recommendations into related anime
            // Filter out duplicates by anilistId
            const existingIds = new Set(relatedAnime.map((r: any) => r.anilistId));
            const newRecs = sequelRecommendations.filter(r => !existingIds.has(r.anilistId));
            relatedAnime = [...relatedAnime, ...newRecs];
          }
        } catch (error) {
          logger.error('Error collecting sequel recommendations', { error });
          // Continue without sequel recommendations
        }
      }

      // Cache the relations in the series metadata for next time
      await prisma.series.update({
        where: { id: current.id },
        data: {
          metadata: {
            ...metadata,
            anilistRelations: relatedAnime,
            relationsLastFetched: new Date().toISOString(),
          } as any,
        },
      });
    }

    // Filter to only those with streaming links
    const availableRelated = relatedAnime.filter(
      (r: any) => r.streamingLinks && Object.keys(r.streamingLinks).length > 0
    );

    logger.info('Found related anime with streaming links', {
      seriesId: current.id,
      totalRelated: relatedAnime.length,
      withStreamingLinks: availableRelated.length,
      depth,
    });

    onProgress?.({
      step: 'fetching_relations',
      current: nodes.length,
      total: nodes.length + availableRelated.length,
      message: `Found ${availableRelated.length} related series, processing...`,
    });

    // Process each related series
    let processedCount = 0;
    for (const relatedInfo of availableRelated) {
      try {
        // Use any streaming link (prefer Crunchyroll for backwards compatibility)
        // For manga or anime without streaming links, use AniList URL as fallback
        const streamingLinks = relatedInfo.streamingLinks || {};
        const streamingUrl = relatedInfo.crunchyrollUrl || Object.values(streamingLinks)[0] || `anilist://${relatedInfo.anilistId}`;

        // Normalize URL and check if series already exists FIRST
        const normalizedUrl = this.normalizeUrl(streamingUrl);
        let existing = await prisma.series.findUnique({
          where: { url: normalizedUrl },
          include: { tags: true },
        });

        // Also check by AniList ID (provider + externalId)
        if (!existing) {
          const anilistExternalId = `anilist-${relatedInfo.anilistId}`;
          existing = await prisma.series.findUnique({
            where: {
              provider_externalId: {
                provider: 'crunchyroll',
                externalId: anilistExternalId,
              },
            },
            include: { tags: true },
          });
        }

        let related;
        if (existing) {
          // Series already exists - use cached data, no AniList fetch needed!
          logger.info('Using cached series data', {
            seriesId: existing.id,
            title: existing.title,
          });
          related = existing;
        } else {
          // Series doesn't exist - fetch from AniList and create it
          // Determine media type from the related info (from AniList relations)
          const relatedMediaType = relatedInfo.type || current.mediaType || 'ANIME';
          logger.info('Processing related media', {
            title: relatedInfo.title,
            anilistId: relatedInfo.anilistId,
            type: relatedInfo.type,
            resolvedType: relatedMediaType,
          });
          const relatedAnilistMedia = relatedMediaType === 'MANGA'
            ? await this.anilistMatcher.getAdapter().getMangaWithRelations(relatedInfo.anilistId)
            : await this.anilistMatcher.getAdapter().getAnimeWithRelations(relatedInfo.anilistId);

          if (!relatedAnilistMedia) {
            logger.warn('Could not fetch AniList data for related media', {
              anilistId: relatedInfo.anilistId,
              title: relatedInfo.title,
              mediaType: relatedMediaType,
            });
            continue;
          }

          // Normalize AniList data to RawSeriesData
          const rawData = this.anilistMatcher
            .getAdapter()
            .normalizeToRawSeriesData(relatedAnilistMedia, normalizedUrl);

          // Generate tags
          const tagGenerator = new (await import('./tagGenerator.js')).TagGenerator();
          const generatedTags = tagGenerator.generateTags(rawData);

          // Add streaming links to metadata
          const enrichedMetadata = {
            ...rawData.metadata,
            streamingLinks: relatedInfo.streamingLinks || {},
          };

          // Create new series (with race condition handling)
          try {
            related = await prisma.series.create({
              data: {
                provider: rawData.provider,
                mediaType: rawData.mediaType,
                externalId: rawData.externalId,
                url: rawData.url,
                title: rawData.title,
                titleImage: rawData.titleImage,
                description: rawData.description,
                rating: rawData.rating,
                ageRating: rawData.ageRating,
                languages: rawData.languages,
                genres: rawData.genres,
                contentAdvisory: rawData.contentAdvisory,
                metadata: enrichedMetadata,
                tags: {
                  create: generatedTags.map(tag => ({
                    value: tag.value,
                    source: tag.source,
                    confidence: tag.confidence,
                    category: tag.category,
                  })),
                },
              },
              include: { tags: true },
            });
          } catch (createError: any) {
            // Handle race condition: series was created by another process/request
            if (createError?.code === 'P2002') {
              logger.info('Series already exists (race condition), fetching existing', {
                provider: rawData.provider,
                externalId: rawData.externalId,
                title: rawData.title,
              });

              // Fetch the existing series
              const existingByProviderExtId = await prisma.series.findUnique({
                where: {
                  provider_externalId: {
                    provider: rawData.provider,
                    externalId: rawData.externalId,
                  },
                },
                include: { tags: true },
              });

              if (existingByProviderExtId) {
                related = existingByProviderExtId;
              } else {
                // If still not found, something is wrong - log and skip
                logger.error('Failed to fetch series after unique constraint error', {
                  provider: rawData.provider,
                  externalId: rawData.externalId,
                });
                continue;
              }
            } else {
              // Some other error, re-throw
              throw createError;
            }
          }
        }

        const relatedSeries: Series = {
          id: related.id,
          provider: related.provider,
          mediaType: related.mediaType || 'ANIME',
          externalId: related.externalId,
          url: related.url,
          title: related.title,
          titleImage: related.titleImage ?? undefined,
          description: related.description,
          rating: related.rating ?? undefined,
          ageRating: related.ageRating ?? undefined,
          languages: related.languages,
          genres: related.genres,
          contentAdvisory: related.contentAdvisory,
          tags: related.tags.map((tag: any) => ({
            id: tag.id,
            value: tag.value,
            source: tag.source,
            confidence: tag.confidence,
            category: tag.category ?? undefined,
          })),
          metadata: (related.metadata as Record<string, any>) ?? {},
          fetchedAt: related.fetchedAt,
          updatedAt: related.updatedAt,
        };

        // Report progress for this series (even if we filter it out later)
        processedCount++;
        const statusMessage = depth >= 1 ? `Evaluating ${relatedSeries.title}...` : `Processing ${relatedSeries.title}...`;
        onProgress?.({
          step: 'processing_series',
          current: nodes.length,
          total: nodes.length + (availableRelated.length - processedCount),
          message: statusMessage,
        });

        if (visited.has(relatedSeries.id)) {
          continue;
        }

        // Progressive filtering: stricter requirements at deeper levels
        // Depth 0: No filtering (direct recommendations)
        // Depth 1: 20% tag overlap required
        // Depth 2+: 75% tag overlap required
        if (depth >= 1) {
          const similarityToRoot = this.calculateSimilarity(rootTags, relatedSeries.tags);
          const SIMILARITY_THRESHOLD = depth === 1 ? 0.15 : 0.90;

          if (similarityToRoot < SIMILARITY_THRESHOLD) {
            logger.info('Filtering out series due to low similarity to root', {
              title: relatedSeries.title,
              depth,
              similarityToRoot: similarityToRoot.toFixed(2),
              threshold: SIMILARITY_THRESHOLD,
            });
            continue;
          }

          logger.info('Including series with sufficient similarity to root', {
            title: relatedSeries.title,
            depth,
            similarityToRoot: similarityToRoot.toFixed(2),
            threshold: SIMILARITY_THRESHOLD,
          });
        }

        visited.add(relatedSeries.id);

        // Add node
        nodes.push({ series: relatedSeries, depth: depth + 1 });

        // Calculate similarity
        const similarity = this.calculateSimilarity(current.tags, relatedSeries.tags);
        const sharedTags = this.getSharedTags(current.tags, relatedSeries.tags);

        // Add edge with relation type from AniList
        edges.push({
          from: current.id,
          to: relatedSeries.id,
          similarity,
          sharedTags,
          relationType: relatedInfo.relationType,
        });

        // Continue traversal (recursive)
        if (depth + 1 < maxDepth) {
          await this.traverseBFS(
            relatedSeries,
            rootTags,
            depth + 1,
            maxDepth,
            visited,
            nodes,
            edges,
            onProgress
          );
        }
      } catch (error) {
        logger.error('Error processing related series', {
          title: relatedInfo.title,
          crunchyrollUrl: relatedInfo.crunchyrollUrl,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with next series instead of failing entire trace
      }
    }
  }

  /**
   * Collect recommendations from all sequels in the series
   * Traverses SEQUEL chain forward and merges all recommendations
   * Ignores SIDE_STORY, SPIN_OFF, and other non-mainline relations
   */
  private async collectSequelRecommendations(
    media: any,
    mediaType: 'ANIME' | 'MANGA',
    enabled: boolean
  ): Promise<RelatedAnimeInfo[]> {
    if (!enabled) return [];

    logger.info('[SEQUEL] Starting sequel recommendation collection', {
      rootTitle: media.title.english || media.title.romaji,
      rootId: media.id,
      mediaType,
    });

    const allRecommendations: RelatedAnimeInfo[] = [];
    const visited = new Set<number>([media.id]);
    let currentMedia = media;

    try {
      // Traverse the SEQUEL chain forward (Season 1 -> Season 2 -> Season 3, etc.)
      while (true) {
        logger.info('[SEQUEL] Checking for sequels', {
          currentTitle: currentMedia.title.english || currentMedia.title.romaji,
          currentId: currentMedia.id,
          hasRelations: !!currentMedia.relations,
          edgesCount: currentMedia.relations?.edges?.length || 0,
        });

        // Find SEQUEL relation (next season)
        const sequelEdge = currentMedia.relations?.edges?.find(
          (edge: any) => edge.relationType === 'SEQUEL' && edge.node.type === mediaType
        );

        if (!sequelEdge || !sequelEdge.node.id) {
          logger.info('[SEQUEL] No more sequels found', {
            currentId: currentMedia.id,
            hasSequelEdge: !!sequelEdge,
          });
          break;
        }

        const sequelId = sequelEdge.node.id;

        // Prevent infinite loops
        if (visited.has(sequelId)) {
          logger.warn('[SEQUEL] Circular SEQUEL relation detected', {
            currentId: currentMedia.id,
            sequelId,
          });
          break;
        }

        visited.add(sequelId);

        logger.info('[SEQUEL] Found sequel, fetching data', {
          fromTitle: currentMedia.title.english || currentMedia.title.romaji,
          fromId: currentMedia.id,
          toTitle: sequelEdge.node.title?.english || sequelEdge.node.title?.romaji,
          toId: sequelId,
        });

        // Add delay to avoid hitting AniList rate limits (90 req/min = ~700ms between requests)
        // Wait 1 second between sequel fetches to be safe
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch the sequel with its relations and recommendations
        const sequelMedia = mediaType === 'MANGA'
          ? await this.anilistMatcher.getAdapter().getMangaWithRelations(sequelId)
          : await this.anilistMatcher.getAdapter().getAnimeWithRelations(sequelId);

        if (!sequelMedia) {
          logger.warn('[SEQUEL] Could not fetch sequel media', { sequelId });
          break;
        }

        logger.info('[SEQUEL] Fetched sequel media, extracting recommendations', {
          sequelTitle: sequelMedia.title.english || sequelMedia.title.romaji,
          sequelId: sequelMedia.id,
        });

        // Extract recommendations from this sequel
        const sequelRelated = this.anilistMatcher
          .getAdapter()
          .getRelatedAnimeAllPlatforms(sequelMedia);

        logger.info('[SEQUEL] Got related media from sequel', {
          totalRelated: sequelRelated.length,
          sampleRelationTypes: sequelRelated.slice(0, 5).map((r: any) => r.relationType),
        });

        // Filter to only recommendations (exclude direct relations like SEQUEL, PREQUEL, etc.)
        // getRelatedAnimeAllPlatforms returns both relations and recommendations
        // Relations have relationType like 'SEQUEL', 'PREQUEL', etc.
        // Recommendations have relationType like 'RECOMMENDATION' or undefined
        const recommendations = sequelRelated.filter((r: any) => {
          const relType = r.relationType;
          const isDirectRelation = ['SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SOURCE', 'ADAPTATION'].includes(relType);
          return !isDirectRelation;
        });

        logger.info('[SEQUEL] Filtered recommendations', {
          sequelTitle: sequelMedia.title.english || sequelMedia.title.romaji,
          totalRelated: sequelRelated.length,
          recommendationCount: recommendations.length,
          filteredOut: sequelRelated.length - recommendations.length,
        });

        allRecommendations.push(...recommendations);

        // Move to next sequel
        currentMedia = sequelMedia;

        // Limit to prevent too many API calls (max 5 sequels = 5 extra API calls)
        if (visited.size >= 6) {
          logger.info('[SEQUEL] Reached max sequel depth', { count: visited.size });
          break;
        }
      }

      logger.info('[SEQUEL] Collection complete', {
        totalSequels: visited.size - 1,
        totalRecommendations: allRecommendations.length,
      });

      return allRecommendations;
    } catch (error) {
      logger.error('[SEQUEL] Error during collection', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        currentMediaId: currentMedia?.id,
        visitedCount: visited.size,
      });
      // Return what we have so far
      return allRecommendations;
    }
  }

  /**
   * Calculate Jaccard similarity between tag sets
   */
  private calculateSimilarity(tags1: Tag[], tags2: Tag[]): number {
    const set1 = new Set(tags1.map(t => t.value));
    const set2 = new Set(tags2.map(t => t.value));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Get tags shared between two series
   */
  private getSharedTags(tags1: Tag[], tags2: Tag[]): string[] {
    const set1 = new Set(tags1.map(t => t.value));
    const set2 = new Set(tags2.map(t => t.value));

    return [...set1].filter(x => set2.has(x));
  }

  /**
   * Normalize Crunchyroll URL from AniList
   * Handles various URL formats and makes them consistent
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim();

    // Convert http to https
    normalized = normalized.replace(/^http:/, 'https:');

    // Ensure www. is present
    normalized = normalized.replace(
      /^https:\/\/crunchyroll\.com/,
      'https://www.crunchyroll.com'
    );

    // If it's an old-style URL without /series/, try to extract the slug
    // and convert to new format (we won't be able to get the ID, so keep as-is)
    // Example: https://www.crunchyroll.com/the-misfit-of-demon-king-academy
    // This will remain as-is since we don't have the series ID

    return normalized;
  }

  /**
   * Cluster nodes by tag similarity
   */
  private clusterByTags(nodes: SeriesNode[]): SeriesNode[] {
    logger.info('Clustering nodes by tag similarity', { nodeCount: nodes.length });

    const clusters = new Map<string, string>();
    let clusterIdCounter = 0;

    // Simple greedy clustering: assign each node to a cluster
    for (let i = 0; i < nodes.length; i++) {
      if (clusters.has(nodes[i].series.id)) continue;

      const clusterId = `cluster-${clusterIdCounter++}`;
      clusters.set(nodes[i].series.id, clusterId);

      // Find similar nodes (>40% tag similarity)
      for (let j = i + 1; j < nodes.length; j++) {
        if (clusters.has(nodes[j].series.id)) continue;

        const similarity = this.calculateSimilarity(
          nodes[i].series.tags,
          nodes[j].series.tags
        );

        if (similarity > 0.4) {
          clusters.set(nodes[j].series.id, clusterId);
        }
      }
    }

    // Assign cluster IDs to nodes
    const clusteredNodes = nodes.map(node => ({
      ...node,
      cluster: clusters.get(node.series.id),
    }));

    const clusterCount = new Set(clusters.values()).size;
    logger.info('Clustering complete', {
      nodeCount: nodes.length,
      clusterCount,
    });

    return clusteredNodes;
  }

  /**
   * Persist relationships to database
   */
  private async persistRelationships(edges: RelationshipEdge[]): Promise<void> {
    logger.info('Persisting relationships', { count: edges.length });

    for (const edge of edges) {
      try {
        await prisma.relationship.upsert({
          where: {
            fromSeriesId_toSeriesId: {
              fromSeriesId: edge.from,
              toSeriesId: edge.to,
            },
          },
          create: {
            fromSeriesId: edge.from,
            toSeriesId: edge.to,
            similarity: edge.similarity,
            sharedTags: edge.sharedTags,
          },
          update: {
            similarity: edge.similarity,
            sharedTags: edge.sharedTags,
          },
        });
      } catch (error) {
        logger.error('Failed to persist relationship', {
          from: edge.from,
          to: edge.to,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Relationships persisted');
  }

  /**
   * Get existing relationships for a series
   */
  async getRelationships(seriesId: string): Promise<RelationshipEdge[]> {
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [{ fromSeriesId: seriesId }, { toSeriesId: seriesId }],
      },
    });

    return relationships.map(r => ({
      from: r.fromSeriesId,
      to: r.toSeriesId,
      similarity: r.similarity || 0,
      sharedTags: r.sharedTags,
    }));
  }
}
