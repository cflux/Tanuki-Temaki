import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { UsernameModal } from './UsernameModal';
import { NAVIGATION_DELAY } from '../../config/uiConstants';

export const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useUserStore((state) => state.setUser);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const status = searchParams.get('status');
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
        return;
      }

      if (!token) {
        setError('Missing authentication token');
        setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
        return;
      }

      try {
        // Exchange the token for proper auth cookies
        const response = await authApi.exchangeToken(token);

        if (!response.success) {
          setError('Failed to complete authentication');
          setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
          return;
        }

        // Fetch user data (cookies are now set)
        const user = await authApi.getCurrentUser();
        if (!user) {
          setError('Failed to fetch user data');
          setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
          return;
        }

        setUser(user);

        // Check if username is needed
        if (status === 'needs_username' || response.needsUsername) {
          setShowUsernameModal(true);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Failed to complete authentication');
        setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUser]);

  const handleUsernameComplete = () => {
    setShowUsernameModal(false);
    navigate('/');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <div className="text-center border-2 border-red-500 p-8 shadow-[0_0_12px_rgba(255,0,0,0.5)]">
          <div className="text-red-500 text-xl mb-2 uppercase tracking-widest font-bold">AUTHENTICATION ERROR</div>
          <p className="text-cyber-text font-mono">{error}</p>
          <p className="text-sm text-cyber-text-dim mt-2 uppercase tracking-wide font-mono">REDIRECTING...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent mx-auto mb-4"></div>
          <p className="text-cyber-text uppercase tracking-wider font-mono">COMPLETING AUTHENTICATION...</p>
        </div>
      </div>
      <UsernameModal isOpen={showUsernameModal} onClose={handleUsernameComplete} />
    </>
  );
};
