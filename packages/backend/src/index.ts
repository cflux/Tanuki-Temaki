/**
 * Main entry point - initializes and wires up all services
 */
import { logger } from './lib/logger.js';
import { TagGenerator } from './services/tagGenerator.js';
import { SeriesCacheService } from './services/seriesCache.js';
import { RelationshipTracer } from './services/relationshipTracer.js';
import { adapterRegistry } from './adapters/registry.js';

// Initialize services
export const tagGenerator = new TagGenerator();
export const seriesCache = new SeriesCacheService(adapterRegistry, tagGenerator);
export const relationshipTracer = new RelationshipTracer(seriesCache);

logger.info('Services initialized', {
  adapters: adapterRegistry.getSupportedProviders(),
});

// Export for use in server
export { adapterRegistry };
