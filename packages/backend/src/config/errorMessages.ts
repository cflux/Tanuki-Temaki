/**
 * Centralized error messages
 * Ensures consistent error messages across the application
 */

// Auth errors
export const AUTH_ERRORS = {
  USER_NOT_FOUND: 'User not found',
  INVALID_CREDENTIALS: 'Invalid credentials',
  UNAUTHORIZED: 'Unauthorized',
  TOKEN_EXPIRED: 'Token expired',
  FAILED_TO_FETCH_USER: 'Failed to fetch user',
  FAILED_TO_UPDATE_USERNAME: 'Failed to update username',
  FAILED_TO_CHECK_USERNAME: 'Failed to check username availability',
  USERNAME_REQUIRED: 'Username is required',
  USERNAME_TAKEN: 'Username already taken',
} as const;

// User data errors
export const USER_DATA_ERRORS = {
  // Ratings
  FAILED_TO_RATE: 'Failed to rate series',
  FAILED_TO_FETCH_RATING: 'Failed to fetch rating',
  FAILED_TO_FETCH_RATINGS: 'Failed to fetch ratings',
  FAILED_TO_DELETE_RATING: 'Failed to delete rating',

  // Notes
  FAILED_TO_SAVE_NOTE: 'Failed to save note',
  FAILED_TO_FETCH_NOTE: 'Failed to fetch note',
  FAILED_TO_DELETE_NOTE: 'Failed to delete note',

  // Tag votes
  FAILED_TO_VOTE: 'Failed to vote on tag',
  FAILED_TO_REMOVE_VOTE: 'Failed to remove tag vote',
  FAILED_TO_FETCH_VOTES: 'Failed to fetch tag votes',

  // Preferences
  FAILED_TO_SET_PREFERENCE: 'Failed to set preference',
  FAILED_TO_FETCH_PREFERENCES: 'Failed to fetch preferences',
  FAILED_TO_FETCH_TAG_PREFERENCES: 'Failed to fetch tag preferences',

  // Services
  FAILED_TO_SET_SERVICES: 'Failed to set available services',
  FAILED_TO_FETCH_SERVICES: 'Failed to fetch available services',

  // Watchlist
  FAILED_TO_ADD_WATCHLIST: 'Failed to add to watchlist',
  FAILED_TO_REMOVE_WATCHLIST: 'Failed to remove from watchlist',
  FAILED_TO_FETCH_WATCHLIST: 'Failed to fetch watchlist',
  FAILED_TO_FETCH_WATCHLIST_STATUS: 'Failed to fetch watchlist status',
  FAILED_TO_FETCH_BATCH_WATCHLIST: 'Failed to fetch batch watchlist status',

  // Series lists
  FAILED_TO_FETCH_RATED_SERIES: 'Failed to fetch rated series',
  FAILED_TO_FETCH_NOTED_SERIES: 'Failed to fetch noted series',
} as const;

// Series errors
export const SERIES_ERRORS = {
  FAILED_TO_FETCH_SERIES: 'Failed to fetch series',
  FAILED_TO_TRACE_RELATIONSHIPS: 'Failed to trace relationships',
  SERIES_NOT_FOUND: 'Series not found',
  INVALID_URL: 'Invalid series URL',
} as const;

// Validation errors
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
  OUT_OF_RANGE: (field: string, min: number, max: number) =>
    `${field} must be between ${min} and ${max}`,
} as const;

// Generic errors
export const GENERIC_ERRORS = {
  INTERNAL_ERROR: 'Internal server error',
  NOT_FOUND: 'Not found',
  BAD_REQUEST: 'Bad request',
  FORBIDDEN: 'Forbidden',
} as const;
