import { logger } from '../lib/logger.js';
import { GenreCollectionService } from './genreCollection.js';
import { CACHE_EXPIRATION } from '../config/constants.js';

/**
 * Scheduler service for periodic tasks
 */
export class Scheduler {
  private static intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scheduled tasks
   */
  static start(): void {
    logger.info('Starting scheduled tasks');

    // Refresh genre collection once a week (every 7 days)
    const genreRefreshInterval = setInterval(async () => {
      try {
        await GenreCollectionService.refreshGenreCollection();
      } catch (error) {
        logger.error('Failed to refresh genre collection (scheduled task)', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, CACHE_EXPIRATION.GENRE_COLLECTION);

    this.intervals.push(genreRefreshInterval);

    // Initial fetch on startup (async, don't wait)
    GenreCollectionService.getGenreCollection()
      .then(() => logger.info('Genre collection initialized on startup'))
      .catch((error) =>
        logger.error('Failed to initialize genre collection on startup', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );

    logger.info('Scheduled tasks started', {
      genreRefreshIntervalMs: CACHE_EXPIRATION.GENRE_COLLECTION,
    });
  }

  /**
   * Stop all scheduled tasks (for graceful shutdown)
   */
  static stop(): void {
    logger.info('Stopping scheduled tasks');

    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    logger.info('All scheduled tasks stopped');
  }
}
