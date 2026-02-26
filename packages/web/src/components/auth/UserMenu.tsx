import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../store/userStore';
import { authApi } from '../../lib/api';
import { LoginModal } from './LoginModal';

export const UserMenu: React.FC = () => {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const buttons = dropdownRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        if (!buttons?.length) return;
        const focused = document.activeElement;
        const idx = Array.from(buttons).indexOf(focused as HTMLButtonElement);
        const next = event.key === 'ArrowDown'
          ? (idx + 1) % buttons.length
          : (idx - 1 + buttons.length) % buttons.length;
        buttons[next].focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDropdown]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      logout();
      setShowDropdown(false);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate('/profile');
  };

  if (!user) {
    return (
      <>
        <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
          <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <button
              onClick={() => setShowLoginModal(true)}
              className="h-10 flex items-center px-4 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg font-medium transition-all uppercase tracking-wider shadow-cyber-md hover:shadow-cyber-lg"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              SIGN IN
            </button>
          </div>
        </div>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            aria-expanded={showDropdown}
            aria-haspopup="menu"
            className="h-10 flex items-center gap-2 px-4 bg-cyber-bg border border-cyber-border hover:border-cyber-accent text-cyber-text hover:text-cyber-accent font-medium transition-all uppercase tracking-wide"
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          >
            <div className="w-6 h-6 bg-cyber-accent border border-cyber-accent flex items-center justify-center text-cyber-bg font-medium text-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium">{user.username}</span>
            {user.isAdmin && (
              <span className="text-xs px-1.5 py-0.5 bg-cyber-accent text-cyber-bg font-bold">
                [ADMIN]
              </span>
            )}
            <svg
              className={`w-4 h-4 transition-transform ${
                showDropdown ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 z-50" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
          <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <div className="bg-cyber-bg-elevated shadow-cyber-lg py-2" role="menu" aria-label="User menu" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              <button
                role="menuitem"
                onClick={handleProfileClick}
                className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-cyber-accent hover:text-cyber-bg focus:bg-cyber-accent focus:text-cyber-bg focus:outline-none transition-colors text-cyber-text uppercase tracking-wide text-sm"
              >
                [USER] PROFILE
              </button>
              <div className="border-t border-cyber-border my-1"></div>
              <button
                role="menuitem"
                onClick={() => { setShowDropdown(false); navigate('/watchlist'); }}
                className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-cyber-accent hover:text-cyber-bg focus:bg-cyber-accent focus:text-cyber-bg focus:outline-none transition-colors text-cyber-text uppercase tracking-wide text-sm"
              >
                [LIST] WATCHLIST
              </button>
              <button
                role="menuitem"
                onClick={() => { setShowDropdown(false); navigate('/rated'); }}
                className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-cyber-accent hover:text-cyber-bg focus:bg-cyber-accent focus:text-cyber-bg focus:outline-none transition-colors text-cyber-text uppercase tracking-wide text-sm"
              >
                [STAR] RATED SERIES
              </button>
              <button
                role="menuitem"
                onClick={() => { setShowDropdown(false); navigate('/noted'); }}
                className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-cyber-accent hover:text-cyber-bg focus:bg-cyber-accent focus:text-cyber-bg focus:outline-none transition-colors text-cyber-text uppercase tracking-wide text-sm"
              >
                [NOTE] MY NOTES
              </button>
              {user.isAdmin && (
                <>
                  <div className="border-t border-cyber-border my-1"></div>
                  <button
                    role="menuitem"
                    onClick={() => { setShowDropdown(false); navigate('/admin/maintenance'); }}
                    className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-cyber-accent hover:text-cyber-bg focus:bg-cyber-accent focus:text-cyber-bg focus:outline-none transition-colors text-cyber-accent uppercase tracking-wide text-sm font-bold"
                  >
                    [ADMIN] MAINTENANCE
                  </button>
                </>
              )}
              <div className="border-t border-cyber-border my-1"></div>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 bg-cyber-bg hover:bg-red-500 hover:text-black focus:bg-red-500 focus:text-black focus:outline-none transition-colors text-red-400 uppercase tracking-wide text-sm"
              >
                [EXIT] SIGN OUT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
