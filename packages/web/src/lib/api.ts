import axios from 'axios';
import type { Series, SeriesRelationship, User, UserRating, UserNote, UserTagVote } from '@tanuki-temaki/shared';

// Re-export types for use in components
export type { Series, SeriesRelationship, User, UserRating, UserNote, UserTagVote };

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for auth
});

// Track if we're currently refreshing to avoid multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Suppress console errors for auth checks and watchlist requests during refresh
      const isAuthCheck = originalRequest.url?.includes('/api/auth/me');
      const isWatchlistCheck = originalRequest.url?.includes('/api/user/watchlist/');

      if (!isAuthCheck && !isWatchlistCheck) {
        console.error('401 Unauthorized:', originalRequest.url);
      }
      if (isRefreshing) {
        // Another request is already refreshing, queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await api.post('/api/auth/refresh');

        // Token refreshed successfully, process queue and retry original request
        processQueue();
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear queue and reject
        processQueue(refreshError);

        // Token refresh failed - user needs to log in again
        // Clear user state if needed
        window.dispatchEvent(new CustomEvent('auth:token-expired'));

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const seriesApi = {
  /**
   * Fetch series by URL
   */
  async fetchSeries(url: string, forceRefresh = false): Promise<Series> {
    const { data } = await api.post<Series>('/api/series/fetch', {
      url,
      forceRefresh,
    });
    return data;
  },

  /**
   * Get series by ID
   */
  async getSeriesById(id: string): Promise<Series> {
    const { data } = await api.get<Series>(`/api/series/${id}`);
    return data;
  },

  /**
   * Search series by title
   */
  async searchSeries(query: string, limit = 10): Promise<Series[]> {
    const { data} = await api.get<Series[]>('/api/series/search', {
      params: { q: query, limit },
    });
    return data;
  },

  /**
   * Search for a single series by title (returns best match)
   */
  async searchByTitle(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME', filterAdult?: boolean): Promise<Series> {
    const { data } = await api.post<Series>('/api/series/search-one', {
      title,
      mediaType,
      filterAdult,
    });
    return data;
  },

  /**
   * Search for multiple series results for user selection
   */
  async searchMultiple(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME', limit = 10, filterAdult?: boolean): Promise<Array<{
    id: string;
    title: string;
    description: string;
    titleImage: string | null;
    mediaType: 'ANIME' | 'MANGA';
    anilistId: number;
    format?: string;
    episodes?: number;
    chapters?: number;
    season?: string;
    year?: number;
  }>> {
    const { data } = await api.post('/api/series/search-many', {
      title,
      mediaType,
      limit,
      filterAdult,
    });
    return data;
  },

  /**
   * Fetch series by AniList ID
   */
  async fetchByAniListId(anilistId: number, mediaType: 'ANIME' | 'MANGA' = 'ANIME'): Promise<Series> {
    const { data } = await api.post<Series>('/api/series/fetch-by-anilist-id', {
      anilistId,
      mediaType,
    });
    return data;
  },

  /**
   * Trace relationship graph
   */
  async traceRelationships(
    seriesId: string,
    maxDepth = 2
  ): Promise<SeriesRelationship> {
    const { data } = await api.post<SeriesRelationship>(
      `/api/series/${seriesId}/trace`,
      { maxDepth }
    );
    return data;
  },

  /**
   * Trace relationship graph with streaming progress updates
   */
  async traceRelationshipsStream(
    seriesId: string,
    maxDepth = 2,
    onProgress: (progress: any) => void
  ): Promise<SeriesRelationship> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/series/${seriesId}/trace-stream?maxDepth=${maxDepth}`,
          {
            credentials: 'include', // Send cookies with the request
            headers: {
              'Accept': 'text/event-stream',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  reader.cancel();
                  reject(new Error(data.error));
                  return;
                }

                if (data.result) {
                  // Final result received
                  reader.cancel();
                  resolve(data.result);
                  return;
                }

                // Progress update
                onProgress?.(data);
              } catch (error) {
                console.error('Failed to parse SSE data:', error);
              }
            }
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSeries: number;
    totalTags: number;
    totalRelationships: number;
    byProvider: Array<{ provider: string; count: number }>;
    byMediaType: Array<{ mediaType: string; count: number }>;
  }> {
    const { data } = await api.get('/api/series/stats');
    return data;
  },

  /**
   * Clear all cached data (for testing)
   */
  async clearDatabase(): Promise<void> {
    await api.delete('/api/series/clear');
  },

  /**
   * Get all unique streaming/reading platforms
   */
  async getAllServices(): Promise<string[]> {
    const { data } = await api.get('/api/series/services');
    return data;
  },
};

export const authApi = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await api.get<User>('/api/auth/me');
      return data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  /**
   * Update username
   */
  async updateUsername(username: string): Promise<{ success: boolean; username: string }> {
    const { data } = await api.patch('/api/auth/username', { username });
    return data;
  },

  /**
   * Check if username is available
   */
  async checkUsernameAvailable(username: string): Promise<{ available: boolean; error?: string }> {
    const { data } = await api.get(`/api/auth/username/available/${username}`);
    return data;
  },

  /**
   * Initiate Google OAuth flow
   */
  initiateGoogleOAuth(): void {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  },

  /**
   * Initiate GitHub OAuth flow
   */
  initiateGitHubOAuth(): void {
    window.location.href = `${API_BASE_URL}/api/auth/github`;
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<boolean> {
    try {
      await api.post('/api/auth/refresh');
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Exchange one-time token for auth cookies
   * Used after OAuth redirect to set proper cookies for current domain
   */
  async exchangeToken(token: string): Promise<{ success: boolean; needsUsername: boolean }> {
    const { data } = await api.post('/api/auth/exchange', { token });
    return data;
  },
};

// User types now imported from @tanuki-temaki/shared

export const userApi = {
  // ==================== RATINGS ====================

  async rateSeries(seriesId: string, rating: number): Promise<UserRating> {
    const { data } = await api.post('/api/user/ratings', { seriesId, rating });
    return data;
  },

  async getRating(seriesId: string): Promise<UserRating | null> {
    try {
      const { data } = await api.get(`/api/user/ratings/${seriesId}`);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getAllRatings(): Promise<UserRating[]> {
    const { data } = await api.get('/api/user/ratings');
    return data;
  },

  async deleteRating(seriesId: string): Promise<void> {
    await api.delete(`/api/user/ratings/${seriesId}`);
  },

  // ==================== NOTES ====================

  async saveNote(seriesId: string, note: string): Promise<UserNote> {
    const { data } = await api.post('/api/user/notes', { seriesId, note });
    return data;
  },

  async getNote(seriesId: string): Promise<UserNote | null> {
    try {
      const { data } = await api.get(`/api/user/notes/${seriesId}`);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async deleteNote(seriesId: string): Promise<void> {
    await api.delete(`/api/user/notes/${seriesId}`);
  },

  // ==================== TAG VOTING ====================

  async voteOnTag(seriesId: string, tagValue: string, vote: 1 | -1): Promise<UserTagVote> {
    const { data } = await api.post('/api/user/tag-votes', { seriesId, tagValue, vote });
    return data;
  },

  async removeTagVote(seriesId: string, tagValue: string): Promise<void> {
    await api.delete(`/api/user/tag-votes/${seriesId}/${encodeURIComponent(tagValue)}`);
  },

  async getTagVotes(seriesId: string): Promise<UserTagVote[]> {
    const { data } = await api.get(`/api/user/tag-votes/${seriesId}`);
    return data;
  },

  async getTagPreferences(): Promise<Record<string, number>> {
    const { data } = await api.get('/api/user/tag-preferences');
    return data;
  },

  // ==================== PREFERENCES ====================

  async setPreference(key: string, value: any): Promise<void> {
    await api.post('/api/user/preferences', { key, value });
  },

  async getPreferences(): Promise<Record<string, any>> {
    const { data } = await api.get('/api/user/preferences');
    return data;
  },

  async setAvailableServices(services: string[]): Promise<void> {
    await api.post('/api/user/preferences/available-services', { services });
  },

  async getAvailableServices(): Promise<string[]> {
    const { data } = await api.get('/api/user/preferences/available-services');
    return data;
  },

  // ==================== WATCHLIST ====================

  async addToWatchlist(seriesId: string, status: string = 'plan_to_watch'): Promise<any> {
    const { data } = await api.post('/api/user/watchlist', { seriesId, status });
    return data;
  },

  async removeFromWatchlist(seriesId: string): Promise<void> {
    await api.delete(`/api/user/watchlist/${seriesId}`);
  },

  async getWatchlist(): Promise<any[]> {
    const { data } = await api.get('/api/user/watchlist');
    return data;
  },

  async getWatchlistStatus(seriesId: string): Promise<{ status: string; addedAt: string } | null> {
    try {
      const { data } = await api.get(`/api/user/watchlist/${seriesId}`);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getWatchlistStatusBatch(seriesIds: string[]): Promise<Array<{ seriesId: string; status: string | null }>> {
    try {
      const { data } = await api.post('/api/user/watchlist/batch', { seriesIds });
      return data;
    } catch (error: any) {
      console.error('Failed to fetch batch watchlist status:', error);
      return [];
    }
  },

  async getRatedSeries(): Promise<any[]> {
    const { data } = await api.get('/api/user/rated');
    return data;
  },

  async getNotedSeries(): Promise<any[]> {
    const { data } = await api.get('/api/user/noted');
    return data;
  },
};

export const tagApi = {
  /**
   * Search for tags by name
   */
  async searchTags(query: string, limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    const { data } = await api.get('/api/tags/search', {
      params: { q: query, limit },
    });
    return data;
  },

  /**
   * Get all tags
   */
  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    const { data } = await api.get('/api/tags');
    return data;
  },

  /**
   * Get top-rated series for a tag
   */
  async getTopSeriesForTag(
    tagValue: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    limit: number = 20
  ): Promise<any[]> {
    const { data } = await api.get(`/api/tags/${encodeURIComponent(tagValue)}/series`, {
      params: { mediaType, limit },
    });
    return data;
  },

  /**
   * Get series count for a tag
   */
  async getSeriesCountForTag(tagValue: string): Promise<{ tag: string; count: number }> {
    const { data } = await api.get(`/api/tags/${encodeURIComponent(tagValue)}/count`);
    return data;
  },
};

export const recommendationApi = {
  /**
   * Get personalized recommendations for a series
   * Requires authentication
   */
  async getPersonalizedRecommendations(
    seriesId: string,
    maxDepth: number = 2
  ): Promise<SeriesRelationship> {
    const { data } = await api.post<SeriesRelationship>(
      '/api/recommendations/personalized',
      { seriesId, maxDepth }
    );
    return data;
  },

  /**
   * Get recommendations based on a tag/genre with SSE progress updates
   * Optionally personalized if user is authenticated
   */
  async getRecommendationsFromTagWithProgress(
    tagValue: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    maxDepth?: number,
    topSeriesCount?: number,
    personalized: boolean = false,
    onProgress?: (step: string, message: string, data?: any) => void
  ): Promise<SeriesRelationship> {
    return new Promise((resolve, reject) => {
      // Build request body, only including optional params if provided (let backend use defaults)
      const requestBody: any = { tagValue, mediaType, personalized };
      if (maxDepth !== undefined) requestBody.maxDepth = maxDepth;
      if (topSeriesCount !== undefined) requestBody.topSeriesCount = topSeriesCount;

      // Send POST request with streaming response
      fetch(`${API_BASE_URL}/api/recommendations/from-tag-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json();
            reject(new Error(error.error || 'Failed to get recommendations'));
            return;
          }

          // Read the SSE stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            reject(new Error('No response body'));
            return;
          }

          let buffer = '';

          const readStream = async () => {
            try {
              const { done, value } = await reader.read();

              if (done) {
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);

                  if (data === '[DONE]') {
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);

                    if (parsed.error) {
                      reject(new Error(parsed.message || parsed.details || 'Unknown error'));
                      return;
                    }

                    if (parsed.result) {
                      resolve(parsed.result);
                      return;
                    }

                    onProgress?.(parsed.step, parsed.message, parsed);
                  } catch (e) {
                    console.error('Failed to parse SSE data:', data, e);
                  }
                }
              }

              readStream();
            } catch (error) {
              reject(error);
            }
          };

          readStream();
        })
        .catch(reject);
    });
  },

  /**
   * Get recommendations based on a tag/genre
   * Optionally personalized if user is authenticated
   */
  async getRecommendationsFromTag(
    tagValue: string,
    mediaType: 'ANIME' | 'MANGA' | 'all' = 'all',
    maxDepth: number = 2,
    topSeriesCount: number = 5,
    personalized: boolean = false
  ): Promise<SeriesRelationship> {
    const { data } = await api.post<SeriesRelationship>(
      '/api/recommendations/from-tag',
      { tagValue, mediaType, maxDepth, topSeriesCount, personalized }
    );
    return data;
  },
};

/**
 * Admin-only API endpoints
 */
export const adminApi = {
  /**
   * Get cache statistics
   * Requires admin privileges
   */
  async getCacheStats(): Promise<{
    totalSeries: number;
    totalTags: number;
    totalRelationships: number;
    byMediaType: Array<{ mediaType: string; count: number }>;
  }> {
    const { data } = await api.get('/api/admin/cache/stats');
    return data;
  },

  /**
   * Clear all cached data
   * Requires admin privileges
   */
  async clearCache(): Promise<void> {
    await api.delete('/api/admin/cache/clear');
  },

  /**
   * Seed database with top 10 popular series from AniList
   * Traces relationships 1 level deep for each
   * Requires admin privileges
   */
  async seedFromPopular(): Promise<{ success: boolean; message: string; status: string }> {
    const { data } = await api.post('/api/admin/seed/popular');
    return data;
  },

  /**
   * Seed database with streaming progress updates
   * Requires admin privileges
   */
  async seedFromPopularStream(
    onProgress: (step: string, message: string, data?: any) => void
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/seed/popular-stream`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Accept': 'text/event-stream',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  reader.cancel();
                  reject(new Error(data.error));
                  return;
                }

                if (data.done) {
                  reader.cancel();
                  resolve();
                  return;
                }

                // Progress update
                onProgress?.(data.step, data.message, data);
              } catch (error) {
                console.error('Failed to parse SSE data:', error);
              }
            }
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Expand database by seeding series with no relationships
   * Finds 10 series with no relationships and traces them 1 level deep
   * Requires admin privileges
   */
  async expandDatabase(): Promise<{ success: boolean; message: string; status: string }> {
    const { data } = await api.post('/api/admin/seed/expand');
    return data;
  },

  /**
   * Expand database with streaming progress updates
   * Requires admin privileges
   */
  async expandDatabaseStream(
    onProgress: (step: string, message: string, data?: any) => void
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/seed/expand-stream`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Accept': 'text/event-stream',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  reader.cancel();
                  reject(new Error(data.error));
                  return;
                }

                if (data.done) {
                  reader.cancel();
                  resolve();
                  return;
                }

                // Progress update
                onProgress?.(data.step, data.message, data);
              } catch (error) {
                console.error('Failed to parse SSE data:', error);
              }
            }
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },
};
