import axios from 'axios';
import type { Series, SeriesRelationship } from '@tanuki-temaki/shared';

export interface User {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for auth
});

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
  async searchByTitle(title: string, mediaType: 'ANIME' | 'MANGA' = 'ANIME'): Promise<Series> {
    const { data } = await api.post<Series>('/api/series/search-one', {
      title,
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
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${API_BASE_URL}/api/series/${seriesId}/trace-stream?maxDepth=${maxDepth}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            eventSource.close();
            reject(new Error(data.error));
            return;
          }

          if (data.result) {
            // Final result received
            eventSource.close();
            resolve(data.result);
            return;
          }

          // Progress update
          onProgress(data);
        } catch (error) {
          eventSource.close();
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        reject(new Error('Stream connection error'));
      };
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
};

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
};
