/**
 * Main entry point - initializes and wires up all services
 */
import { WebSocketServer } from 'ws';
import { logger } from './lib/logger.js';
import { ExtensionBridge } from './services/extensionBridge.js';
import { TagGenerator } from './services/tagGenerator.js';
import { SeriesCacheService } from './services/seriesCache.js';
import { RelationshipTracer } from './services/relationshipTracer.js';
import { adapterRegistry } from './adapters/registry.js';
import { CrunchyrollAdapter } from './adapters/crunchyroll.js';

const WS_PORT = Number(process.env.WS_PORT) || 8765;

// Initialize WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });
logger.info(`WebSocket server initialized on port ${WS_PORT}`);

// Initialize services
export const extensionBridge = new ExtensionBridge(wss);
export const tagGenerator = new TagGenerator();
export const seriesCache = new SeriesCacheService(adapterRegistry, tagGenerator);
export const relationshipTracer = new RelationshipTracer(seriesCache);

// Register adapters
const crunchyrollAdapter = new CrunchyrollAdapter(extensionBridge);
adapterRegistry.register(crunchyrollAdapter);

logger.info('Services initialized', {
  adapters: adapterRegistry.getSupportedProviders(),
});

// Export for use in server
export { adapterRegistry };
