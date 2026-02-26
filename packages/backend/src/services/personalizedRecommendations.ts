import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { SeriesRelationship, SeriesNode, RelationshipEdge } from '@tanuki-temaki/shared';
import type { RelationshipTracer } from './relationshipTracer.js';

interface UserPreferences {
  userId: string;
  tagPreferences: Record<string, number>; // tag -> score (positive = liked, negative = disliked)
  ratings: Record<string, number>; // seriesId -> rating (0-5)
  availableServices: string[];
}

interface ScoredNode extends SeriesNode {
  personalizedScore: number;
  matchedTags: string[];
  reason?: string;
}

export class PersonalizedRecommendationService {
  constructor(private relationshipTracer?: RelationshipTracer) {}

  /**
   * Get personalized recommendations based on user preferences
   */
  async getPersonalizedRecommendations(
    baseGraph: SeriesRelationship,
    userId: string
  ): Promise<SeriesRelationship> {
    logger.info('Generating personalized recommendations', { userId, rootId: baseGraph.rootId });

    // Fetch user preferences
    const preferences = await this.getUserPreferences(userId);

    if (!preferences) {
      logger.warn('No preferences found for user, returning base graph', { userId });
      return baseGraph;
    }

    // Expand graph for highly-rated series (4-5 stars) using DB relationships (no AniList calls)
    const expandedGraph = await this.expandForHighlyRated(baseGraph, preferences);

    // Score all nodes based on user preferences
    const scoredNodes = this.scoreNodes(expandedGraph.nodes, preferences);

    // Filter and expand based on scores and ratings
    const filteredNodes = this.filterAndExpand(scoredNodes, preferences, expandedGraph);

    // Limit to ~125 results (but always include seed series)
    const limitedNodes = this.limitResults(filteredNodes, 125, expandedGraph.seedSeriesIds);

    logger.info('Personalized recommendations generated', {
      userId,
      originalCount: baseGraph.nodes.length,
      expandedCount: expandedGraph.nodes.length,
      scoredCount: scoredNodes.length,
      filteredCount: filteredNodes.length,
      finalCount: limitedNodes.length,
    });

    return {
      ...expandedGraph,
      nodes: limitedNodes,
      edges: expandedGraph.edges.filter(edge =>
        limitedNodes.some(n => n.series.id === edge.from) &&
        limitedNodes.some(n => n.series.id === edge.to)
      ),
    };
  }

  /**
   * Fetch user preferences from database
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      // Get tag preferences (aggregated votes)
      const tagVotes = await prisma.userTagVote.groupBy({
        by: ['tagValue'],
        where: { userId },
        _sum: { vote: true },
      });

      const tagPreferences: Record<string, number> = {};
      tagVotes.forEach(tv => {
        if (tv._sum.vote) {
          tagPreferences[tv.tagValue] = tv._sum.vote;
        }
      });

      // Get ratings
      const ratings = await prisma.userSeriesRating.findMany({
        where: { userId },
        select: { seriesId: true, rating: true },
      });

      const ratingsMap: Record<string, number> = {};
      ratings.forEach(r => {
        ratingsMap[r.seriesId] = r.rating;
      });

      // Get available services
      const availableServicesPref = await prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId,
            key: 'availableServices'
          }
        },
      });

      const availableServices = availableServicesPref?.value
        ? (availableServicesPref.value as string[])
        : [];

      return {
        userId,
        tagPreferences,
        ratings: ratingsMap,
        availableServices,
      };
    } catch (error) {
      logger.error('Error fetching user preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Expand graph for highly-rated series (4-5 stars)
   * Only includes new series that share upvoted tags with the rated series
   */
  private async expandForHighlyRated(
    baseGraph: SeriesRelationship,
    preferences: UserPreferences
  ): Promise<SeriesRelationship> {
    // Get upvoted tags (positive scores only)
    const upvotedTags = new Set(
      Object.entries(preferences.tagPreferences)
        .filter(([_, score]) => score > 0)
        .map(([tag, _]) => tag)
    );

    // Find highly-rated series (4-5 stars) in the base graph
    const highlyRatedSeries = baseGraph.nodes
      .filter(node => {
        const rating = preferences.ratings[node.series.id];
        return rating === 4 || rating === 5;
      })
      // Sort by number of upvoted tags (tie-breaker: prefer series with more upvoted tags)
      .map(node => ({
        node,
        upvotedTagCount: node.series.tags.filter(t => upvotedTags.has(t.value)).length,
      }))
      .sort((a, b) => b.upvotedTagCount - a.upvotedTagCount)
      .map(item => item.node);

    if (highlyRatedSeries.length === 0) {
      logger.info('No highly-rated series found for expansion');
      return baseGraph;
    }

    // SAFETY: Limit to top 5 highly-rated series (prioritized by upvoted tags) to prevent explosion
    const limitedSeries = highlyRatedSeries.slice(0, 5);

    logger.info('Expanding graph for highly-rated series', {
      totalHighlyRated: highlyRatedSeries.length,
      expanding: limitedSeries.length,
      seriesIds: limitedSeries.map(n => n.series.id),
      upvotedTagsCount: upvotedTags.size,
    });

    const allNodes = new Map<string, SeriesNode>();
    const allEdges = new Map<string, RelationshipEdge>();

    // Add base graph nodes and edges
    baseGraph.nodes.forEach(node => allNodes.set(node.series.id, node));
    baseGraph.edges.forEach(edge => {
      const key = `${edge.from}-${edge.to}`;
      allEdges.set(key, edge);
    });

    // SAFETY: Hard limit on total nodes to prevent memory issues
    const MAX_NODES = 200;

    // Expand each highly-rated series using DB relationships only (no AniList calls)
    for (const ratedNode of limitedSeries) {
      // Stop if we've hit the node limit
      if (allNodes.size >= MAX_NODES) {
        logger.warn('Hit maximum node limit during expansion', { limit: MAX_NODES });
        break;
      }

      try {
        const ratedSeriesTags = new Set(ratedNode.series.tags.map(t => t.value));

        // Query depth-1 neighbors directly from DB
        const depth1Rels = await prisma.relationship.findMany({
          where: { fromSeriesId: ratedNode.series.id },
          include: { toSeries: { include: { tags: true } } },
        });

        const depth1NewIds: string[] = [];
        for (const rel of depth1Rels) {
          if (allNodes.size >= MAX_NODES) break;
          const s = rel.toSeries;
          if (allNodes.has(s.id)) continue;

          const nodeTags = s.tags.map((t: any) => t.value);
          if (!nodeTags.some((tag: string) => upvotedTags.has(tag))) continue;
          if (!nodeTags.some((tag: string) => ratedSeriesTags.has(tag))) continue;

          allNodes.set(s.id, this.buildSeriesNode(s, 1));
          depth1NewIds.push(s.id);
          allEdges.set(`${rel.fromSeriesId}-${rel.toSeriesId}`, {
            from: rel.fromSeriesId,
            to: rel.toSeriesId,
            similarity: rel.similarity ?? 0,
            sharedTags: rel.sharedTags,
          });
        }

        // Query depth-2 neighbors for any newly added depth-1 nodes
        if (depth1NewIds.length > 0 && allNodes.size < MAX_NODES) {
          const depth2Rels = await prisma.relationship.findMany({
            where: { fromSeriesId: { in: depth1NewIds } },
            include: { toSeries: { include: { tags: true } } },
          });

          for (const rel of depth2Rels) {
            if (allNodes.size >= MAX_NODES) break;
            const s = rel.toSeries;
            if (allNodes.has(s.id)) continue;

            const nodeTags = s.tags.map((t: any) => t.value);
            if (!nodeTags.some((tag: string) => upvotedTags.has(tag))) continue;
            if (!nodeTags.some((tag: string) => ratedSeriesTags.has(tag))) continue;

            allNodes.set(s.id, this.buildSeriesNode(s, 2));
            allEdges.set(`${rel.fromSeriesId}-${rel.toSeriesId}`, {
              from: rel.fromSeriesId,
              to: rel.toSeriesId,
              similarity: rel.similarity ?? 0,
              sharedTags: rel.sharedTags,
            });
          }
        }
      } catch (error) {
        logger.error('Failed to expand for series', {
          seriesId: ratedNode.series.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const expandedGraph: SeriesRelationship = {
      ...baseGraph,
      nodes: Array.from(allNodes.values()),
      edges: Array.from(allEdges.values()),
    };

    logger.info('Graph expansion complete', {
      originalNodes: baseGraph.nodes.length,
      expandedNodes: expandedGraph.nodes.length,
      newNodes: expandedGraph.nodes.length - baseGraph.nodes.length,
    });

    return expandedGraph;
  }

  private buildSeriesNode(series: any, depth: number): SeriesNode {
    return {
      series: {
        id: series.id,
        provider: series.provider,
        mediaType: (series.mediaType || 'ANIME') as 'ANIME' | 'MANGA',
        externalId: series.externalId,
        url: series.url,
        title: series.title,
        titleImage: series.titleImage ?? undefined,
        description: series.description,
        rating: series.rating ?? undefined,
        ageRating: series.ageRating ?? undefined,
        languages: series.languages,
        genres: series.genres,
        contentAdvisory: series.contentAdvisory,
        tags: series.tags.map((tag: any) => ({
          id: tag.id,
          value: tag.value,
          source: tag.source,
          confidence: tag.confidence,
          category: tag.category ?? undefined,
        })),
        metadata: (series.metadata as Record<string, any>) ?? {},
        fetchedAt: series.fetchedAt,
        updatedAt: series.updatedAt,
      },
      depth,
    };
  }

  /**
   * Score nodes based on tag preferences
   */
  private scoreNodes(
    nodes: SeriesNode[],
    preferences: UserPreferences
  ): ScoredNode[] {
    return nodes.map(node => {
      const seriesTags = node.series.tags.map(t => t.value);
      let score = 0;
      const matchedTags: string[] = [];
      let reason = '';

      // Calculate tag preference score
      seriesTags.forEach(tag => {
        if (preferences.tagPreferences[tag]) {
          score += preferences.tagPreferences[tag];
          matchedTags.push(tag);
        }
      });

      // Boost score for highly rated series
      const userRating = preferences.ratings[node.series.id];
      if (userRating !== undefined) {
        if (userRating === 5) {
          score += 10; // Significant boost for 5-star
          reason = 'You rated this 5 stars';
        } else if (userRating === 4) {
          score += 5;
          reason = 'You rated this 4 stars';
        } else if (userRating === 0) {
          score -= 100; // Heavy penalty for disliked
          reason = 'You disliked this';
        }
      }

      // Neutral starting point
      const finalScore = score;

      return {
        ...node,
        personalizedScore: finalScore,
        matchedTags,
        reason: reason || (matchedTags.length > 0 ? `Matches tags: ${matchedTags.slice(0, 3).join(', ')}` : undefined),
      };
    });
  }

  /**
   * Filter nodes and expand based on ratings
   */
  private filterAndExpand(
    scoredNodes: ScoredNode[],
    preferences: UserPreferences,
    baseGraph: SeriesRelationship
  ): ScoredNode[] {
    const result: ScoredNode[] = [];
    const excluded = new Set<string>();
    const seedSeriesIds = new Set(baseGraph.seedSeriesIds || []);

    // First pass: exclude disliked series and their children (but NEVER exclude seed series)
    scoredNodes.forEach(node => {
      const userRating = preferences.ratings[node.series.id];
      if (userRating === 0 && !seedSeriesIds.has(node.series.id)) {
        excluded.add(node.series.id);
        // Exclude children too
        this.getChildrenIds(node.series.id, baseGraph).forEach(childId => {
          excluded.add(childId);
        });
      }
    });

    // Second pass: filter by services if specified (but NEVER filter seed series)
    scoredNodes.forEach(node => {
      if (excluded.has(node.series.id)) return;

      // Always include seed series regardless of streaming availability
      if (seedSeriesIds.has(node.series.id)) {
        result.push(node);
        return;
      }

      // Service filter (only for non-seed series)
      if (preferences.availableServices.length > 0) {
        const streamingLinks = (node.series.metadata as any)?.streamingLinks || {};
        const platforms = Object.keys(streamingLinks);

        if (platforms.length > 0) {
          const hasAvailableService = platforms.some(p =>
            preferences.availableServices.includes(p)
          );
          if (!hasAvailableService) return; // Skip if no available services
        }
      }

      result.push(node);
    });

    // Sort by personalized score (highest first)
    result.sort((a, b) => b.personalizedScore - a.personalizedScore);

    return result;
  }

  /**
   * Get all children IDs for a series
   */
  private getChildrenIds(seriesId: string, graph: SeriesRelationship, visited = new Set<string>()): string[] {
    if (visited.has(seriesId)) return [];
    visited.add(seriesId);

    const childrenIds: string[] = [];
    const edges = graph.edges.filter(e => e.from === seriesId);

    edges.forEach(edge => {
      childrenIds.push(edge.to);
      childrenIds.push(...this.getChildrenIds(edge.to, graph, visited));
    });

    return childrenIds;
  }

  /**
   * Limit results to maximum count
   * Always preserves seed series (for tag-based searches) or root node (for single-series searches)
   */
  private limitResults(nodes: ScoredNode[], maxCount: number, seedSeriesIds?: string[]): ScoredNode[] {
    const seedIds = new Set(seedSeriesIds || []);

    // Separate seed/root nodes from other nodes
    const seedNodes = nodes.filter(n => seedIds.has(n.series.id) || n.depth === 0);
    const otherNodes = nodes.filter(n => !seedIds.has(n.series.id) && n.depth !== 0);

    // Take top N other nodes (accounting for seed nodes we're preserving)
    const remainingSlots = Math.max(0, maxCount - seedNodes.length);
    const topNodes = otherNodes.slice(0, remainingSlots);

    return [...seedNodes, ...topNodes];
  }
}
