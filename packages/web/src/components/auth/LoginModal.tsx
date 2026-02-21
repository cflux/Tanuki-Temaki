import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = 'signin' | 'register';

const clipPath = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const CyberButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }> = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}) => (
  <div className="flex w-full" style={{ clipPath }}>
    <div className={`p-[1px] w-full ${variant === 'primary' ? 'bg-cyber-accent' : 'bg-cyber-border'}`} style={{ clipPath }}>
      <button
        className={`w-full flex items-center justify-center gap-3 px-6 py-3 font-medium transition-all uppercase tracking-wider font-mono text-sm ${
          variant === 'primary'
            ? 'bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg shadow-cyber-md hover:shadow-cyber-lg'
            : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{ clipPath }}
        {...props}
      >
        {children}
      </button>
    </div>
  </div>
);

const CyberInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }> = ({
  hasError,
  className = '',
  ...props
}) => (
  <input
    className={`w-full px-4 py-2 bg-cyber-bg border focus:outline-none text-cyber-text placeholder-cyber-text-dim font-mono text-sm transition-all ${
      hasError
        ? 'border-red-500 focus:shadow-[0_0_8px_rgba(255,0,0,0.5)]'
        : 'border-cyber-border focus:border-cyber-accent focus:shadow-cyber-sm'
    } ${className}`}
    {...props}
  />
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { setUser } = useUserStore();
  const [view, setView] = useState<View>('signin');

  // Sign-in state
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState('');
  const [siLoading, setSiLoading] = useState(false);

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal closes or view changes
  useEffect(() => {
    if (!isOpen) {
      setView('signin');
      setSiEmail(''); setSiPassword(''); setSiError('');
      setRegEmail(''); setRegUsername(''); setRegPassword(''); setRegConfirm(''); setRegError('');
      setUsernameAvailable(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setUsernameAvailable(null);
    setRegError('');
  }, [view]);

  // Debounced username availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!regUsername || regUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await authApi.checkUsernameAvailable(regUsername);
        setUsernameAvailable(result.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [regUsername]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiError('');
    setSiLoading(true);
    try {
      await authApi.loginWithEmail(siEmail, siPassword);
      const user = await authApi.getCurrentUser();
      if (user) setUser(user);
      onClose();
    } catch (err: any) {
      setSiError(err.response?.data?.error || 'Sign in failed. Please try again.');
    } finally {
      setSiLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    if (!usernameAvailable) {
      setRegError('Please choose an available username');
      return;
    }

    setRegLoading(true);
    try {
      await authApi.register(regEmail, regUsername, regPassword);
      const user = await authApi.getCurrentUser();
      if (user) setUser(user);
      onClose();
    } catch (err: any) {
      setRegError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-cyber-bg-elevated border-2 border-cyber-accent p-8 max-w-md w-full mx-4 shadow-cyber-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-cyber-accent pb-4">
          <h2 className="text-2xl font-bold text-cyber-text-bright uppercase tracking-widest">
            {view === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </h2>
          <button
            onClick={onClose}
            className="text-cyber-text-dim hover:text-cyber-accent text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {view === 'signin' ? (
          <>
            <form onSubmit={handleSignIn} className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">EMAIL</label>
                <CyberInput
                  type="email"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  disabled={siLoading}
                  hasError={!!siError}
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">PASSWORD</label>
                <CyberInput
                  type="password"
                  value={siPassword}
                  onChange={e => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={siLoading}
                  hasError={!!siError}
                />
              </div>
              {siError && (
                <p className="text-sm text-red-400 uppercase tracking-wide font-mono">{siError}</p>
              )}
              <CyberButton type="submit" disabled={siLoading}>
                {siLoading ? 'SIGNING IN...' : 'SIGN IN'}
              </CyberButton>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t border-cyber-border" />
              <span className="text-xs text-cyber-text-dim font-mono uppercase tracking-widest">OR</span>
              <div className="flex-1 border-t border-cyber-border" />
            </div>

            {/* Google OAuth */}
            <div className="space-y-3">
              <CyberButton type="button" variant="ghost" onClick={() => authApi.initiateGoogleOAuth()}>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                CONTINUE WITH GOOGLE
              </CyberButton>
            </div>

            <p className="text-center mt-6 text-xs text-cyber-text-dim font-mono uppercase tracking-wide border-t border-cyber-border pt-4">
              NO ACCOUNT?{' '}
              <button onClick={() => setView('register')} className="text-cyber-accent hover:underline">
                CREATE ONE
              </button>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleRegister} className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">EMAIL</label>
                <CyberInput
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  disabled={regLoading}
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">USERNAME</label>
                <CyberInput
                  type="text"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  placeholder="YOUR_USERNAME"
                  autoComplete="off"
                  required
                  disabled={regLoading}
                  hasError={usernameAvailable === false}
                />
                <div className="mt-1 min-h-[18px]">
                  {usernameChecking && (
                    <p className="text-xs text-cyber-text-dim font-mono uppercase tracking-wide">CHECKING...</p>
                  )}
                  {!usernameChecking && usernameAvailable === true && regUsername && (
                    <p className="text-xs text-cyber-accent font-mono uppercase tracking-wide">USERNAME AVAILABLE</p>
                  )}
                  {!usernameChecking && usernameAvailable === false && regUsername && (
                    <p className="text-xs text-red-400 font-mono uppercase tracking-wide">USERNAME TAKEN</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">PASSWORD</label>
                <CyberInput
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="••••••••  (min. 8 characters)"
                  autoComplete="new-password"
                  required
                  disabled={regLoading}
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-text-dim uppercase tracking-wider font-mono mb-1">CONFIRM PASSWORD</label>
                <CyberInput
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={regLoading}
                  hasError={!!regConfirm && regPassword !== regConfirm}
                />
              </div>
              {regError && (
                <p className="text-sm text-red-400 uppercase tracking-wide font-mono">{regError}</p>
              )}
              <CyberButton type="submit" disabled={regLoading || usernameAvailable !== true}>
                {regLoading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </CyberButton>
            </form>

            <p className="text-center mt-4 text-xs text-cyber-text-dim font-mono uppercase tracking-wide border-t border-cyber-border pt-4">
              ALREADY HAVE AN ACCOUNT?{' '}
              <button onClick={() => setView('signin')} className="text-cyber-accent hover:underline">
                SIGN IN
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};
