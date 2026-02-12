import type { ExtractedSeriesData, ExtractedRelatedSeries } from '../types';
import { log, logError } from '../config';

/**
 * Crunchyroll data extractor
 * Extracts series data from Crunchyroll series pages
 */
export class CrunchyrollExtractor {
  /**
   * Extract series data from current page
   */
  extractSeriesData(): ExtractedSeriesData | null {
    try {
      log('Extracting series data from Crunchyroll page');

      // Crunchyroll changed their structure - now using JSON-LD instead of __NEXT_DATA__
      const jsonLdScript = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .find(script => script.textContent?.includes(window.location.pathname));

      if (!jsonLdScript?.textContent) {
        logError('Could not find JSON-LD script tag with series data');
        return null;
      }

      const jsonLd = JSON.parse(jsonLdScript.textContent);

      // Extract series ID from URL
      const urlMatch = window.location.pathname.match(/\/series\/([^\/]+)/);
      const seriesId = urlMatch ? urlMatch[1] : '';

      if (!seriesId) {
        logError('Could not extract series ID from URL');
        return null;
      }

      // Extract genres from DOM (they're not in JSON-LD)
      const genres = this.extractGenresFromDOM();

      // Extract age rating from DOM
      const ageRating = this.extractAgeRatingFromDOM();

      log('Successfully extracted series data:', jsonLd.name);

      return {
        id: seriesId,
        externalId: seriesId,
        url: window.location.href.split('?')[0],
        title: jsonLd.name?.replace('Watch ', '') || 'Unknown Title',
        titleImage: jsonLd.image || undefined,
        description: jsonLd.description || '',
        rating: jsonLd.aggregateRating?.ratingValue
          ? parseFloat(jsonLd.aggregateRating.ratingValue)
          : undefined,
        ageRating,
        languages: [], // Not available in new structure
        genres,
        contentAdvisory: [], // Not easily accessible in new structure
        raw: jsonLd,
      };
    } catch (error) {
      logError('Error extracting series data:', error);
      return null;
    }
  }

  /**
   * Extract genres from DOM elements
   */
  private extractGenresFromDOM(): string[] {
    try {
      // Find genre elements - they appear in a specific section
      const genreLinks = Array.from(
        document.querySelectorAll('a[href*="/genre/"]')
      );

      const genres = genreLinks
        .map(el => el.textContent?.trim())
        .filter((genre): genre is string =>
          !!genre &&
          genre.length > 0 &&
          !genre.includes('|') &&
          !genre.includes(',')
        );

      // Remove duplicates
      return [...new Set(genres)];
    } catch (error) {
      logError('Error extracting genres:', error);
      return [];
    }
  }

  /**
   * Extract age rating from DOM
   */
  private extractAgeRatingFromDOM(): string | undefined {
    try {
      // Look for maturity rating text
      const ratingText = document.body.textContent || '';

      // Common Crunchyroll ratings
      const ratings = [
        'Not recommended for minors under fourteen',
        'TV-14',
        'TV-MA',
        'TV-PG',
        'TV-G',
        'R',
        'PG-13',
      ];

      for (const rating of ratings) {
        if (ratingText.includes(rating)) {
          // Normalize to standard format
          if (rating.includes('fourteen')) return 'TV-14';
          return rating;
        }
      }

      return undefined;
    } catch (error) {
      logError('Error extracting age rating:', error);
      return undefined;
    }
  }

  /**
   * Extract related series URLs from "More like this" section
   */
  extractRelatedSeries(): ExtractedRelatedSeries {
    try {
      log('Extracting related series URLs');

      const urls = new Set<string>();

      // Get current series ID to exclude self-links
      const currentSeriesId = window.location.pathname.match(/\/series\/([^\/]+)/)?.[1];

      // Method 1: Look for "More like this" or similar/recommended sections
      const sections = [
        '[class*="similar"]',
        '[class*="recommend"]',
        '[class*="related"]',
        '[data-t="more-like-this"]',
      ];

      for (const selector of sections) {
        const section = document.querySelector(selector);
        if (section) {
          const links = section.querySelectorAll('a[href*="/series/"]');
          links.forEach(link => {
            const href = (link as HTMLAnchorElement).href;
            if (href.includes('/series/') && !href.includes(currentSeriesId || '')) {
              urls.add(href.split('?')[0]); // Remove query params
            }
          });

          if (urls.size > 0) {
            log(`Found ${urls.size} related series in section: ${selector}`);
            break; // Found results, no need to check other sections
          }
        }
      }

      // Method 2: Fallback - get all unique series links on page (excluding current)
      if (urls.size === 0) {
        log('No specific section found, using fallback method');
        const allSeriesLinks = document.querySelectorAll('a[href*="/series/"]');
        allSeriesLinks.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          if (href.includes('/series/') && !href.includes(currentSeriesId || '')) {
            urls.add(href.split('?')[0]);
          }
        });
      }

      log(`Found ${urls.size} related series URLs`);

      return {
        urls: Array.from(urls),
      };
    } catch (error) {
      logError('Error extracting related series:', error);
      return { urls: [] };
    }
  }

  /**
   * Extract title image from series data
   */
  private extractTitleImage(series: any): string | undefined {
    // Try different image sources
    if (series.titleImage) return series.titleImage;
    if (series.images?.poster_tall?.[0]?.[0]?.source)
      return series.images.poster_tall[0][0].source;
    if (series.images?.poster_wide?.[0]?.[0]?.source)
      return series.images.poster_wide[0][0].source;
    return undefined;
  }

  /**
   * Parse rating to number
   */
  private parseRating(rating: any): number | undefined {
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') {
      const parsed = parseFloat(rating);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Extract age rating
   */
  private extractAgeRating(series: any): string | undefined {
    if (series.ageRating) return series.ageRating;
    if (Array.isArray(series.maturity_ratings) && series.maturity_ratings.length > 0) {
      return series.maturity_ratings[0];
    }
    return undefined;
  }
}
