import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SafeModeToggle } from './SafeModeToggle';
import { PersonalizeToggle } from './PersonalizeToggle';
import { LoginModal } from './auth/LoginModal';
import { useUserStore } from '../store/userStore';
import { authApi } from '../lib/api';

export const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useUserStore();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      setIsOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Hamburger Button */}
      <div
        className="md:hidden fixed top-9 right-2 z-50"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
      >
        <div
          className="bg-cyber-accent p-[1px]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-cyber-bg p-2 text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg transition-colors"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
            aria-label="Menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-80 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-80 bg-cyber-bg-elevated border-l border-cyber-accent z-50 p-6 overflow-y-auto">
            <div className="flex flex-col gap-4 mt-12">
              <div className="text-cyber-text-bright uppercase tracking-wider text-sm font-bold mb-2">
                [MENU]
              </div>

              <div className="space-y-4">
                {/* Theme */}
                <div>
                  <div className="text-cyber-text-dim text-xs uppercase tracking-wide mb-2">Theme</div>
                  <ThemeSwitcher />
                </div>

                {/* Filters */}
                <div className="border-t border-cyber-border pt-4">
                  <div className="text-cyber-text-dim text-xs uppercase tracking-wide mb-2">Filters</div>
                  <div className="space-y-2">
                    <SafeModeToggle />
                    <PersonalizeToggle />
                  </div>
                </div>

                {/* User Menu */}
                {user && (
                  <div className="border-t border-cyber-border pt-4">
                    <div className="text-cyber-text-dim text-xs uppercase tracking-wide mb-2">
                      {user.username}
                      {user.isAdmin && <span className="ml-2 text-cyber-accent">[ADMIN]</span>}
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => handleNavigation('/profile')}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-border hover:border-cyber-accent hover:bg-cyber-bg-card transition-colors text-cyber-text uppercase tracking-wide text-xs"
                      >
                        [USER] PROFILE
                      </button>
                      <button
                        onClick={() => handleNavigation('/watchlist')}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-border hover:border-cyber-accent hover:bg-cyber-bg-card transition-colors text-cyber-text uppercase tracking-wide text-xs"
                      >
                        [LIST] WATCHLIST
                      </button>
                      <button
                        onClick={() => handleNavigation('/rated')}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-border hover:border-cyber-accent hover:bg-cyber-bg-card transition-colors text-cyber-text uppercase tracking-wide text-xs"
                      >
                        [STAR] RATED SERIES
                      </button>
                      <button
                        onClick={() => handleNavigation('/noted')}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-border hover:border-cyber-accent hover:bg-cyber-bg-card transition-colors text-cyber-text uppercase tracking-wide text-xs"
                      >
                        [NOTE] MY NOTES
                      </button>
                      {user.isAdmin && (
                        <button
                          onClick={() => handleNavigation('/admin/maintenance')}
                          className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-accent hover:bg-cyber-bg-card transition-colors text-cyber-accent uppercase tracking-wide text-xs font-bold"
                        >
                          [ADMIN] MAINTENANCE
                        </button>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-red-500 hover:bg-red-500 hover:text-black transition-colors text-red-400 uppercase tracking-wide text-xs"
                      >
                        [EXIT] SIGN OUT
                      </button>
                    </div>
                  </div>
                )}

                {/* Sign In Button if not logged in */}
                {!user && (
                  <div className="border-t border-cyber-border pt-4">
                    <div className="text-cyber-text-dim text-xs uppercase tracking-wide mb-2">Account</div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setShowLoginModal(true);
                      }}
                      className="w-full px-4 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg font-medium transition-all uppercase tracking-wide text-xs"
                    >
                      SIGN IN
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
};
