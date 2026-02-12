import browser from 'webextension-polyfill';
import { WS_URL, RECONNECT_INTERVAL, MAX_RECONNECT_ATTEMPTS, log, logError } from '../config';
import type { BackgroundMessage, ContentResponse } from '../types';

/**
 * Background service worker
 * Maintains WebSocket connection to backend and routes messages
 */
class BackgroundService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, (response: any) => void>();

  constructor() {
    this.connect();
    this.setupMessageHandlers();
  }

  /**
   * Connect to backend WebSocket
   */
  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      log('Already connected to backend');
      return;
    }

    try {
      log(`Connecting to backend at ${WS_URL}...`);
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        log('Connected to backend!');
        this.reconnectAttempts = 0;
        this.updateBadge('connected');
      };

      this.ws.onmessage = (event) => {
        this.handleBackendMessage(event.data);
      };

      this.ws.onerror = (error) => {
        logError('WebSocket error:', error);
        this.updateBadge('error');
      };

      this.ws.onclose = () => {
        log('Disconnected from backend');
        this.updateBadge('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      logError('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logError('Max reconnect attempts reached');
      this.updateBadge('failed');
      return;
    }

    this.reconnectAttempts++;
    log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, RECONNECT_INTERVAL);
  }

  /**
   * Handle message from backend
   */
  private handleBackendMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      log('Received message from backend:', message);

      const { requestId } = message;

      // Forward to content script
      this.forwardToContentScript(message);
    } catch (error) {
      logError('Error handling backend message:', error);
    }
  }

  /**
   * Forward backend request to content script
   */
  private async forwardToContentScript(message: BackgroundMessage): Promise<void> {
    try {
      // Find active Crunchyroll tab
      const tabs = await browser.tabs.query({
        url: '*://www.crunchyroll.com/series/*',
      });

      if (tabs.length === 0) {
        logError('No Crunchyroll series tab found');
        this.sendToBackend({
          requestId: message.requestId,
          error: 'No active Crunchyroll series tab found. Please open a series page.',
        });
        return;
      }

      // Use the first matching tab (usually the active one)
      const tab = tabs[0];
      if (!tab.id) {
        logError('Tab has no ID');
        this.sendToBackend({
          requestId: message.requestId,
          error: 'Invalid tab',
        });
        return;
      }

      log(`Forwarding request to tab ${tab.id}`);

      // Send message to content script
      const response = await browser.tabs.sendMessage(tab.id, message);

      // Send response back to backend
      this.sendToBackend(response);
    } catch (error) {
      logError('Error forwarding to content script:', error);
      this.sendToBackend({
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send response back to backend
   */
  private sendToBackend(response: ContentResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logError('Cannot send to backend: not connected');
      return;
    }

    try {
      log('Sending response to backend:', response.requestId);
      this.ws.send(JSON.stringify(response));
    } catch (error) {
      logError('Error sending to backend:', error);
    }
  }

  /**
   * Update extension badge to show connection status
   */
  private updateBadge(status: 'connected' | 'disconnected' | 'error' | 'failed'): void {
    const badges = {
      connected: { text: '✓', color: '#4CAF50' },
      disconnected: { text: '!', color: '#FF9800' },
      error: { text: '✗', color: '#F44336' },
      failed: { text: '✗', color: '#9E9E9E' },
    };

    const badge = badges[status];
    browser.action.setBadgeText({ text: badge.text });
    browser.action.setBadgeBackgroundColor({ color: badge.color });
  }

  /**
   * Setup message handlers from popup/content scripts
   */
  private setupMessageHandlers(): void {
    browser.runtime.onMessage.addListener((message, sender) => {
      if (message.type === 'GET_STATUS') {
        return Promise.resolve({
          connected: this.ws?.readyState === WebSocket.OPEN,
          reconnectAttempts: this.reconnectAttempts,
        });
      }
    });
  }
}

// Initialize background service
log('Background service worker starting...');
const service = new BackgroundService();

// Keep service worker alive
browser.runtime.onStartup.addListener(() => {
  log('Browser started, reinitializing service');
});
