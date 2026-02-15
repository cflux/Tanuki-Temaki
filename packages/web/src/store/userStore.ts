import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@tanuki-temaki/shared';

interface UserState {
  user: User | null;
  isLoading: boolean;
  preferPersonalized: boolean;
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH';
  filterAdultContent: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateUsername: (username: string) => void;
  setPreferPersonalized: (prefer: boolean) => void;
  setResultsMediaFilter: (filter: 'ANIME' | 'MANGA' | 'BOTH') => void;
  setFilterAdultContent: (filter: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      preferPersonalized: false,
      resultsMediaFilter: 'BOTH',
      filterAdultContent: false,

      setUser: (user) => set({ user, isLoading: false }),

      setLoading: (loading) => set({ isLoading: loading }),

      updateUsername: (username) =>
        set((state) => ({
          user: state.user ? { ...state.user, username } : null,
        })),

      setPreferPersonalized: (prefer) => set({ preferPersonalized: prefer }),

      setResultsMediaFilter: (filter) => set({ resultsMediaFilter: filter }),

      setFilterAdultContent: (filter) => set({ filterAdultContent: filter }),

      logout: () => set({ user: null, isLoading: false, preferPersonalized: false, resultsMediaFilter: 'BOTH', filterAdultContent: false }),
    }),
    {
      name: 'tanuki-user-storage',
      partialize: (state) => ({
        user: state.user,
        preferPersonalized: state.preferPersonalized,
        resultsMediaFilter: state.resultsMediaFilter,
        filterAdultContent: state.filterAdultContent,
      }), // Persist user data and preferences
    }
  )
);
