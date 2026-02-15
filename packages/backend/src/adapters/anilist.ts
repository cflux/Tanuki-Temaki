import { GraphQLClient, gql } from 'graphql-request';
import { logger } from '../lib/logger.js';
import type { RawSeriesData } from '@tanuki-temaki/shared';
import {
  ANILIST_API_URL,
  ANILIST_MIN_REQUEST_INTERVAL,
  ANILIST_INITIAL_LIMIT,
  JSON_HEADERS,
  THIRTY_SECONDS_MS,
  EIGHT_SECONDS_MS,
  ANILIST_CONFIG,
} from '../config/constants.js';
import { fetchAniList } from './anilistClient.js';
import { buildGenreSearchQuery, buildTagSearchQuery } from './graphql/fragments.js';

/**
 * AniList adapter for fetching anime data
 * Uses AniList's GraphQL API to get comprehensive anime metadata and relationships
 */
export class AniListAdapter {
  private client: GraphQLClient;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = ANILIST_MIN_REQUEST_INTERVAL;
  private rateLimitCallback?: (waitTimeMs: number, attempt: number, maxRetries: number) => void;
  private rateLimitRemaining: number = ANILIST_INITIAL_LIMIT;
  private rateLimitReset: number = 0; // Unix timestamp when limit resets

  constructor() {
    this.client = new GraphQLClient(ANILIST_API_URL, {
      headers: JSON_HEADERS,
    });
  }

  /**
   * Set callback to be notified when rate limited
   */
  setRateLimitCallback(callback: (waitTimeMs: number, attempt: number, maxRetries: number) => void): void {
    this.rateLimitCallback = callback;
  }

  /**
   * Rate limit helper - dynamically adjusts delay based on remaining requests
   * As we approach the rate limit, we slow down aggressively to avoid 429 (65s penalty)
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Calculate dynamic delay based on remaining requests
    // Be very aggressive - avoiding 429 is critical (65s penalty vs slower requests)
    let requiredDelay = this.MIN_REQUEST_INTERVAL;

    if (this.rateLimitRemaining <= 3) {
      // Critical - slow down drastically (30 seconds between requests)
      requiredDelay = THIRTY_SECONDS_MS;
      logger.warn(`Critical rate limit (${this.rateLimitRemaining} remaining): 30s delay`);
    } else if (this.rateLimitRemaining <= 8) {
      // Very low - slow down significantly (20 seconds between requests)
      requiredDelay = 20000;
      logger.info(`Very low rate limit (${this.rateLimitRemaining} remaining): 20s delay`);
    } else if (this.rateLimitRemaining <= 15) {
      // Low - slow down moderately (12 seconds between requests)
      requiredDelay = 12000;
      logger.info(`Low rate limit (${this.rateLimitRemaining} remaining): 12s delay`);
    } else if (this.rateLimitRemaining <= 25) {
      // Getting low - slow down (8 seconds between requests)
      requiredDelay = EIGHT_SECONDS_MS;
      logger.info(`Rate limit getting low (${this.rateLimitRemaining} remaining): 8s delay`);
    } else if (this.rateLimitRemaining <= 40) {
      // Starting to slow down (5 seconds between requests)
      requiredDelay = ANILIST_MIN_REQUEST_INTERVAL;
      logger.debug(`Slowing down (${this.rateLimitRemaining} remaining): 5s delay`);
    }

    if (timeSinceLastRequest < requiredDelay) {
      const delay = requiredDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Execute request with smart rate limit handling using AniList headers
   */
  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    onRateLimit?: (waitTimeMs: number, attempt: number, maxRetries: number) => void
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Dynamic rate limiting based on remaining requests
        await this.rateLimit();

        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error (429)
        const is429 = error?.response?.errors?.some((e: any) => e.status === 429) ||
                      error?.message?.includes('Too Many Requests');

        if (is429 && attempt < maxRetries) {
          // AniList rate limits are always 60 seconds according to their docs
          // Unfortunately graphql-request doesn't expose headers in error responses
          // So we use the documented 60-second timeout instead of reading Retry-After

          // If we have a cached reset time from successful responses, use that
          const now = Date.now();
          const SAFETY_BUFFER = 5000; // 5 second buffer to be safe
          let delay: number;

          if (this.rateLimitReset > now) {
            // We have a reset time from previous successful responses
            // Wait until reset time + safety buffer
            delay = Math.max(this.rateLimitReset - now + SAFETY_BUFFER, 5000);
            logger.info(`Using cached rate limit reset time: ${Math.ceil(delay / 1000)}s (includes 5s buffer)`);
          } else {
            // No cached reset time, use AniList's documented 60-second timeout + buffer
            delay = 65000; // 60s + 5s buffer
            // Update our cached reset time
            this.rateLimitReset = now + 60000; // Reset is in 60s, but we'll wait 65s
            logger.info(`Using AniList's documented rate limit timeout: 65s (60s + 5s buffer)`);
          }

          // Reset remaining counter
          this.rateLimitRemaining = 0;

          logger.warn(`Rate limited, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            delaySeconds: Math.ceil(delay / 1000),
            usingCachedReset: this.rateLimitReset > now,
          });

          // Notify callback before waiting
          onRateLimit?.(delay, attempt, maxRetries);

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Not a 429 or out of retries, throw the error
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    // Fetch Headers object uses .get() method
    const remaining = headers.get('x-ratelimit-remaining') || headers.get('X-RateLimit-Remaining');
    const reset = headers.get('x-ratelimit-reset') || headers.get('X-RateLimit-Reset');
    const limit = headers.get('x-ratelimit-limit') || headers.get('X-RateLimit-Limit');

    logger.info('Rate limit headers', {
      limit,
      remaining,
      reset,
    });

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
      logger.info('Updated rate limit remaining', { remaining: this.rateLimitRemaining });
    }
    if (reset) {
      this.rateLimitReset = parseInt(reset, 10) * 1000; // Convert to ms
      logger.info('Updated rate limit reset', { resetAt: new Date(this.rateLimitReset).toISOString() });
    }
  }

  /**
   * Search for media (anime or manga) by title
   */
  async searchMedia(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME', isAdult?: boolean): Promise<AniListMedia | null> {
    try {
      logger.info('Searching AniList for media', { title, mediaType, isAdult });

      const query = gql`
        query ($search: String, $type: MediaType, $isAdult: Boolean) {
          Media(search: $search, type: $type, isAdult: $isAdult) {
            id
            type
            title {
              romaji
              english
              native
            }
            description
            isAdult
            genres
            tags {
              name
              rank
              isMediaSpoiler
            }
            averageScore
            popularity
            format
            status
            episodes
            chapters
            volumes
            duration
            season
            seasonYear
            coverImage {
              large
            }
            externalLinks {
              url
              site
              type
            }
          }
        }
      `;

      const variables: any = { search: title, type: mediaType };
      if (isAdult !== undefined) {
        variables.isAdult = isAdult;
      }
      const data = await this.requestWithRetry(
        () => fetchAniList(query, variables, (headers) => this.updateRateLimitInfo(headers)),
        5,
        this.rateLimitCallback
      );

      if (!data.Media) {
        logger.warn('No media found on AniList', { title, mediaType });
        return null;
      }

      logger.info('Found media on AniList', {
        title,
        mediaType,
        anilistId: data.Media.id,
        anilistTitle: data.Media.title.english || data.Media.title.romaji,
      });

      return data.Media;
    } catch (error) {
      logger.error('Error searching AniList', {
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Search for multiple media results (for user selection)
   */
  async searchMediaMultiple(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME', perPage: number = 10, isAdult?: boolean): Promise<AniListMedia[]> {
    try {
      logger.info('Searching AniList for multiple media', { title, mediaType, perPage, isAdult });

      const query = gql`
        query ($search: String, $type: MediaType, $perPage: Int, $isAdult: Boolean) {
          Page(page: 1, perPage: $perPage) {
            media(search: $search, type: $type, isAdult: $isAdult, sort: SEARCH_MATCH) {
              id
              type
              title {
                romaji
                english
                native
              }
              description
              isAdult
              format
              status
              episodes
              chapters
              volumes
              season
              seasonYear
              startDate {
                year
              }
              coverImage {
                large
                medium
              }
            }
          }
        }
      `;

      const variables: any = { search: title, type: mediaType, perPage };
      if (isAdult !== undefined) {
        variables.isAdult = isAdult;
      }
      const data = await this.requestWithRetry(
        () => fetchAniList(query, variables, (headers) => this.updateRateLimitInfo(headers)),
        5,
        this.rateLimitCallback
      );

      if (!data.Page || !data.Page.media || data.Page.media.length === 0) {
        logger.warn('No media found on AniList', { title, mediaType });
        return [];
      }

      logger.info(`Found ${data.Page.media.length} media results on AniList`, {
        title,
        mediaType,
        count: data.Page.media.length,
        titles: data.Page.media.slice(0, 3).map((m: any) => m.title.english || m.title.romaji),
      });

      return data.Page.media;
    } catch (error) {
      logger.error('Error searching AniList for multiple results', {
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Search for anime by title (convenience wrapper)
   */
  async searchAnime(title: string): Promise<AniListMedia | null> {
    return this.searchMedia(title, 'ANIME');
  }

  /**
   * Search for manga by title (convenience wrapper)
   */
  async searchManga(title: string): Promise<AniListMedia | null> {
    return this.searchMedia(title, 'MANGA');
  }

  /**
   * Get anime by AniList ID with full relationships
   */
  async getAnimeWithRelations(anilistId: number, isAdult?: boolean): Promise<AniListMediaWithRelations | null> {
    try {
      logger.info('Fetching anime with relations from AniList', { anilistId, isAdult });

      const query = gql`
        query ($id: Int, $isAdult: Boolean) {
          Media(id: $id, type: ANIME, isAdult: $isAdult) {
            id
            title {
              romaji
              english
              native
            }
            description
            isAdult
            type
            genres
            tags {
              name
              rank
              isMediaSpoiler
            }
            averageScore
            popularity
            format
            status
            episodes
            chapters
            volumes
            duration
            season
            seasonYear
            coverImage {
              large
            }
            externalLinks {
              url
              site
              type
            }
            relations {
              edges {
                relationType
                node {
                  id
                  title {
                    romaji
                    english
                  }
                  type
                  isAdult
                  format
                  status
                  externalLinks {
                    url
                    site
                    type
                  }
                }
              }
            }
            recommendations(sort: RATING_DESC, perPage: 20) {
              edges {
                node {
                  rating
                  mediaRecommendation {
                    id
                    title {
                      romaji
                      english
                    }
                    type
                    isAdult
                    format
                    status
                    externalLinks {
                      url
                      site
                      type
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables: any = { id: anilistId };
      if (isAdult !== undefined) {
        variables.isAdult = isAdult;
      }
      const data = await this.requestWithRetry(
        () => fetchAniList(query, variables, (headers) => this.updateRateLimitInfo(headers)),
        5,
        this.rateLimitCallback
      );

      if (!data.Media) {
        logger.warn('No anime found on AniList', { anilistId });
        return null;
      }

      // Debug: Log the types of all relations
      const relationTypes = data.Media.relations?.edges?.map(e => ({
        title: e.node.title.english || e.node.title.romaji,
        type: e.node.type,
        relationType: e.relationType,
      })) || [];
      logger.info('Relations from AniList', { relationTypes });

      logger.info('Fetched anime with relations', {
        anilistId,
        relationsCount: data.Media.relations?.edges?.length || 0,
        recommendationsCount: data.Media.recommendations?.edges?.length || 0,
      });

      return data.Media;
    } catch (error) {
      logger.error('Error fetching anime from AniList', {
        anilistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get manga by AniList ID with full relationships
   */
  async getMangaWithRelations(anilistId: number, isAdult?: boolean): Promise<AniListMediaWithRelations | null> {
    try {
      logger.info('Fetching manga with relations from AniList', { anilistId, isAdult });

      const query = gql`
        query ($id: Int, $isAdult: Boolean) {
          Media(id: $id, type: MANGA, isAdult: $isAdult) {
            id
            type
            title {
              romaji
              english
              native
            }
            description
            isAdult
            genres
            tags {
              name
              rank
              isMediaSpoiler
            }
            averageScore
            popularity
            format
            status
            episodes
            chapters
            volumes
            duration
            season
            seasonYear
            coverImage {
              large
            }
            externalLinks {
              url
              site
              type
            }
            relations {
              edges {
                relationType
                node {
                  id
                  title {
                    romaji
                    english
                  }
                  type
                  isAdult
                  format
                  status
                  externalLinks {
                    url
                    site
                    type
                  }
                }
              }
            }
            recommendations(sort: RATING_DESC, perPage: 20) {
              edges {
                node {
                  rating
                  mediaRecommendation {
                    id
                    title {
                      romaji
                      english
                    }
                    type
                    isAdult
                    format
                    status
                    externalLinks {
                      url
                      site
                      type
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables: any = { id: anilistId };
      if (isAdult !== undefined) {
        variables.isAdult = isAdult;
      }
      const data = await this.requestWithRetry(
        () => fetchAniList(query, variables, (headers) => this.updateRateLimitInfo(headers)),
        5,
        this.rateLimitCallback
      );

      if (!data.Media) {
        logger.warn('No manga found on AniList', { anilistId });
        return null;
      }

      logger.info('Fetched manga with relations', {
        anilistId,
        relationsCount: data.Media.relations?.edges?.length || 0,
        recommendationsCount: data.Media.recommendations?.edges?.length || 0,
      });

      return data.Media;
    } catch (error) {
      logger.error('Error fetching manga from AniList', {
        anilistId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Normalize AniList data to our RawSeriesData format
   */
  normalizeToRawSeriesData(
    media: AniListMedia,
    crunchyrollUrl: string
  ): RawSeriesData {
    // Extract Crunchyroll URL from external links if not provided
    const crunchyrollLink = this.extractCrunchyrollLink(media.externalLinks);
    const url = crunchyrollUrl || crunchyrollLink || '';

    // Parse Crunchyroll ID from URL
    // Try new format first: /series/ID
    let crunchyrollId = url.match(/\/series\/([^\/\?]+)/)?.[1];

    // If not found, use old format URL slug or AniList ID as fallback
    if (!crunchyrollId) {
      // Extract slug from old URL format: /title-slug
      const slug = url.match(/crunchyroll\.com\/([^\/\?#]+)\/?$/)?.[1];
      // Use slug if found, otherwise use anilist-{id} as unique identifier
      crunchyrollId = slug || `anilist-${media.id}`;
    }

    // Clean up description (remove HTML tags)
    const description = media.description
      ? media.description.replace(/<[^>]*>/g, '').trim()
      : '';

    // Extract top tags as genres
    const topTags = media.tags
      ?.filter(tag => !tag.isMediaSpoiler && tag.rank >= ANILIST_CONFIG.TAG_RANK_THRESHOLD)
      .map(tag => tag.name)
      .slice(0, ANILIST_CONFIG.TOP_TAGS_LIMIT) || [];

    return {
      provider: 'crunchyroll',
      mediaType: media.type || 'ANIME', // Get from media or default to ANIME
      externalId: crunchyrollId,
      url,
      title: media.title.english || media.title.romaji || media.title.native || 'Unknown',
      titleImage: media.coverImage?.large,
      description,
      rating: media.averageScore ? media.averageScore / 10 : undefined, // Convert 0-100 to 0-10
      ageRating: undefined, // AniList doesn't provide age ratings
      isAdult: media.isAdult,
      languages: [], // Would need to infer from externalLinks or other data
      genres: [...media.genres, ...topTags], // Combine genres and top tags
      contentAdvisory: [], // Not directly available from AniList
      metadata: {
        anilistId: media.id,
        format: media.format,
        status: media.status,
        episodes: media.episodes,
        chapters: media.chapters,
        volumes: media.volumes,
        duration: media.duration,
        season: media.season,
        seasonYear: media.seasonYear,
        popularity: media.popularity,
        tags: media.tags,
      },
    };
  }

  /**
   * Extract Crunchyroll URL from external links
   */
  extractCrunchyrollLink(externalLinks?: ExternalLink[]): string | null {
    if (!externalLinks) return null;

    const crunchyrollLink = externalLinks.find(link =>
      link.site.toLowerCase().includes('crunchyroll')
    );

    return crunchyrollLink?.url || null;
  }

  /**
   * Check if anime is available on Crunchyroll
   */
  isAvailableOnCrunchyroll(externalLinks?: ExternalLink[]): boolean {
    return !!this.extractCrunchyrollLink(externalLinks);
  }

  /**
   * Extract all streaming/reading platform links from external links
   * Returns a map of provider name to URL (includes both video streaming and manga reading platforms)
   */
  extractAllStreamingLinks(externalLinks?: ExternalLink[]): Record<string, string> {
    if (!externalLinks) return {};

    const links: Record<string, string> = {};

    for (const link of externalLinks) {
      // Include any link marked as STREAMING type (covers both video streaming and manga reading platforms)
      if (link.type === 'STREAMING') {
        links[link.site] = link.url;
      }
    }

    return links;
  }

  /**
   * Get related anime filtered by Crunchyroll availability
   */
  getRelatedAnimeCrunchyrollOnly(
    media: AniListMediaWithRelations
  ): RelatedAnimeInfo[] {
    const related: RelatedAnimeInfo[] = [];

    // Add direct relations (sequels, prequels, etc.)
    if (media.relations?.edges) {
      for (const edge of media.relations.edges) {
        if (edge.node.type !== 'ANIME') continue;

        const crunchyrollUrl = this.extractCrunchyrollLink(edge.node.externalLinks);

        related.push({
          anilistId: edge.node.id,
          title: edge.node.title.english || edge.node.title.romaji,
          relationType: edge.relationType || 'RELATED',
          crunchyrollUrl,
          availableOnCrunchyroll: !!crunchyrollUrl,
        });
      }
    }

    // Add recommendations
    if (media.recommendations?.edges) {
      for (const edge of media.recommendations.edges) {
        const rec = edge.node.mediaRecommendation;
        if (!rec || rec.type !== 'ANIME') continue;

        const crunchyrollUrl = this.extractCrunchyrollLink(rec.externalLinks);

        related.push({
          anilistId: rec.id,
          title: rec.title.english || rec.title.romaji,
          relationType: 'RECOMMENDATION',
          crunchyrollUrl,
          availableOnCrunchyroll: !!crunchyrollUrl,
          rating: edge.node.rating,
        });
      }
    }

    logger.info('Filtered related anime', {
      total: related.length,
      availableOnCrunchyroll: related.filter(r => r.availableOnCrunchyroll).length,
    });

    return related;
  }

  /**
   * Get related anime with all streaming platform links
   */
  getRelatedAnimeAllPlatforms(
    media: AniListMediaWithRelations
  ): RelatedAnimeInfoMultiPlatform[] {
    const related: RelatedAnimeInfoMultiPlatform[] = [];

    // Add direct relations (sequels, prequels, etc.)
    if (media.relations?.edges) {
      for (const edge of media.relations.edges) {
        // Include both ANIME and MANGA types
        const streamingLinks = this.extractAllStreamingLinks(edge.node.externalLinks);
        const crunchyrollUrl = this.extractCrunchyrollLink(edge.node.externalLinks);

        related.push({
          anilistId: edge.node.id,
          title: edge.node.title.english || edge.node.title.romaji,
          relationType: edge.relationType || 'RELATED',
          type: edge.node.type,
          streamingLinks,
          crunchyrollUrl, // Keep for backwards compatibility
          availableOnCrunchyroll: !!crunchyrollUrl,
        });
      }
    }

    // Add recommendations
    if (media.recommendations?.edges) {
      for (const edge of media.recommendations.edges) {
        const rec = edge.node.mediaRecommendation;
        if (!rec) continue;

        // Include both ANIME and MANGA types
        const streamingLinks = this.extractAllStreamingLinks(rec.externalLinks);
        const crunchyrollUrl = this.extractCrunchyrollLink(rec.externalLinks);

        related.push({
          anilistId: rec.id,
          title: rec.title.english || rec.title.romaji,
          relationType: 'RECOMMENDATION',
          type: rec.type,
          streamingLinks,
          crunchyrollUrl, // Keep for backwards compatibility
          availableOnCrunchyroll: !!crunchyrollUrl,
          rating: edge.node.rating,
        });
      }
    }

    logger.info('Found related media (anime & manga) with all platforms', {
      total: related.length,
      withStreamingLinks: related.filter(r => Object.keys(r.streamingLinks).length > 0).length,
    });

    return related;
  }

  /**
   * Search for media by tag name
   * Returns top-rated series with the specified tag
   */
  async searchByTag(
    tagName: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    perPage: number = 20
  ): Promise<AniListMedia[]> {
    try {
      // Determine if this is a genre or a tag
      const { GenreCollectionService } = await import('../services/genreCollection.js');
      const isGenre = await GenreCollectionService.isGenre(tagName);

      // Format for AniList (case-sensitive):
      // - Genres: Capitalize each word (e.g., "Action", "Sci-Fi")
      // - Tags: Lowercase (e.g., "female protagonist", "isekai")
      const formattedSearch = isGenre
        ? tagName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
        : tagName.toLowerCase();

      logger.info('Searching AniList by tag/genre', {
        tagName,
        formattedSearch,
        isGenre,
        mediaType,
        perPage
      });

      // Build query conditionally based on whether we're searching genre or tag
      const includeTypeFilter = mediaType !== 'all';
      const query = isGenre
        ? buildGenreSearchQuery(includeTypeFilter)
        : buildTagSearchQuery(includeTypeFilter);

      const variables: any = {
        [isGenre ? 'genre_in' : 'tag_in']: [formattedSearch],
        perPage,
      };

      // Only include type parameter if filtering by specific media type
      if (mediaType !== 'all') {
        variables.type = mediaType;
      }

      logger.info('AniList tag search query', {
        query: query.replace(/\s+/g, ' ').trim(),
        variables: JSON.stringify(variables, null, 2)
      });

      const data = await this.requestWithRetry(
        () => fetchAniList(query, variables, (headers) => this.updateRateLimitInfo(headers)),
        5,
        this.rateLimitCallback
      );

      // Log the response for debugging
      logger.info('AniList tag search response', {
        hasData: !!data,
        mediaCount: data?.Page?.media?.length || 0,
      });

      const results = data?.Page?.media || [];

      logger.info('Found media by tag on AniList', {
        tagName,
        capitalizedTag,
        mediaType,
        count: results.length,
        totalAvailable: data?.Page?.pageInfo?.total,
      });

      return results;
    } catch (error) {
      logger.error('Error searching AniList by tag', {
        tagName,
        capitalizedTag,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

// Types
export interface AniListMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: {
    romaji: string;
    english?: string;
    native?: string;
  };
  description?: string;
  isAdult?: boolean;
  genres: string[];
  tags?: Array<{
    name: string;
    rank: number;
    isMediaSpoiler: boolean;
  }>;
  averageScore?: number;
  popularity?: number;
  format?: string;
  status?: string;
  episodes?: number;
  chapters?: number;
  volumes?: number;
  duration?: number;
  season?: string;
  seasonYear?: number;
  coverImage?: {
    large?: string;
  };
  externalLinks?: ExternalLink[];
}

export interface AniListMediaWithRelations extends AniListMedia {
  relations?: {
    edges: Array<{
      relationType: string;
      node: {
        id: number;
        title: {
          romaji: string;
          english?: string;
        };
        type: string;
        isAdult?: boolean;
        format?: string;
        status?: string;
        externalLinks?: ExternalLink[];
      };
    }>;
  };
  recommendations?: {
    edges: Array<{
      node: {
        rating?: number;
        mediaRecommendation?: {
          id: number;
          title: {
            romaji: string;
            english?: string;
          };
          type: string;
          isAdult?: boolean;
          format?: string;
          status?: string;
          externalLinks?: ExternalLink[];
        };
      };
    }>;
  };
}

export interface ExternalLink {
  url: string;
  site: string;
  type?: string;
}

export interface RelatedAnimeInfo {
  anilistId: number;
  title: string;
  relationType: string;
  crunchyrollUrl: string | null;
  availableOnCrunchyroll: boolean;
  rating?: number;
}

export interface RelatedAnimeInfoMultiPlatform {
  anilistId: number;
  title: string;
  relationType: string;
  type: 'ANIME' | 'MANGA';
  streamingLinks: Record<string, string>; // provider name -> URL
  crunchyrollUrl: string | null; // For backwards compatibility
  availableOnCrunchyroll: boolean;
  rating?: number;
}
