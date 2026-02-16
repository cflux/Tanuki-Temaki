import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CyberTheme = 'cyber-green' | 'cyber-blue' | 'cyber-purple' | 'cyber-red';

interface ThemeState {
  theme: CyberTheme;
  setTheme: (theme: CyberTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'cyber-green',

      setTheme: (theme) => {
        set({ theme });
        // Update the data-theme attribute on the document root
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
      },
    }),
    {
      name: 'tanuki-theme-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
      // Apply theme from storage on initial load
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);

// Initialize theme on module load
if (typeof document !== 'undefined') {
  const storedTheme = localStorage.getItem('tanuki-theme-storage');
  if (storedTheme) {
    try {
      const { state } = JSON.parse(storedTheme);
      if (state?.theme) {
        document.documentElement.setAttribute('data-theme', state.theme);
      }
    } catch (e) {
      // If parsing fails, fall back to default
      document.documentElement.setAttribute('data-theme', 'cyber-green');
    }
  } else {
    document.documentElement.setAttribute('data-theme', 'cyber-green');
  }
}
