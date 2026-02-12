import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger.js';
import type { ExtensionRequest, ExtensionResponse } from '@tanuki-temaki/shared';

/**
 * Bridge for communication between backend and browser extension
 * Uses WebSocket for bidirectional real-time communication
 */
export class ExtensionBridge extends EventEmitter {
  private connections: Set<WebSocket> = new Set();
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(private wss: WebSocketServer) {
    super();
    this.setupWebSocketServer();
  }

  /**
   * Setup WebSocket server handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('Extension connected');
      this.connections.add(ws);

      ws.on('message', (message: Buffer) => {
        this.handleMessage(message);
      });

      ws.on('close', () => {
        logger.info('Extension disconnected');
        this.connections.delete(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { error: error.message });
        this.connections.delete(ws);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming messages from extension
   */
  private handleMessage(message: Buffer): void {
    try {
      const response: ExtensionResponse = JSON.parse(message.toString());

      logger.info('Received response from extension', {
        requestId: response.requestId,
      });

      const pending = this.pendingRequests.get(response.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.requestId);

        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response.data);
        }
      } else {
        logger.warn('Received response for unknown request', {
          requestId: response.requestId,
        });
      }
    } catch (error) {
      logger.error('Error handling extension message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send request to extension and wait for response
   */
  async request(payload: Omit<ExtensionRequest, 'requestId'>): Promise<any> {
    if (this.connections.size === 0) {
      throw new Error(
        'No extension connected. Please install and connect the Tanuki Temaki extension.'
      );
    }

    const requestId = this.generateRequestId();
    const request: ExtensionRequest = {
      ...payload,
      requestId,
    };

    logger.info('Sending request to extension', {
      requestId,
      action: payload.action,
    });

    return new Promise((resolve, reject) => {
      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new Error(
            'Extension request timeout. Make sure a Crunchyroll series page is open and the extension is active.'
          )
        );
      }, 30000);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Broadcast to all connected extensions (usually just one)
      this.broadcast(JSON.stringify(request));
    });
  }

  /**
   * Broadcast message to all connected extensions
   */
  private broadcast(message: string): void {
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if any extension is connected
   */
  isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get number of connected extensions
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const ws of this.connections) {
      ws.close();
    }
    this.connections.clear();
    this.pendingRequests.clear();
  }
}
