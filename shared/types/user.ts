/**
 * User-related types shared between frontend and backend
 */

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
  vote: number;
  createdAt: string;
  updatedAt: string;
}
