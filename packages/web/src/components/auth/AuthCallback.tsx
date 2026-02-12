import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { UsernameModal } from './UsernameModal';

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
        setTimeout(() => navigate('/'), 3000);
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
            setTimeout(() => navigate('/'), 3000);
          }
        } catch (err) {
          setError('Failed to fetch user data');
          setTimeout(() => navigate('/'), 3000);
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
            setTimeout(() => navigate('/'), 3000);
          }
        } catch (err) {
          setError('Failed to fetch user data');
          setTimeout(() => navigate('/'), 3000);
        }
      } else {
        setError('Invalid callback status');
        setTimeout(() => navigate('/'), 3000);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">Authentication Error</div>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing authentication...</p>
        </div>
      </div>
      <UsernameModal isOpen={showUsernameModal} onClose={handleUsernameComplete} />
    </>
  );
};
