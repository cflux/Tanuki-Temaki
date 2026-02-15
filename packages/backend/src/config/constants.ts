/**
 * Centralized constants for the backend application
 * This file consolidates all hardcoded values to improve maintainability
 */

// ============================================================================
// API URLs
// ============================================================================

export const ANILIST_API_URL = 'https://graphql.anilist.co';

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// ============================================================================
// Server Ports
// ============================================================================

export const HTTP_PORT = Number(process.env.PORT) || 3000;

export const WS_PORT = Number(process.env.WS_PORT) || 8765;

// ============================================================================
// Time Durations (in milliseconds)
// ============================================================================

export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000; // 900,000ms
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000ms
export const FIVE_SECONDS_MS = 5000;
export const THIRTY_SECONDS_MS = 30000;
export const EIGHT_SECONDS_MS = 8000;
export const FIFTEEN_SECONDS_MS = 15000;
export const TWENTY_FIVE_SECONDS_MS = 25000;
export const FORTY_SECONDS_MS = 40000;

// ============================================================================
// Rate Limiting
// ============================================================================

// AniList API rate limiting
export const ANILIST_MIN_REQUEST_INTERVAL = FIVE_SECONDS_MS;
export const ANILIST_INITIAL_LIMIT = 90; // AniList's default rate limit

// Application-wide rate limiting
export const RATE_LIMIT_WINDOW_MS = FIFTEEN_MINUTES_MS;
export const RATE_LIMIT_MAX_REQUESTS = 2000;

// ============================================================================
// Cookie Configuration
// ============================================================================

export const COOKIE_CONFIG = {
  ACCESS_TOKEN: {
    name: 'access_token',
    maxAge: FIFTEEN_MINUTES_MS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
  REFRESH_TOKEN: {
    name: 'refresh_token',
    maxAge: SEVEN_DAYS_MS,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
} as const;

// ============================================================================
// HTTP Headers
// ============================================================================

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
} as const;

// ============================================================================
// Cache Expiration
// ============================================================================

export const CACHE_EXPIRATION = {
  GENRE_COLLECTION: SEVEN_DAYS_MS,
  SERIES_DATA: SEVEN_DAYS_MS,
  RELATIONSHIP_TRACE: SEVEN_DAYS_MS,
} as const;

// ============================================================================
// AniList Query Parameters
// ============================================================================

export const ANILIST_CONFIG = {
  TAG_RANK_THRESHOLD: 60,
  TOP_TAGS_LIMIT: 10,
} as const;

// ============================================================================
// API Delays and Retry Logic
// ============================================================================

export const API_DELAYS = {
  RATE_LIMIT_RETRY: 1000, // 1 second delay before retrying when rate limited
} as const;
