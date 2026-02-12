import { RawSeriesData } from './series';

export interface IProviderAdapter {
  readonly provider: string;

  /**
   * Check if this adapter can handle the given URL
   */
  canHandle(url: string): boolean;

  /**
   * Parse provider-specific URL to extract series ID
   */
  parseUrl(url: string): { id: string; metadata?: any };

  /**
   * Fetch series data from provider
   */
  fetchSeries(id: string): Promise<RawSeriesData>;

  /**
   * Fetch related series URLs from provider
   */
  fetchRelatedSeries(id: string): Promise<string[]>;

  /**
   * Search for series by title (optional)
   */
  search?(query: string): Promise<RawSeriesData[]>;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  requiresAuth: boolean;
}
