/**
 * UI-related constants
 * Centralizes timing, animation, and display durations
 */

// Status message display durations
export const STATUS_DISPLAY_DURATION = {
  SUCCESS: 2000, // 2 seconds for success messages
  ERROR: 3000,   // 3 seconds for error messages
  INFO: 1000,    // 1 second for info messages
} as const;

// Navigation and redirect delays
export const NAVIGATION_DELAY = {
  REDIRECT: 3000,        // 3 seconds before auto-redirect
  ROUTE_TRANSITION: 300, // 300ms for route transitions
} as const;

// Animation and interaction delays
export const ANIMATION_DURATION = {
  DEBOUNCE: 300,    // 300ms debounce for search/filter inputs
  TRANSITION: 200,  // 200ms for UI transitions
  TOOLTIP: 500,     // 500ms before showing tooltips
} as const;
