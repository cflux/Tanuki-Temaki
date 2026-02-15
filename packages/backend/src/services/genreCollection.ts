import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { gql } from 'graphql-request';

const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * Service to manage AniList's genre collection
 * Genres are a fixed set defined by AniList, while tags are user-generated
 */
export class GenreCollectionService {
  private static genreCache: Set<string> | null = null;
  private static lastFetch: Date | null = null;
  private static readonly CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Fetch the genre collection from AniList
   */
  static async fetchGenreCollection(): Promise<string[]> {
    logger.info('Fetching genre collection from AniList');

    const query = gql`
      query {
        GenreCollection
      }
    `;

    try {
      const response = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`AniList GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const genres: string[] = data.data.GenreCollection || [];
      logger.info('Fetched genre collection', { count: genres.length, genres });

      return genres;
    } catch (error) {
      logger.error('Failed to fetch genre collection from AniList', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Store genre collection in database
   */
  static async storeGenreCollection(genres: string[]): Promise<void> {
    try {
      // Store as a single JSON record in a configuration table
      await prisma.$executeRaw`
        INSERT INTO "Configuration" (key, value, updated_at)
        VALUES ('anilist_genres', ${JSON.stringify(genres)}::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = ${JSON.stringify(genres)}::jsonb, updated_at = NOW()
      `;

      logger.info('Stored genre collection in database', { count: genres.length });
    } catch (error) {
      logger.error('Failed to store genre collection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Load genre collection from database
   */
  static async loadGenreCollectionFromDB(): Promise<string[] | null> {
    try {
      const result = await prisma.$queryRaw<Array<{ value: any }>>`
        SELECT value FROM "Configuration" WHERE key = 'anilist_genres'
      `;

      if (result.length === 0) {
        return null;
      }

      const genres = result[0].value;
      logger.debug('Loaded genre collection from database', { count: genres.length });

      return genres;
    } catch (error) {
      // Table might not exist yet - return null
      logger.debug('Could not load genre collection from database', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the genre collection (from cache, database, or fetch fresh)
   */
  static async getGenreCollection(): Promise<Set<string>> {
    // Return from memory cache if fresh
    if (
      this.genreCache &&
      this.lastFetch &&
      Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION_MS
    ) {
      logger.debug('Using cached genre collection', { count: this.genreCache.size });
      return this.genreCache;
    }

    // Try loading from database
    const dbGenres = await this.loadGenreCollectionFromDB();
    if (dbGenres && dbGenres.length > 0) {
      this.genreCache = new Set(dbGenres.map(g => g.toLowerCase()));
      this.lastFetch = new Date();
      logger.info('Loaded genre collection from database', { count: this.genreCache.size });
      return this.genreCache;
    }

    // Fetch fresh from AniList
    const freshGenres = await this.fetchGenreCollection();
    await this.storeGenreCollection(freshGenres);

    this.genreCache = new Set(freshGenres.map(g => g.toLowerCase()));
    this.lastFetch = new Date();

    logger.info('Fetched and cached fresh genre collection', { count: this.genreCache.size });

    return this.genreCache;
  }

  /**
   * Check if a string is a genre (case-insensitive)
   */
  static async isGenre(searchTerm: string): Promise<boolean> {
    const genres = await this.getGenreCollection();
    return genres.has(searchTerm.toLowerCase());
  }

  /**
   * Refresh the genre collection (called by scheduled task)
   */
  static async refreshGenreCollection(): Promise<void> {
    logger.info('Refreshing genre collection (scheduled task)');

    try {
      const freshGenres = await this.fetchGenreCollection();
      await this.storeGenreCollection(freshGenres);

      this.genreCache = new Set(freshGenres.map(g => g.toLowerCase()));
      this.lastFetch = new Date();

      logger.info('Successfully refreshed genre collection', { count: freshGenres.length });
    } catch (error) {
      logger.error('Failed to refresh genre collection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
