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
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-cyber-bg-elevated border-2 border-cyber-accent p-8 max-w-md w-full mx-4 shadow-cyber-xl">
        <h2 className="text-2xl font-bold text-cyber-text-bright mb-4 uppercase tracking-widest border-b border-cyber-accent pb-3">CHOOSE USERNAME</h2>
        <p className="text-cyber-text-dim mb-6 font-mono">
          PICK A UNIQUE USERNAME TO COMPLETE YOUR ACCOUNT SETUP.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-cyber-text mb-2 uppercase tracking-wide">
              USERNAME
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-4 py-2 bg-cyber-bg border focus:outline-none text-cyber-text placeholder-cyber-text-dim font-mono transition-all ${
                error
                  ? 'border-red-500 focus:shadow-[0_0_8px_rgba(255,0,0,0.5)]'
                  : isAvailable
                  ? 'border-cyber-accent focus:shadow-cyber-sm'
                  : 'border-cyber-border focus:border-cyber-accent focus:shadow-cyber-sm'
              }`}
              placeholder="YOUR_USERNAME"
              autoComplete="off"
              disabled={isSubmitting}
            />
            <div className="mt-2 min-h-[20px]">
              {isChecking && (
                <p className="text-sm text-cyber-text-dim uppercase tracking-wide font-mono">CHECKING AVAILABILITY...</p>
              )}
              {!isChecking && error && (
                <p className="text-sm text-red-400 uppercase tracking-wide font-mono">{error}</p>
              )}
              {!isChecking && isAvailable && username && (
                <p className="text-sm text-cyber-accent uppercase tracking-wide font-mono">USERNAME AVAILABLE!</p>
              )}
              {!isChecking && isAvailable === false && !error && (
                <p className="text-sm text-red-400 uppercase tracking-wide font-mono">USERNAME ALREADY TAKEN</p>
              )}
            </div>
          </div>

          <div className="flex w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="bg-cyber-accent p-[1px] w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <button
                type="submit"
                disabled={!isAvailable || isSubmitting || isChecking}
                className="w-full bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg px-6 py-3 font-medium transition-all disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:cursor-not-allowed uppercase tracking-wider shadow-cyber-md hover:shadow-cyber-lg"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                {isSubmitting ? 'SAVING...' : 'CONTINUE'}
              </button>
            </div>
          </div>
        </form>

        <p className="text-xs text-cyber-text-dim mt-4 font-mono uppercase tracking-wide border-t border-cyber-border pt-4">
          3-20 CHARACTERS. LETTERS, NUMBERS, UNDERSCORES, AND HYPHENS ONLY.
        </p>
      </div>
    </div>
  );
};
