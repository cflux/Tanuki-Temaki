import { prisma } from '../lib/prisma.js';
import type { Series } from '@tanuki-temaki/shared';
import { AniListAdapter } from '../adapters/anilist.js';
import { logger } from '../lib/logger.js';

export class TagSearchService {
  /**
   * Search for tags by name (partial match, case-insensitive)
   */
  static async searchTags(query: string, limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const lowerQuery = query.toLowerCase();

    // Get all series with tags
    const series = await prisma.series.findMany({
      select: {
        metadata: true,
      },
    });

    // Extract and count tags
    const tagCounts = new Map<string, number>();

    for (const s of series) {
      const metadata = s.metadata as any;
      const tags = metadata?.tags || [];

      for (const tag of tags) {
        // Handle both string tags and tag objects (with 'name' or 'value' property)
        const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.value);
        if (!tagStr) continue;

        const tagLower = tagStr.toLowerCase();
        if (tagLower.includes(lowerQuery)) {
          const currentCount = tagCounts.get(tagStr) || 0;
          tagCounts.set(tagStr, currentCount + 1);
        }
      }
    }

    // Sort by count (most popular first) and return
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get all unique tags from the database
   */
  static async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    const series = await prisma.series.findMany({
      select: {
        metadata: true,
      },
    });

    const tagCounts = new Map<string, number>();

    for (const s of series) {
      const metadata = s.metadata as any;
      const tags = metadata?.tags || [];

      for (const tag of tags) {
        // Handle both string tags and tag objects (with 'name' or 'value' property)
        const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.value);
        if (!tagStr) continue;

        const currentCount = tagCounts.get(tagStr) || 0;
        tagCounts.set(tagStr, currentCount + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
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

    const allSeries = await prisma.series.findMany({
      where: mediaType !== 'all' ? { mediaType } : undefined,
      include: {
        tags: true,
      },
    });
    logger.debug('Fetched series from database', { count: allSeries.length });

    // Filter series that have the tag
    logger.debug('Filtering series by tag', { tagValue });

    const seriesWithTag = allSeries.filter((s) => {
      const metadata = s.metadata as any;
      const searchValue = tagValue.toLowerCase();

      // Check metadata.tags (raw tags from AniList - array of objects with 'name' property)
      const metadataTags = metadata?.tags || [];
      const hasMetadataTag = metadataTags.some((tag: any) => {
        // Tags can be strings, or objects with 'name' or 'value' property
        const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.value);
        return tagStr && tagStr.toLowerCase() === searchValue;
      });

      if (hasMetadataTag) return true;

      // Check series.tags (normalized Tag objects)
      // Note: Prisma returns tags as part of the series object if included
      const seriesTags = (s as any).tags || [];
      return seriesTags.some((tag: any) => {
        return tag.value && tag.value.toLowerCase() === searchValue;
      });
    });
    logger.debug('Filtered local series', { matchCount: seriesWithTag.length });

    // If no local results, search AniList as fallback
    if (seriesWithTag.length === 0) {
      logger.info('No local results for tag, searching AniList', { tagValue, mediaType });

      const anilistAdapter = new AniListAdapter();
      const anilistResults = await anilistAdapter.searchByTag(tagValue, mediaType, limit);

      if (anilistResults.length > 0) {
        logger.info('Found series on AniList', {
          tagValue,
          count: anilistResults.length,
        });

        // Cache each series to the database first
        // This ensures they have real database IDs and can be traced properly
        const cachedSeries: Series[] = [];

        for (const media of anilistResults) {
          try {
            // Check if this AniList series is already in our database
            const existing = await prisma.series.findFirst({
              where: {
                metadata: {
                  path: ['anilistId'],
                  equals: media.id,
                },
              },
              include: { tags: true },
            });

            if (existing) {
              // Already in database, use it
              logger.info('AniList series already cached', {
                anilistId: media.id,
                dbId: existing.id,
                title: existing.title,
              });

              cachedSeries.push({
                id: existing.id,
                provider: existing.provider,
                mediaType: (existing.mediaType || media.type) as 'ANIME' | 'MANGA',
                externalId: existing.externalId,
                url: existing.url,
                title: existing.title,
                titleImage: existing.titleImage ?? undefined,
                description: existing.description,
                rating: existing.rating ?? undefined,
                ageRating: existing.ageRating ?? undefined,
                languages: existing.languages,
                genres: existing.genres,
                contentAdvisory: existing.contentAdvisory,
                tags: existing.tags.map((tag: any) => ({
                  id: tag.id,
                  value: tag.value,
                  source: tag.source,
                  confidence: tag.confidence,
                  category: tag.category ?? undefined,
                })),
                metadata: (existing.metadata as Record<string, any>) ?? {},
                fetchedAt: existing.fetchedAt,
                updatedAt: existing.updatedAt,
              });
            } else {
              // Not in database yet - cache it using SeriesCacheService
              // Import SeriesCacheService dynamically to avoid circular dependencies
              const { SeriesCacheService } = await import('./seriesCache.js');
              const { AdapterRegistry } = await import('../adapters/registry.js');
              const { TagGenerator } = await import('./tagGenerator.js');

              const adapterRegistry = new AdapterRegistry();
              const tagGenerator = new TagGenerator();
              const cacheService = new SeriesCacheService(adapterRegistry, tagGenerator);

              logger.info('Caching AniList series to database', {
                anilistId: media.id,
                title: media.title.english || media.title.romaji,
              });

              // Use fetchByAniListId which will cache the series
              const cached = await cacheService.fetchByAniListId(media.id, media.type);
              cachedSeries.push(cached);

              logger.info('Successfully cached AniList series', {
                anilistId: media.id,
                dbId: cached.id,
                title: cached.title,
              });
            }
          } catch (error) {
            logger.error('Failed to cache AniList series', {
              anilistId: media.id,
              title: media.title.english || media.title.romaji,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue with other series instead of failing completely
          }
        }

        logger.info('Cached AniList search results', {
          tagValue,
          found: anilistResults.length,
          cached: cachedSeries.length,
        });

        return cachedSeries.slice(0, limit);
      } else {
        logger.info('No results found on AniList either', { tagValue });
        return [];
      }
    }

    // Sort by popularity metrics (averageScore first, then popularity)
    logger.debug('Sorting series by popularity metrics');
    const sorted = seriesWithTag.sort((a, b) => {
      const aMetadata = a.metadata as any;
      const bMetadata = b.metadata as any;

      const aScore = aMetadata?.averageScore || 0;
      const bScore = bMetadata?.averageScore || 0;

      if (aScore !== bScore) {
        return bScore - aScore; // Higher score first
      }

      const aPopularity = aMetadata?.popularity || 0;
      const bPopularity = bMetadata?.popularity || 0;

      return bPopularity - aPopularity; // Higher popularity first
    });

    const result = sorted.slice(0, limit) as Series[];
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
    const allSeries = await prisma.series.findMany({
      select: {
        metadata: true,
      },
    });

    return allSeries.filter((s) => {
      const metadata = s.metadata as any;
      const tags = metadata?.tags || [];
      const searchValue = tagValue.toLowerCase();

      return tags.some((tag: any) => {
        const tagStr = typeof tag === 'string' ? tag : (tag?.name || tag?.value);
        return tagStr && tagStr.toLowerCase() === searchValue;
      });
    }).length;
  }
}
