import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DiscoveryPage } from './features/discovery/DiscoveryPage';
import { AuthCallback } from './components/auth/AuthCallback';
import { UserMenu } from './components/auth/UserMenu';
import { useUserStore } from './store/userStore';
import { authApi } from './lib/api';

function App() {
  const { setUser, setLoading } = useUserStore();

  // Initialize auth state on app load
  useEffect(() => {
    const initAuth = async () => {
      try {
        const user = await authApi.getCurrentUser();
        setUser(user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      }
    };

    initAuth();
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <header className="border-b border-zinc-800 bg-zinc-900">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Tanuki Temaki</h1>
            <UserMenu />
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DiscoveryPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Profile route will be added in Phase 3 */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
