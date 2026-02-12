import { AniListAdapter } from '../adapters/anilist.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import stringSimilarity from 'string-similarity';

/**
 * Service for matching Crunchyroll series to AniList entries
 * Caches matches in database to avoid repeated lookups
 */
export class AniListMatcherService {
  private anilistAdapter: AniListAdapter;

  constructor() {
    this.anilistAdapter = new AniListAdapter();
  }

  /**
   * Match a Crunchyroll series to AniList by title
   * Returns AniList ID if found, null otherwise
   */
  async matchToAniList(
    crunchyrollUrl: string,
    title: string
  ): Promise<number | null> {
    try {
      // Check if we already have a cached match in metadata
      const cached = await prisma.series.findUnique({
        where: { url: crunchyrollUrl },
        select: { metadata: true },
      });

      if (cached?.metadata && typeof cached.metadata === 'object') {
        const metadata = cached.metadata as Record<string, any>;
        if (metadata.anilistId) {
          logger.info('Using cached AniList match', {
            crunchyrollUrl,
            anilistId: metadata.anilistId,
          });
          return metadata.anilistId;
        }
      }

      // Search AniList for the title
      const anilistMedia = await this.anilistAdapter.searchAnime(title);

      if (!anilistMedia) {
        logger.warn('No AniList match found', { title });
        return null;
      }

      // Verify the match with similarity check
      const titleSimilarity = this.calculateTitleSimilarity(
        title,
        anilistMedia.title
      );

      if (titleSimilarity < 0.7) {
        logger.warn('AniList match has low similarity', {
          title,
          anilistTitle: anilistMedia.title.english || anilistMedia.title.romaji,
          similarity: titleSimilarity,
        });
        // Still return the match, but log the warning
      }

      logger.info('Matched to AniList', {
        crunchyrollTitle: title,
        anilistId: anilistMedia.id,
        anilistTitle: anilistMedia.title.english || anilistMedia.title.romaji,
        similarity: titleSimilarity,
      });

      return anilistMedia.id;
    } catch (error) {
      logger.error('Error matching to AniList', {
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Calculate similarity between Crunchyroll title and AniList titles
   */
  private calculateTitleSimilarity(
    crunchyrollTitle: string,
    anilistTitle: {
      romaji: string;
      english?: string;
      native?: string;
    }
  ): number {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();

    const crTitle = normalize(crunchyrollTitle);

    const titles = [
      anilistTitle.romaji,
      anilistTitle.english,
      anilistTitle.native,
    ].filter(Boolean) as string[];

    const similarities = titles.map(title =>
      stringSimilarity.compareTwoStrings(crTitle, normalize(title))
    );

    return Math.max(...similarities);
  }

  /**
   * Get AniList adapter instance for direct access
   */
  getAdapter(): AniListAdapter {
    return this.anilistAdapter;
  }
}
