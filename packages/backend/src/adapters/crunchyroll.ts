import type { RawSeriesData } from '@tanuki-temaki/shared';
import { BaseAdapter } from './base.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

export interface ExtensionBridge {
  request(payload: any): Promise<any>;
}

/**
 * Crunchyroll provider adapter
 * Extracts data via browser extension to bypass Cloudflare
 */
export class CrunchyrollAdapter extends BaseAdapter {
  readonly provider = 'crunchyroll';

  constructor(private extensionBridge: ExtensionBridge) {
    super();
  }

  canHandle(url: string): boolean {
    return /crunchyroll\.com\/series\//.test(url);
  }

  parseUrl(url: string): { id: string; metadata?: any } {
    this.validateUrl(url);

    const match = url.match(/\/series\/([^\/\?]+)/);
    if (!match || !match[1]) {
      throw new AppError(400, 'Invalid Crunchyroll series URL');
    }

    return {
      id: match[1],
      metadata: {
        cleanUrl: this.cleanUrl(url),
      },
    };
  }

  async fetchSeries(id: string): Promise<RawSeriesData> {
    logger.info('Fetching series from Crunchyroll', { id });

    try {
      const rawData = await this.extensionBridge.request({
        action: 'FETCH_SERIES',
        provider: 'crunchyroll',
        seriesId: id,
      });

      if (!rawData || !rawData.id) {
        throw new AppError(
          404,
          'Series not found or failed to extract data from Crunchyroll'
        );
      }

      return this.normalize(rawData);
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error('Failed to fetch series from Crunchyroll', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError(
        500,
        'Failed to fetch series data. Ensure the extension is installed and a Crunchyroll series page is open.'
      );
    }
  }

  async fetchRelatedSeries(id: string): Promise<string[]> {
    logger.info('Fetching related series from Crunchyroll', { id });

    try {
      const rawData = await this.extensionBridge.request({
        action: 'FETCH_RELATED',
        provider: 'crunchyroll',
        seriesId: id,
      });

      if (!rawData || !Array.isArray(rawData.urls)) {
        logger.warn('No related series found', { id });
        return [];
      }

      // Filter to only include Crunchyroll series URLs
      return rawData.urls.filter((url: string) =>
        url.includes('crunchyroll.com/series/')
      );
    } catch (error) {
      logger.error('Failed to fetch related series', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't throw error for related series - just return empty array
      return [];
    }
  }

  /**
   * Normalize Crunchyroll data to common RawSeriesData format
   */
  private normalize(raw: any): RawSeriesData {
    return {
      provider: 'crunchyroll',
      externalId: raw.id || raw.externalId,
      url: raw.url || '',
      title: raw.title || 'Unknown Title',
      titleImage: this.extractTitleImage(raw),
      description: raw.description || raw.extended_description || '',
      rating: this.parseRating(raw.rating),
      ageRating: this.extractAgeRating(raw),
      languages: this.extractLanguages(raw),
      genres: this.extractGenres(raw),
      contentAdvisory: this.extractContentAdvisory(raw),
      metadata: {
        raw: raw, // Store raw data for debugging
        episodeCount: raw.episode_count,
        seasonCount: raw.season_count,
        isDubbed: raw.is_dubbed,
        isSubbed: raw.is_subbed,
      },
    };
  }

  private extractTitleImage(raw: any): string | undefined {
    // Try different image sources
    if (raw.titleImage) return raw.titleImage;
    if (raw.images?.poster_tall?.[0]?.[0]?.source)
      return raw.images.poster_tall[0][0].source;
    if (raw.images?.poster_wide?.[0]?.[0]?.source)
      return raw.images.poster_wide[0][0].source;
    return undefined;
  }

  private parseRating(rating: any): number | undefined {
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private extractAgeRating(raw: any): string | undefined {
    if (raw.ageRating) return raw.ageRating;
    if (Array.isArray(raw.maturity_ratings) && raw.maturity_ratings.length > 0) {
      return raw.maturity_ratings[0];
    }
    return undefined;
  }

  private extractLanguages(raw: any): string[] {
    if (Array.isArray(raw.languages)) return raw.languages;
    if (Array.isArray(raw.audio_locales)) return raw.audio_locales;
    return [];
  }

  private extractGenres(raw: any): string[] {
    if (Array.isArray(raw.genres)) {
      return raw.genres.map((g: any) =>
        typeof g === 'string' ? g : g.name || g.title
      );
    }
    return [];
  }

  private extractContentAdvisory(raw: any): string[] {
    if (Array.isArray(raw.contentAdvisory)) return raw.contentAdvisory;
    if (Array.isArray(raw.content_descriptors)) return raw.content_descriptors;
    return [];
  }
}
