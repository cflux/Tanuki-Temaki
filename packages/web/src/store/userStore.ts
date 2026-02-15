import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  preferPersonalized: boolean;
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH';
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateUsername: (username: string) => void;
  setPreferPersonalized: (prefer: boolean) => void;
  setResultsMediaFilter: (filter: 'ANIME' | 'MANGA' | 'BOTH') => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      preferPersonalized: false,
      resultsMediaFilter: 'BOTH',

      setUser: (user) => set({ user, isLoading: false }),

      setLoading: (loading) => set({ isLoading: loading }),

      updateUsername: (username) =>
        set((state) => ({
          user: state.user ? { ...state.user, username } : null,
        })),

      setPreferPersonalized: (prefer) => set({ preferPersonalized: prefer }),

      setResultsMediaFilter: (filter) => set({ resultsMediaFilter: filter }),

      logout: () => set({ user: null, isLoading: false, preferPersonalized: false, resultsMediaFilter: 'BOTH' }),
    }),
    {
      name: 'tanuki-user-storage',
      partialize: (state) => ({
        user: state.user,
        preferPersonalized: state.preferPersonalized,
        resultsMediaFilter: state.resultsMediaFilter,
      }), // Persist user data and preferences
    }
  )
);
