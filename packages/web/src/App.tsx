import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { DiscoveryPage } from './features/discovery/DiscoveryPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { UserMenu } from './components/auth/UserMenu';
import { ProfilePage } from './pages/ProfilePage';
import { WatchlistPage } from './pages/WatchlistPage';
import { RatedSeriesPage } from './pages/RatedSeriesPage';
import { NotedSeriesPage } from './pages/NotedSeriesPage';
import { UsernameModal } from './components/auth/UsernameModal';
import { PersonalizeToggle } from './components/PersonalizeToggle';
import { useUserStore } from './store/userStore';
import { authApi, userApi } from './lib/api';

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
      <div className="min-h-screen bg-zinc-950 text-zinc-50">
        {/* Fixed Logo spanning both headers */}
        <Link to="/" className="fixed top-2 left-4 z-50 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Tanuki Temaki" className="h-28" />
        </Link>

        <header className="border-b border-zinc-800 bg-zinc-900">
          <div className="w-full px-4 py-4 flex justify-end items-center">
            <div className="flex items-center gap-3">
              <PersonalizeToggle />
              <UserMenu />
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DiscoveryPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/rated" element={<RatedSeriesPage />} />
          <Route path="/noted" element={<NotedSeriesPage />} />
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
