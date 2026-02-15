import type { Series } from '@tanuki-temaki/shared';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AdapterRegistry } from '../adapters/registry.js';
import { TagGenerator } from './tagGenerator.js';
import { AniListMatcherService } from './anilistMatcher.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Series caching service with database-first strategy
 * Checks database before fetching from providers
 * Now enriched with AniList data for better metadata and relationships
 */
export class SeriesCacheService {
  private anilistMatcher: AniListMatcherService;

  constructor(
    private adapterRegistry: AdapterRegistry,
    private tagGenerator: TagGenerator
  ) {
    this.anilistMatcher = new AniListMatcherService();
  }

  /**
   * Get series by URL (from cache or fetch)
   */
  async getSeries(url: string, forceRefresh = false): Promise<Series> {
    logger.info('Getting series', { url, forceRefresh });

    // 1. Try to find in database
    if (!forceRefresh) {
      const cached = await this.findInCache(url);
      if (cached) {
        logger.info('Cache hit', { url, id: cached.id });
        return cached;
      }
    }

    // 2. Not in cache - fetch from provider
    logger.info('Cache miss - fetching from provider', { url });
    return await this.fetchAndCache(url);
  }

  /**
   * Get series by ID
   */
  async getSeriesById(id: string): Promise<Series | null> {
    const dbSeries = await prisma.series.findUnique({
      where: { id },
      include: { tags: true },
    });

    if (!dbSeries) {
      return null;
    }

    return this.mapToSeries(dbSeries);
  }

  /**
   * Search series by title
   */
  async searchByTitle(query: string, limit = 10): Promise<Series[]> {
    const dbSeries = await prisma.series.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: { tags: true },
      take: limit,
      orderBy: {
        fetchedAt: 'desc',
      },
    });

    return dbSeries.map(s => this.mapToSeries(s));
  }

  /**
   * Search for a single series by title (searches AniList and caches)
   * Returns the best match from AniList
   */
  async searchAndCacheByTitle(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME', filterAdult?: boolean): Promise<Series> {
    logger.info('Searching for series by title', { title, mediaType, filterAdult });

    // First, check local cache by title (try multiple variations)
    // Normalize search: remove spaces, lowercase for comparison
    const normalizedSearch = title.toLowerCase().replace(/\s+/g, '');

    const allSeries = await prisma.series.findMany({
      where: { mediaType },
      select: {
        id: true,
        title: true,
        mediaType: true,
        // Don't include tags to make this query faster
      },
    });

    logger.info('Local cache check', {
      searchedFor: title,
      normalizedSearch,
      mediaType,
      foundCount: allSeries.length,
      sampleTitles: allSeries.slice(0, 3).map(s => s.title),
    });

    // Find best match by normalized title
    const cachedMatch = allSeries.find(s => {
      const normalizedTitle = s.title.toLowerCase().replace(/\s+/g, '');
      const matches = normalizedTitle.includes(normalizedSearch) || normalizedSearch.includes(normalizedTitle);
      if (matches) {
        logger.info('Match found', {
          dbTitle: s.title,
          normalizedDbTitle: normalizedTitle,
          normalizedSearch,
        });
      }
      return matches;
    });

    if (cachedMatch) {
      logger.info('Found in local cache', {
        id: cachedMatch.id,
        title: cachedMatch.title,
        searchedFor: title,
      });

      // Fetch full series with tags
      const fullSeries = await prisma.series.findUnique({
        where: { id: cachedMatch.id },
        include: { tags: true },
      });

      if (!fullSeries) {
        throw new AppError(500, 'Series not found after cache match');
      }

      return this.mapToSeries(fullSeries);
    }

    // Not in cache - search AniList
    logger.info('Not in cache, searching AniList', { title, mediaType, filterAdult });

    // Search AniList directly
    const anilistAdapter = this.anilistMatcher.getAdapter();
    const isAdult = filterAdult ? false : undefined; // Convert filterAdult flag to AniList parameter
    const searchResult = await anilistAdapter.searchMedia(title, mediaType, isAdult);

    if (!searchResult) {
      throw new AppError(404, `No ${mediaType.toLowerCase()} found with title: ${title}`);
    }

    const anilistId = searchResult.id;

    logger.info('Found AniList match', { anilistId, title: searchResult.title.english || searchResult.title.romaji });

    // Check if we already have this in cache by AniList ID
    const existing = await prisma.series.findFirst({
      where: {
        metadata: {
          path: ['anilistId'],
          equals: anilistId,
        },
      },
      include: { tags: true },
    });

    if (existing) {
      logger.info('Series already in cache by AniList ID', { id: existing.id, title: existing.title });
      return this.mapToSeries(existing);
    }

    // Fetch full data from AniList
    let anilistMedia = mediaType === 'MANGA'
      ? await anilistAdapter.getMangaWithRelations(anilistId)
      : await anilistAdapter.getAnimeWithRelations(anilistId);

    if (!anilistMedia) {
      throw new AppError(500, `Failed to fetch ${mediaType.toLowerCase()} details from AniList`);
    }

    // Follow PREQUEL chain back to the original series
    // This ensures we always use the first season/entry as the root
    let currentMedia = anilistMedia;
    let prequelId: number | null = null;
    const visited = new Set<number>([currentMedia.id]);

    while (true) {
      // Find PREQUEL relation
      const prequelEdge = currentMedia.relations?.edges?.find(
        edge => edge.relationType === 'PREQUEL' && edge.node.type === mediaType
      );

      if (!prequelEdge || !prequelEdge.node.id) break;

      prequelId = prequelEdge.node.id;

      // Prevent infinite loops
      if (visited.has(prequelId)) {
        logger.warn('Circular PREQUEL relation detected', { currentId: currentMedia.id, prequelId });
        break;
      }

      visited.add(prequelId);

      logger.info('Following PREQUEL relation', {
        from: currentMedia.title.english || currentMedia.title.romaji,
        fromId: currentMedia.id,
        toId: prequelId
      });

      // Fetch the prequel
      const prequelMedia = mediaType === 'MANGA'
        ? await anilistAdapter.getMangaWithRelations(prequelId)
        : await anilistAdapter.getAnimeWithRelations(prequelId);

      if (!prequelMedia) break;

      currentMedia = prequelMedia;
    }

    // If we found a different root, use it
    if (currentMedia.id !== anilistMedia.id) {
      logger.info('Using original series instead of sequel', {
        searchedFor: anilistMedia.title.english || anilistMedia.title.romaji,
        searchedId: anilistMedia.id,
        usingTitle: currentMedia.title.english || currentMedia.title.romaji,
        usingId: currentMedia.id,
      });
      anilistMedia = currentMedia;

      // Check if the original is already cached
      const existingOriginal = await prisma.series.findFirst({
        where: {
          metadata: {
            path: ['anilistId'],
            equals: currentMedia.id,
          },
        },
        include: { tags: true },
      });

      if (existingOriginal) {
        logger.info('Original series already in cache', { id: existingOriginal.id, title: existingOriginal.title });
        return this.mapToSeries(existingOriginal);
      }
    }

    // Create a synthetic URL (since we don't have a Crunchyroll URL)
    const syntheticUrl = `anilist://${anilistMedia.id}`;

    // Normalize to RawSeriesData
    const rawData = anilistAdapter.normalizeToRawSeriesData(anilistMedia, syntheticUrl);

    // Extract streaming links
    const streamingLinks = anilistAdapter.extractAllStreamingLinks(anilistMedia.externalLinks);

    // Generate tags
    const generatedTags = this.tagGenerator.generateTags(rawData);

    // Add streaming links to metadata
    const enrichedMetadata = {
      ...rawData.metadata,
      streamingLinks,
    };

    // Store in database
    const dbSeries = await prisma.series.create({
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
        isAdult: rawData.isAdult,
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

    logger.info('Series cached from AniList search', {
      id: dbSeries.id,
      title: dbSeries.title,
      tagCount: dbSeries.tags.length,
    });

    return this.mapToSeries(dbSeries);
  }

  /**
   * Search for multiple series results from AniList for user selection
   * Returns basic info for each result without caching
   */
  async searchMultipleResults(
    title: string,
    mediaType: 'ANIME' | 'MANGA' = 'ANIME',
    limit: number = 10,
    filterAdult?: boolean
  ): Promise<Array<{
    id: string;
    title: string;
    description: string;
    titleImage: string | null;
    mediaType: 'ANIME' | 'MANGA';
    anilistId: number;
    format?: string;
    episodes?: number;
    chapters?: number;
    season?: string;
    year?: number;
  }>> {
    logger.info('Searching AniList for multiple results', { title, mediaType, limit, filterAdult });

    const anilistAdapter = this.anilistMatcher.getAdapter();

    // Search AniList with a higher page limit
    const isAdult = filterAdult ? false : undefined; // Convert filterAdult flag to AniList parameter
    const searchResults = await anilistAdapter.searchMediaMultiple(title, mediaType, limit, isAdult);

    if (!searchResults || searchResults.length === 0) {
      throw new AppError(404, `No ${mediaType.toLowerCase()} found with title: ${title}`);
    }

    logger.info(`Found ${searchResults.length} results from AniList`, {
      titles: searchResults.slice(0, 3).map(r => r.title.english || r.title.romaji),
    });

    // Map to simplified series info
    return searchResults.map(media => ({
      id: `anilist-${media.id}`,
      title: media.title.english || media.title.romaji,
      description: media.description || '',
      titleImage: media.coverImage?.large || media.coverImage?.medium || null,
      mediaType,
      anilistId: media.id,
      format: media.format,
      episodes: media.episodes,
      chapters: media.chapters,
      season: media.season,
      year: media.seasonYear || media.startDate?.year,
    }));
  }

  /**
   * Fetch series by AniList ID (cache if not exists)
   */
  async fetchByAniListId(anilistId: number, mediaType: 'ANIME' | 'MANGA' = 'ANIME'): Promise<Series> {
    logger.info('Fetching series by AniList ID', { anilistId, mediaType });

    // Check if we already have this in cache by AniList ID
    const existing = await prisma.series.findFirst({
      where: {
        metadata: {
          path: ['anilistId'],
          equals: anilistId,
        },
      },
      include: { tags: true },
    });

    if (existing) {
      logger.info('Series already in cache by AniList ID', { id: existing.id, title: existing.title });
      return this.mapToSeries(existing);
    }

    // Not in cache - fetch from AniList
    logger.info('Fetching from AniList', { anilistId, mediaType });

    const anilistAdapter = this.anilistMatcher.getAdapter();
    const anilistMedia = mediaType === 'MANGA'
      ? await anilistAdapter.getMangaWithRelations(anilistId)
      : await anilistAdapter.getAnimeWithRelations(anilistId);

    if (!anilistMedia) {
      throw new AppError(404, `No ${mediaType.toLowerCase()} found with AniList ID: ${anilistId}`);
    }

    // Create a synthetic URL
    const syntheticUrl = `anilist://${anilistMedia.id}`;

    // Normalize to RawSeriesData
    const rawData = anilistAdapter.normalizeToRawSeriesData(anilistMedia, syntheticUrl);

    // Extract streaming links
    const streamingLinks = anilistAdapter.extractAllStreamingLinks(anilistMedia.externalLinks);

    // Generate tags
    const generatedTags = this.tagGenerator.generateTags(rawData);

    // Add streaming links to metadata
    const enrichedMetadata = {
      ...rawData.metadata,
      streamingLinks,
    };

    // Store in database
    const dbSeries = await prisma.series.create({
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
        isAdult: rawData.isAdult,
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

    logger.info('Series cached from AniList ID', {
      id: dbSeries.id,
      title: dbSeries.title,
      anilistId: anilistMedia.id,
      tagCount: dbSeries.tags.length,
    });

    return this.mapToSeries(dbSeries);
  }

  /**
   * Find series in cache by URL
   */
  private async findInCache(url: string): Promise<Series | null> {
    const dbSeries = await prisma.series.findUnique({
      where: { url },
      include: { tags: true },
    });

    if (!dbSeries) {
      return null;
    }

    return this.mapToSeries(dbSeries);
  }

  /**
   * Fetch series from provider and cache it
   * Now enriched with AniList data for better metadata
   */
  private async fetchAndCache(url: string): Promise<Series> {
    // Get appropriate adapter
    const adapter = this.adapterRegistry.getAdapterOrThrow(url);

    // Parse URL to get series ID
    const { id } = adapter.parseUrl(url);

    // Fetch basic data from Crunchyroll (via extension - just title)
    const rawData = await adapter.fetchSeries(id);

    logger.info('Fetched basic series data', {
      url,
      title: rawData.title,
    });

    // Match to AniList and enrich with full metadata
    const anilistId = await this.anilistMatcher.matchToAniList(url, rawData.title);

    if (anilistId) {
      logger.info('Matched to AniList, fetching full data', { anilistId });

      const anilistMedia = await this.anilistMatcher
        .getAdapter()
        .getAnimeWithRelations(anilistId);

      if (anilistMedia) {
        // Use AniList data as primary source, keep Crunchyroll URL
        const enrichedData = this.anilistMatcher
          .getAdapter()
          .normalizeToRawSeriesData(anilistMedia, url);

        // Merge with Crunchyroll data (prioritize AniList for most fields)
        rawData.description = enrichedData.description || rawData.description;
        rawData.rating = enrichedData.rating || rawData.rating;
        rawData.genres = enrichedData.genres;
        rawData.titleImage = enrichedData.titleImage || rawData.titleImage;
        rawData.metadata = {
          ...rawData.metadata,
          ...enrichedData.metadata,
        };

        logger.info('Enriched with AniList data', {
          title: rawData.title,
          genresCount: rawData.genres.length,
        });
      }
    } else {
      logger.warn('No AniList match found, using Crunchyroll data only', {
        title: rawData.title,
      });
    }

    // Generate tags (now from richer AniList data)
    const generatedTags = this.tagGenerator.generateTags(rawData);

    // Store in database (upsert to handle duplicates)
    const dbSeries = await prisma.series.upsert({
      where: { url: rawData.url },
      create: {
        provider: rawData.provider,
        mediaType: rawData.mediaType,
        externalId: rawData.externalId,
        url: rawData.url,
        title: rawData.title,
        titleImage: rawData.titleImage,
        description: rawData.description,
        rating: rawData.rating,
        ageRating: rawData.ageRating,
        isAdult: rawData.isAdult,
        languages: rawData.languages,
        genres: rawData.genres,
        contentAdvisory: rawData.contentAdvisory,
        metadata: rawData.metadata,
        tags: {
          create: generatedTags.map(tag => ({
            value: tag.value,
            source: tag.source,
            confidence: tag.confidence,
            category: tag.category,
          })),
        },
      },
      update: {
        mediaType: rawData.mediaType,
        title: rawData.title,
        titleImage: rawData.titleImage,
        description: rawData.description,
        rating: rawData.rating,
        ageRating: rawData.ageRating,
        isAdult: rawData.isAdult,
        languages: rawData.languages,
        genres: rawData.genres,
        contentAdvisory: rawData.contentAdvisory,
        metadata: rawData.metadata,
        // Delete old tags and create new ones
        tags: {
          deleteMany: {},
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

    logger.info('Series cached', {
      id: dbSeries.id,
      title: dbSeries.title,
      tagCount: dbSeries.tags.length,
    });

    return this.mapToSeries(dbSeries);
  }

  /**
   * Update series in cache
   */
  async updateSeries(id: string, url: string): Promise<Series> {
    logger.info('Updating series in cache', { id, url });

    // Delete existing series and tags
    await prisma.series.delete({
      where: { id },
    });

    // Fetch and cache fresh data
    return await this.fetchAndCache(url);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const totalSeries = await prisma.series.count();
    const totalTags = await prisma.tag.count();
    const totalRelationships = await prisma.relationship.count();

    const providerCounts = await prisma.series.groupBy({
      by: ['provider'],
      _count: true,
    });

    const mediaTypeCounts = await prisma.series.groupBy({
      by: ['mediaType'],
      _count: true,
    });

    return {
      totalSeries,
      totalTags,
      totalRelationships,
      byProvider: providerCounts.map(p => ({
        provider: p.provider,
        count: p._count,
      })),
      byMediaType: mediaTypeCounts.map(m => ({
        mediaType: m.mediaType,
        count: m._count,
      })),
    };
  }

  /**
   * Map database series to domain Series object
   */
  private mapToSeries(dbSeries: any): Series {
    return {
      id: dbSeries.id,
      provider: dbSeries.provider,
      mediaType: dbSeries.mediaType || 'ANIME',
      externalId: dbSeries.externalId,
      url: dbSeries.url,
      title: dbSeries.title,
      titleImage: dbSeries.titleImage,
      description: dbSeries.description,
      rating: dbSeries.rating,
      ageRating: dbSeries.ageRating,
      isAdult: dbSeries.isAdult,
      languages: dbSeries.languages,
      genres: dbSeries.genres,
      contentAdvisory: dbSeries.contentAdvisory,
      tags: dbSeries.tags.map((tag: any) => ({
        id: tag.id,
        value: tag.value,
        source: tag.source,
        confidence: tag.confidence,
        category: tag.category,
      })),
      metadata: dbSeries.metadata,
      fetchedAt: dbSeries.fetchedAt,
      updatedAt: dbSeries.updatedAt,
    };
  }
}
