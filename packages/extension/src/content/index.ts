import browser from 'webextension-polyfill';
import { CrunchyrollExtractor } from './crunchyroll';
import type { BackgroundMessage, ContentResponse } from '../types';
import { log, logError } from '../config';

const extractor = new CrunchyrollExtractor();

/**
 * Handle messages from background script
 */
browser.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender): Promise<ContentResponse> => {
    log('Content script received message:', message.action);

    // Always return a Promise for Firefox compatibility
    return Promise.resolve().then(() => {
      try {
        const { requestId, action } = message;

        switch (action) {
          case 'FETCH_SERIES': {
            const data = extractor.extractSeriesData();
            if (!data) {
              return {
                requestId,
                error: 'Failed to extract series data from page',
              };
            }
            return {
              requestId,
              data,
            };
          }

          case 'FETCH_RELATED': {
            const data = extractor.extractRelatedSeries();
            return {
              requestId,
              data,
            };
          }

          default:
            return {
              requestId,
              error: `Unknown action: ${action}`,
            };
        }
      } catch (error) {
        logError('Error handling message:', error);
        return {
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }
);

log('Content script loaded on Crunchyroll series page');
