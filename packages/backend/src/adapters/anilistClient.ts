/**
 * Shared AniList GraphQL client for making API requests
 * Centralizes fetch logic and error handling to avoid duplication
 */
import { ANILIST_API_URL, JSON_HEADERS } from '../config/constants.js';

export interface AniListError {
  response: {
    errors: Array<{ message: string; status?: number }>;
    status: number;
    headers: Record<string, string>;
  };
  message: string;
}

/**
 * Execute a GraphQL query against the AniList API
 * Handles HTTP errors and GraphQL errors uniformly
 *
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param updateRateLimit - Optional callback to update rate limit info from response headers
 * @returns The data portion of the GraphQL response
 * @throws {AniListError} On HTTP or GraphQL errors
 */
export async function fetchAniList<T = any>(
  query: string,
  variables: Record<string, any>,
  updateRateLimit?: (headers: Headers) => void
): Promise<T> {
  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  // Update rate limit info from headers if callback provided
  if (updateRateLimit) {
    updateRateLimit(response.headers);
  }

  // Check HTTP status
  if (!response.ok) {
    const json = await response.json();
    throw {
      response: {
        errors: json.errors || [{ message: 'HTTP Error', status: response.status }],
        status: response.status,
        headers: {},
      },
      message: json.errors?.[0]?.message || `HTTP ${response.status}`,
    } as AniListError;
  }

  const json = await response.json();

  // Check for GraphQL errors
  if (json.errors) {
    throw {
      response: {
        errors: json.errors,
        status: 200,
        headers: {},
      },
      message: json.errors[0]?.message || 'GraphQL Error',
    } as AniListError;
  }

  // Return just the data part (same as graphql-request)
  return json.data as T;
}
