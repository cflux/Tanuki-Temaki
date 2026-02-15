import { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { userApi } from '../../lib/api';

interface WatchlistButtonProps {
  seriesId: string;
  initialStatus?: string | null;
}

export function WatchlistButton({ seriesId, initialStatus }: WatchlistButtonProps) {
  const { user } = useUserStore();
  const [status, setStatus] = useState<string | null>(initialStatus || null);
  const [isLoading, setIsLoading] = useState(false);

  // Update status when initialStatus prop changes
  useEffect(() => {
    if (initialStatus !== undefined) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  // Fetch initial watchlist status only if not provided via props
  useEffect(() => {
    if (!user || initialStatus !== undefined) return;

    const fetchStatus = async () => {
      try {
        const result = await userApi.getWatchlistStatus(seriesId);
        setStatus(result?.status || null);
      } catch (error) {
        console.error('Failed to fetch watchlist status:', error);
      }
    };

    fetchStatus();
  }, [seriesId, user, initialStatus]);

  const handleToggle = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (status) {
        // Remove from watchlist
        await userApi.removeFromWatchlist(seriesId);
        setStatus(null);
      } else {
        // Add to watchlist
        await userApi.addToWatchlist(seriesId, 'plan_to_watch');
        setStatus('plan_to_watch');
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-xs text-zinc-500">
        Sign in to add to watchlist
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        status
          ? 'bg-green-600/20 border border-green-600/50 text-green-300 hover:bg-green-600/30'
          : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
      }`}
      title={status ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <span>{status ? '✓' : '+'}</span>
      <span>{status ? 'In Watchlist' : 'Watchlist'}</span>
    </button>
  );
}
