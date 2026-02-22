import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { DiscoveryPage } from './features/discovery/DiscoveryPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { UserMenu } from './components/auth/UserMenu';
import { ProfilePage } from './pages/ProfilePage';
import { WatchlistPage } from './pages/WatchlistPage';
import { RatedSeriesPage } from './pages/RatedSeriesPage';
import { NotedSeriesPage } from './pages/NotedSeriesPage';
import { IsAdultTestPage } from './pages/IsAdultTestPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { HomePage } from './pages/HomePage';
import { SeriesPage } from './pages/SeriesPage';
import { UsernameModal } from './components/auth/UsernameModal';
import { PersonalizeToggle } from './components/PersonalizeToggle';
import { SafeModeToggle } from './components/SafeModeToggle';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { Logo } from './components/Logo';
import { MobileMenu } from './components/MobileMenu';
import { useUserStore } from './store/userStore';
import { authApi, userApi } from './lib/api';

function LogoMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const clip = 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)';

  return (
    <div ref={ref} className="fixed top-2 left-2 md:left-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="block group focus:outline-none"
        style={{ clipPath: clip }}
        aria-label="Navigation menu"
      >
        <div className="bg-cyber-accent p-[1px]" style={{ clipPath: clip }}>
          <div
            className="bg-cyber-bg p-1 md:p-2 text-cyber-accent"
            style={{ clipPath: clip }}
          >
            <Logo className="h-16 md:h-28 transition-all group-hover:drop-shadow-[0_0_10px_currentColor]" />
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 min-w-[140px] bg-cyber-bg-elevated border border-cyber-accent shadow-cyber-sm z-50">
          <button
            onClick={() => go('/')}
            className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-cyber-text hover:bg-cyber-accent hover:text-cyber-bg transition-colors border-b border-cyber-border"
          >
            [HOME]
          </button>
          <button
            onClick={() => go('/search')}
            className="w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-cyber-text hover:bg-cyber-accent hover:text-cyber-bg transition-colors"
          >
            [SEARCH]
          </button>
        </div>
      )}
    </div>
  );
}

function RootPage() {
  const { user, isLoading } = useUserStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent" />
      </div>
    );
  }
  if (user) return <HomePage />;
  return <DiscoveryPage />;
}

function App() {
  const { user, setUser, setLoading, logout } = useUserStore();
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  // Initialize auth state on app load
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        const fetchedUser = await authApi.getCurrentUser();
        setUser(fetchedUser);

        // Load user preferences
        try {
          const prefs = await userApi.getPreferences();
          if (prefs.prefer_personalized !== undefined) {
            useUserStore.setState({ preferPersonalized: prefs.prefer_personalized as boolean });
          }
        } catch (error) {
          console.error('Failed to load preferences:', error);
        }

        // Check if user has temporary username
        if (fetchedUser && fetchedUser.username.startsWith('user_')) {
          setShowUsernameModal(true);
        }
      } catch (error: any) {
        // 401 is expected when not logged in - don't log as error
        if (error?.response?.status !== 401) {
          console.error('Failed to fetch user:', error);
        }
        // Clear user state if auth check fails (handles expired cookies)
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setLoading]);

  // Handle token expiry
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('Auth token expired, logging out');
      logout();
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, [logout]);

  // Check if current user has temp username (for when user data updates)
  useEffect(() => {
    if (user && user.username.startsWith('user_')) {
      setShowUsernameModal(true);
    } else {
      setShowUsernameModal(false);
    }
  }, [user]);

  const handleUsernameComplete = () => {
    setShowUsernameModal(false);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cyber-bg text-cyber-text">
        {/* Fixed Logo with navigation dropdown */}
        <LogoMenu />

        {/* Mobile Menu */}
        <MobileMenu />

        {/* Desktop Header */}
        <header className="border-b border-cyber-accent bg-cyber-bg-elevated shadow-cyber-sm">
          <div className="w-full pl-4 md:pl-44 pr-4 py-4 flex justify-end items-center">
            {/* Desktop Navigation - Hidden on Mobile */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeSwitcher />
              <SafeModeToggle />
              <PersonalizeToggle />
              <UserMenu />
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/search" element={<DiscoveryPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/rated" element={<RatedSeriesPage />} />
          <Route path="/noted" element={<NotedSeriesPage />} />
          <Route path="/admin/maintenance" element={<MaintenancePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/series/:id" element={<SeriesPage />} />
          <Route path="/test/isadult" element={<IsAdultTestPage />} />
        </Routes>

        {/* Force username selection for temp usernames */}
        <UsernameModal
          isOpen={showUsernameModal}
          onClose={handleUsernameComplete}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
