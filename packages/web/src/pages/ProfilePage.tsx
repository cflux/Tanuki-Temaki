import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { userApi, authApi, type UserRating } from '../lib/api';
import { ServicePreferences } from '../components/user/ServicePreferences';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const authLoading = useUserStore((state) => state.isLoading);
  const updateUsername = useUserStore((state) => state.updateUsername);
  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [tagPreferences, setTagPreferences] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Username editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [ratingsData, tagPrefsData] = await Promise.all([
          userApi.getAllRatings(),
          userApi.getTagPreferences(),
        ]);

        setRatings(ratingsData);
        setTagPreferences(tagPrefsData);
      } catch (error) {
        console.error('Failed to load profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, navigate]);

  // Check username availability when editing
  useEffect(() => {
    if (!isEditingUsername || !newUsername || newUsername === user?.username) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const result = await authApi.checkUsernameAvailable(newUsername);
        if (result.error) {
          setUsernameError(result.error);
          setIsUsernameAvailable(false);
        } else {
          setUsernameError(null);
          setIsUsernameAvailable(result.available);
        }
      } catch (err) {
        setUsernameError('Failed to check username availability');
        setIsUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newUsername, isEditingUsername, user]);

  const handleEditUsername = () => {
    setNewUsername(user?.username || '');
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async () => {
    if (!newUsername || !isUsernameAvailable) return;

    setIsSavingUsername(true);
    try {
      await authApi.updateUsername(newUsername);
      updateUsername(newUsername);
      setIsEditingUsername(false);
    } catch (err: any) {
      setUsernameError(err.response?.data?.error || 'Failed to update username');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingUsername(false);
    setNewUsername('');
    setUsernameError(null);
    setIsUsernameAvailable(null);
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent"></div>
        </div>
      </div>
    );
  }

  // Sort tag preferences by score
  const sortedTagPrefs = Object.entries(tagPreferences)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  const likedTags = sortedTagPrefs.filter(([, score]) => score > 0).slice(0, 20);
  const dislikedTags = sortedTagPrefs.filter(([, score]) => score < 0).slice(0, 20);

  // Group ratings by rating value
  const ratingGroups = {
    5: ratings.filter(r => r.rating === 5),
    4: ratings.filter(r => r.rating === 4),
    3: ratings.filter(r => r.rating === 3),
    2: ratings.filter(r => r.rating === 2),
    1: ratings.filter(r => r.rating === 1),
    0: ratings.filter(r => r.rating === 0),
  };

  return (
    <div className="container mx-auto px-4 py-8 pt-24 md:pt-8">
      {/* Header */}
      <div className="mb-8 border-b border-cyber-border pb-4">
        <h1 className="text-3xl font-bold text-cyber-text-bright uppercase tracking-widest mb-2">[USER] PROFILE</h1>

        {!isEditingUsername ? (
          <div className="flex items-center gap-3">
            <p className="text-cyber-text-dim font-mono">@{user.username}</p>
            <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
              <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                <button
                  onClick={handleEditUsername}
                  className="px-3 py-1 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-xs font-medium transition-all uppercase tracking-wide"
                  style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                >
                  EDIT
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-cyber-text-dim font-mono">@</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="px-3 py-1.5 bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-accent font-mono flex-1"
                placeholder="new_username"
                autoFocus
                disabled={isSavingUsername}
              />
            </div>

            {/* Status messages */}
            <div className="min-h-[20px] text-sm font-mono uppercase tracking-wide">
              {isCheckingUsername && (
                <p className="text-cyber-text-dim">CHECKING...</p>
              )}
              {!isCheckingUsername && usernameError && (
                <p className="text-red-400">{usernameError}</p>
              )}
              {!isCheckingUsername && isUsernameAvailable && newUsername !== user.username && (
                <p className="text-green-400">AVAILABLE!</p>
              )}
              {!isCheckingUsername && isUsernameAvailable === false && !usernameError && (
                <p className="text-red-400">TAKEN</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <button
                    onClick={handleSaveUsername}
                    disabled={!isUsernameAvailable || isSavingUsername || newUsername === user.username || isCheckingUsername}
                    className="px-4 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:cursor-not-allowed uppercase tracking-wide"
                    style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                  >
                    {isSavingUsername ? 'SAVING...' : 'SAVE'}
                  </button>
                </div>
              </div>
              <button
                onClick={handleCancelEdit}
                disabled={isSavingUsername}
                className="px-4 py-1.5 text-cyber-text-dim hover:text-cyber-text text-sm transition-colors uppercase tracking-wide"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-cyber-bg-card p-6 border border-cyber-border">
          <div className="text-3xl font-bold text-cyber-accent font-mono">{ratings.length}</div>
          <div className="text-sm text-cyber-text-dim mt-1 uppercase tracking-wide">SERIES RATED</div>
        </div>

        <div className="bg-cyber-bg-card p-6 border border-cyber-border">
          <div className="text-3xl font-bold text-green-500 font-mono">{likedTags.length}</div>
          <div className="text-sm text-cyber-text-dim mt-1 uppercase tracking-wide">LIKED TAGS</div>
        </div>

        <div className="bg-cyber-bg-card p-6 border border-cyber-border">
          <div className="text-3xl font-bold text-red-500 font-mono">{dislikedTags.length}</div>
          <div className="text-sm text-cyber-text-dim mt-1 uppercase tracking-wide">DISLIKED TAGS</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tag Preferences */}
        <div className="space-y-6">
          {/* Liked Tags */}
          <div className="bg-cyber-bg-card p-6 border border-cyber-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">
              <span className="text-green-500">✓</span>
              TAGS YOU LIKE
            </h2>

            {likedTags.length > 0 ? (
              <div className="space-y-2">
                {likedTags.map(([tag, score]) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between py-2 px-3 bg-cyber-bg-elevated border border-cyber-border"
                  >
                    <span className="text-cyber-text uppercase tracking-wide text-sm">{tag}</span>
                    <span className="text-green-500 font-mono font-bold">+{score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide">
                NO LIKED TAGS YET. VOTE ON TAGS WHILE BROWSING SERIES!
              </p>
            )}
          </div>

          {/* Disliked Tags */}
          <div className="bg-cyber-bg-card p-6 border border-cyber-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">
              <span className="text-red-500">✗</span>
              TAGS YOU DISLIKE
            </h2>

            {dislikedTags.length > 0 ? (
              <div className="space-y-2">
                {dislikedTags.map(([tag, score]) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between py-2 px-3 bg-cyber-bg-elevated border border-cyber-border"
                  >
                    <span className="text-cyber-text uppercase tracking-wide text-sm">{tag}</span>
                    <span className="text-red-500 font-mono font-bold">{score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide">
                NO DISLIKED TAGS YET. VOTE ON TAGS WHILE BROWSING SERIES!
              </p>
            )}
          </div>
        </div>

        {/* Ratings History */}
        <div className="bg-cyber-bg-card p-6 border border-cyber-border">
          <h2 className="text-xl font-bold mb-4 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">YOUR RATINGS</h2>

          {ratings.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(ratingGroups).reverse().map(([rating, items]) => {
                if (items.length === 0) return null;

                return (
                  <div key={rating}>
                    <div className="flex items-center gap-2 mb-2">
                      {rating === '0' ? (
                        <span className="text-red-500 text-sm font-medium uppercase tracking-wide">✗ DISLIKED</span>
                      ) : (
                        <span className="text-cyber-accent text-sm font-medium font-mono">
                          {'★'.repeat(parseInt(rating))} ({rating}/5)
                        </span>
                      )}
                      <span className="text-cyber-text-dim text-sm font-mono">({items.length})</span>
                    </div>

                    <div className="space-y-1 pl-4">
                      {items.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="text-sm text-cyber-text-dim hover:text-cyber-text cursor-pointer font-mono"
                        >
                          • {(item as any).series?.title || 'Unknown Series'}
                        </div>
                      ))}
                      {items.length > 5 && (
                        <div className="text-xs text-cyber-text-dim font-mono">
                          ...AND {items.length - 5} MORE
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide">
              NO RATINGS YET. START RATING SERIES TO BUILD YOUR PROFILE!
            </p>
          )}
        </div>
      </div>

      {/* Service Preferences */}
      <div className="mt-8 bg-cyber-bg-card p-6 border border-cyber-border">
        <ServicePreferences userId={user.id} />
      </div>
    </div>
  );
};
