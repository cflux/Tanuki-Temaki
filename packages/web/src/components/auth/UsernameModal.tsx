import React, { useState, useEffect } from 'react';
import { authApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const updateUsername = useUserStore((state) => state.updateUsername);

  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      setError(null);
      return;
    }

    // Debounce username availability check
    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const result = await authApi.checkUsernameAvailable(username);
        if (result.error) {
          setError(result.error);
          setIsAvailable(false);
        } else {
          setError(null);
          setIsAvailable(result.available);
        }
      } catch (err) {
        setError('Failed to check username availability');
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !isAvailable) {
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.updateUsername(username);
      updateUsername(username);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update username');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950 bg-opacity-95 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-zinc-50 mb-4">Choose Your Username</h2>
        <p className="text-zinc-400 mb-6">
          Pick a unique username to complete your account setup.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-4 py-2 bg-zinc-800 border rounded-lg focus:outline-none focus:ring-2 text-zinc-100 placeholder-zinc-500 ${
                error
                  ? 'border-red-500 focus:ring-red-500'
                  : isAvailable
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-zinc-700 focus:ring-blue-500'
              }`}
              placeholder="your_username"
              autoComplete="off"
              disabled={isSubmitting}
            />
            <div className="mt-2 min-h-[20px]">
              {isChecking && (
                <p className="text-sm text-zinc-400">Checking availability...</p>
              )}
              {!isChecking && error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              {!isChecking && isAvailable && username && (
                <p className="text-sm text-green-400">Username available!</p>
              )}
              {!isChecking && isAvailable === false && !error && (
                <p className="text-sm text-red-400">Username already taken</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!isAvailable || isSubmitting || isChecking}
            className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-700 transition-colors disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </form>

        <p className="text-xs text-zinc-500 mt-4">
          3-20 characters. Letters, numbers, underscores, and hyphens only.
        </p>
      </div>
    </div>
  );
};
