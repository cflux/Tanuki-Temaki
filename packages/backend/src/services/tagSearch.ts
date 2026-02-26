import { prisma } from '../lib/prisma.js';
import type { Series } from '@tanuki-temaki/shared';
import { anilistAdapter } from '../adapters/anilist.js';
import { logger } from '../lib/logger.js';
import { seriesCache } from '../index.js';

export class TagSearchService {
  /**
   * Search for tags by name (partial match, case-insensitive)
   */
  static async searchTags(query: string, limit = 20): Promise<Array<{ tag: string; count: number }>> {
    // Query the Tag table directly with case-insensitive partial match
    const results = await prisma.tag.groupBy({
      by: ['value'],
      where: {
        value: { contains: query, mode: 'insensitive' },
      },
      _count: { value: true },
      orderBy: { _count: { value: 'desc' } },
      take: limit,
    });

    return results.map((r) => ({ tag: r.value, count: r._count.value }));
  }

  /**
   * Get all unique tags from the database
   */
  static async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    const results = await prisma.tag.groupBy({
      by: ['value'],
      _count: { value: true },
      orderBy: { _count: { value: 'desc' } },
    });

    return results.map((r) => ({ tag: r.value, count: r._count.value }));
  }

  /**
   * Get top-rated series for a specific tag
   * Uses global popularity metrics from AniList (averageScore, popularity)
   */
  static async getTopSeriesForTag(
    tagValue: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    limit = 20
  ): Promise<Series[]> {
    logger.debug('Starting tag search', { tagValue, mediaType, limit });

    // Query through the Tag table with a join to Series
    const matchingTags = await prisma.tag.findMany({
      where: {
        value: { equals: tagValue, mode: 'insensitive' },
        ...(mediaType !== 'all' ? { series: { mediaType } } : {}),
      },
      include: {
        series: { include: { tags: true } },
      },
    });

    const seriesWithTag = matchingTags.map((t) => t.series);
    logger.debug('Found series with tag', { matchCount: seriesWithTag.length });

    // If no local results, search AniList as fallback
    if (seriesWithTag.length === 0) {
      logger.info('No local results for tag, searching AniList', { tagValue, mediaType });

      // Use shared singleton anilistAdapter
      const anilistResults = await anilistAdapter.searchByTag(tagValue, mediaType, limit);

      if (anilistResults.length === 0) {
        logger.info('No results found on AniList either', { tagValue });
        return [];
      }

      logger.info('Found series on AniList', { tagValue, count: anilistResults.length });

      const cachedSeries: Series[] = [];

      for (const media of anilistResults) {
        try {
          logger.info('Caching AniList series to database', {
            anilistId: media.id,
            title: media.title.english || media.title.romaji,
          });

          // Use the shared seriesCache singleton to fetch/cache
          const cached = await seriesCache.fetchByAniListId(media.id, media.type);
          cachedSeries.push(cached);

          logger.info('Successfully cached AniList series', {
            anilistId: media.id,
            dbId: cached.id,
            title: cached.title,
          });
        } catch (error) {
          logger.error('Failed to cache AniList series', {
            anilistId: media.id,
            title: media.title.english || media.title.romaji,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Cached AniList search results', {
        tagValue,
        found: anilistResults.length,
        cached: cachedSeries.length,
      });

      return cachedSeries.slice(0, limit);
    }

    // Sort by popularity metrics (averageScore first, then popularity)
    const sorted = seriesWithTag.sort((a, b) => {
      const aMetadata = a.metadata as any;
      const bMetadata = b.metadata as any;

      const aScore = aMetadata?.averageScore || 0;
      const bScore = bMetadata?.averageScore || 0;

      if (aScore !== bScore) return bScore - aScore;

      const aPopularity = aMetadata?.popularity || 0;
      const bPopularity = bMetadata?.popularity || 0;

      return bPopularity - aPopularity;
    });

    const result = sorted.slice(0, limit) as unknown as Series[];
    logger.debug('Returning top series for tag', { count: result.length, tagValue });
    return result;
  }

  /**
   * Get top series IDs for a tag (helper for recommendation generation)
   */
  static async getTopSeriesIdsForTag(
    tagValue: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    limit = 5
  ): Promise<string[]> {
    const topSeries = await this.getTopSeriesForTag(tagValue, mediaType, limit);
    return topSeries.map((s) => s.id);
  }

  /**
   * Get series count for a tag
   */
  static async getSeriesCountForTag(tagValue: string): Promise<number> {
    return prisma.tag.count({
      where: { value: { equals: tagValue, mode: 'insensitive' } },
    });
  }
}
