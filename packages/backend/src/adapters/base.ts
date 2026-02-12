import type { IProviderAdapter } from '@tanuki-temaki/shared';

export type { IProviderAdapter };

/**
 * Base adapter class with common utilities
 */
export abstract class BaseAdapter implements IProviderAdapter {
  abstract readonly provider: string;

  abstract canHandle(url: string): boolean;
  abstract parseUrl(url: string): { id: string; metadata?: any };
  abstract fetchSeries(id: string): Promise<any>;
  abstract fetchRelatedSeries(id: string): Promise<string[]>;

  /**
   * Validate URL format
   */
  protected validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Clean URL by removing query parameters and fragments
   */
  protected cleanUrl(url: string): string {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  }
}
