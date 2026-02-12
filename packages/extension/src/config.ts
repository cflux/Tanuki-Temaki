/**
 * Extension configuration
 * API_URL can be configured at build time via environment variable
 */

// WebSocket URL for backend connection
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';

// Connection settings
export const RECONNECT_INTERVAL = 5000; // 5 seconds
export const MAX_RECONNECT_ATTEMPTS = 10;

// Debug mode
export const DEBUG = true; // Temporarily enabled for debugging

export function log(...args: any[]) {
  if (DEBUG) {
    console.log('[Tanuki Temaki]', ...args);
  }
}

export function logError(...args: any[]) {
  console.error('[Tanuki Temaki]', ...args);
}
