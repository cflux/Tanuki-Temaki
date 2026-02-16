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
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
        return;
      }

      if (status === 'needs_username') {
        // User needs to set username
        try {
          const user = await authApi.getCurrentUser();
          if (user) {
            setUser(user);
            setShowUsernameModal(true);
          } else {
            setError('Failed to fetch user data');
            setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
          }
        } catch (err) {
          setError('Failed to fetch user data');
          setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
        }
      } else if (status === 'success') {
        // User logged in successfully
        try {
          const user = await authApi.getCurrentUser();
          if (user) {
            setUser(user);
            navigate('/');
          } else {
            setError('Failed to fetch user data');
            setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
          }
        } catch (err) {
          setError('Failed to fetch user data');
          setTimeout(() => navigate('/'), NAVIGATION_DELAY.REDIRECT);
        }
      } else {
        setError('Invalid callback status');
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
