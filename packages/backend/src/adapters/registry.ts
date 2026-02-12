import type { IProviderAdapter } from '@tanuki-temaki/shared';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

/**
 * Registry for managing provider adapters
 */
export class AdapterRegistry {
  private adapters: Map<string, IProviderAdapter> = new Map();

  /**
   * Register a provider adapter
   */
  register(adapter: IProviderAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      logger.warn('Overwriting existing adapter', { provider: adapter.provider });
    }

    this.adapters.set(adapter.provider, adapter);
    logger.info('Registered provider adapter', { provider: adapter.provider });
  }

  /**
   * Get adapter for a specific provider name
   */
  getByProvider(provider: string): IProviderAdapter | null {
    return this.adapters.get(provider) || null;
  }

  /**
   * Get adapter that can handle a given URL
   */
  getAdapter(url: string): IProviderAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get adapter that can handle a URL, or throw error
   */
  getAdapterOrThrow(url: string): IProviderAdapter {
    const adapter = this.getAdapter(url);
    if (!adapter) {
      throw new AppError(
        400,
        `No provider adapter found for URL: ${url}. Currently supported: ${this.getSupportedProviders().join(', ')}`
      );
    }
    return adapter;
  }

  /**
   * Get list of all registered providers
   */
  getSupportedProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(provider: string): boolean {
    return this.adapters.has(provider);
  }

  /**
   * Unregister a provider adapter
   */
  unregister(provider: string): boolean {
    const result = this.adapters.delete(provider);
    if (result) {
      logger.info('Unregistered provider adapter', { provider });
    }
    return result;
  }

  /**
   * Get total number of registered adapters
   */
  get size(): number {
    return this.adapters.size;
  }
}

// Export singleton instance
export const adapterRegistry = new AdapterRegistry();
