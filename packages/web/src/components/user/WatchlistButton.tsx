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
      <div className="text-xs text-cyber-text-dim uppercase tracking-wide">
        SIGN IN TO ADD TO WATCHLIST
      </div>
    );
  }

  return (
    <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
      <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-2 uppercase tracking-wider ${
            status
              ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
              : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
          }`}
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          title={status ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <span className="font-bold">{status ? '[OK]' : '[+]'}</span>
          <span>{status ? 'IN WATCHLIST' : 'WATCHLIST'}</span>
        </button>
      </div>
    </div>
  );
}
