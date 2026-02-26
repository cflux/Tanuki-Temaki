/**
 * User-related types shared between frontend and backend
 */

import type { Series } from './series.js';

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRating {
  id: string;
  userId: string;
  seriesId: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserNote {
  id: string;
  userId: string;
  seriesId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserTagVote {
  id: string;
  userId: string;
  seriesId: string;
  tagValue: string;
  vote: 1 | -1;
  createdAt: string;
  updatedAt: string;
}

export interface UserWatchlist {
  id: string;
  userId: string;
  seriesId: string;
  status: 'plan_to_watch' | 'watching' | 'completed' | 'on_hold' | 'dropped';
  addedAt: string;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

/** UserRating with the full series object included */
export interface UserRatingWithSeries extends UserRating {
  series: Series;
}

/** UserWatchlist with the full series object included */
export interface UserWatchlistWithSeries extends UserWatchlist {
  series: Series;
}

/** UserNote with the full series object included */
export interface UserNoteWithSeries extends UserNote {
  series: Series;
}
