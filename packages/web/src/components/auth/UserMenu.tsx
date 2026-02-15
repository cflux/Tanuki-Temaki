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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
        <button
          onClick={() => setShowLoginModal(true)}
          className="h-10 flex items-center px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Sign In
        </button>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="h-10 flex items-center gap-2 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors"
      >
        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-zinc-100">{user.username}</span>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${
            showDropdown ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-zinc-900 rounded-lg shadow-lg border border-zinc-800 py-2 z-50">
          <button
            onClick={handleProfileClick}
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            👤 Profile
          </button>
          <div className="border-t border-zinc-800 my-1"></div>
          <button
            onClick={() => { setShowDropdown(false); navigate('/watchlist'); }}
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            📝 Watchlist
          </button>
          <button
            onClick={() => { setShowDropdown(false); navigate('/rated'); }}
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            ⭐ Rated Series
          </button>
          <button
            onClick={() => { setShowDropdown(false); navigate('/noted'); }}
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors text-zinc-300"
          >
            📝 My Notes
          </button>
          <div className="border-t border-zinc-800 my-1"></div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 hover:bg-zinc-800 transition-colors text-red-400"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};
