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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>

        {!isEditingUsername ? (
          <div className="flex items-center gap-3">
            <p className="text-zinc-400">@{user.username}</p>
            <button
              onClick={handleEditUsername}
              className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
            >
              Edit Username
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">@</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                placeholder="new_username"
                autoFocus
                disabled={isSavingUsername}
              />
            </div>

            {/* Status messages */}
            <div className="min-h-[20px] text-sm">
              {isCheckingUsername && (
                <p className="text-zinc-400">Checking availability...</p>
              )}
              {!isCheckingUsername && usernameError && (
                <p className="text-red-400">{usernameError}</p>
              )}
              {!isCheckingUsername && isUsernameAvailable && newUsername !== user.username && (
                <p className="text-green-400">Username available!</p>
              )}
              {!isCheckingUsername && isUsernameAvailable === false && !usernameError && (
                <p className="text-red-400">Username already taken</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveUsername}
                disabled={!isUsernameAvailable || isSavingUsername || newUsername === user.username || isCheckingUsername}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                {isSavingUsername ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSavingUsername}
                className="px-4 py-1.5 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="text-3xl font-bold text-blue-500">{ratings.length}</div>
          <div className="text-sm text-zinc-400 mt-1">Series Rated</div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="text-3xl font-bold text-green-500">{likedTags.length}</div>
          <div className="text-sm text-zinc-400 mt-1">Liked Tags</div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <div className="text-3xl font-bold text-red-500">{dislikedTags.length}</div>
          <div className="text-sm text-zinc-400 mt-1">Disliked Tags</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tag Preferences */}
        <div className="space-y-6">
          {/* Liked Tags */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-green-500">👍</span>
              Tags You Like
            </h2>

            {likedTags.length > 0 ? (
              <div className="space-y-2">
                {likedTags.map(([tag, score]) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded"
                  >
                    <span className="text-zinc-300">{tag}</span>
                    <span className="text-green-500 font-mono">+{score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">
                No liked tags yet. Vote on tags while browsing series!
              </p>
            )}
          </div>

          {/* Disliked Tags */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-red-500">👎</span>
              Tags You Dislike
            </h2>

            {dislikedTags.length > 0 ? (
              <div className="space-y-2">
                {dislikedTags.map(([tag, score]) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded"
                  >
                    <span className="text-zinc-300">{tag}</span>
                    <span className="text-red-500 font-mono">{score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">
                No disliked tags yet. Vote on tags while browsing series!
              </p>
            )}
          </div>
        </div>

        {/* Ratings History */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <h2 className="text-xl font-bold mb-4">Your Ratings</h2>

          {ratings.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(ratingGroups).reverse().map(([rating, items]) => {
                if (items.length === 0) return null;

                return (
                  <div key={rating}>
                    <div className="flex items-center gap-2 mb-2">
                      {rating === '0' ? (
                        <span className="text-red-500 text-sm font-medium">👎 Disliked</span>
                      ) : (
                        <span className="text-yellow-500 text-sm font-medium">
                          {'★'.repeat(parseInt(rating))} ({rating}/5)
                        </span>
                      )}
                      <span className="text-zinc-500 text-sm">({items.length})</span>
                    </div>

                    <div className="space-y-1 pl-4">
                      {items.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="text-sm text-zinc-400 hover:text-zinc-300 cursor-pointer"
                        >
                          • {(item as any).series?.title || 'Unknown Series'}
                        </div>
                      ))}
                      {items.length > 5 && (
                        <div className="text-xs text-zinc-600">
                          ...and {items.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">
              No ratings yet. Start rating series to build your profile!
            </p>
          )}
        </div>
      </div>

      {/* Service Preferences */}
      <div className="mt-8 bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <ServicePreferences userId={user.id} />
      </div>
    </div>
  );
};
