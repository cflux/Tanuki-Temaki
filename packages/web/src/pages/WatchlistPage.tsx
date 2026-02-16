import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { userApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function WatchlistPage() {
  const { user, isLoading: authLoading } = useUserStore();
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMediaType, setFilterMediaType] = useState<string | 'all'>('all');

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate('/');
      return;
    }

    const fetchWatchlist = async () => {
      try {
        const data = await userApi.getWatchlist();
        setWatchlist(data);
      } catch (error) {
        console.error('Failed to fetch watchlist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWatchlist();
  }, [user, authLoading, navigate]);

  const filteredWatchlist = watchlist.filter(item => {
    const matchesMediaType = filterMediaType === 'all' || item.series.mediaType === filterMediaType;
    return matchesMediaType;
  });

  const handleRemove = async (seriesId: string) => {
    try {
      await userApi.removeFromWatchlist(seriesId);
      setWatchlist(watchlist.filter(item => item.seriesId !== seriesId));
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pt-24 md:pt-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-cyber-text-bright uppercase tracking-widest border-b border-cyber-border pb-4">[LIST] WATCHLIST</h1>

        {/* Media Type Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
              <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                <button
                  onClick={() => setFilterMediaType('all')}
                  className={`px-3 py-1.5 text-sm font-medium transition-all uppercase tracking-wide ${
                    filterMediaType === 'all'
                      ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                      : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
                  }`}
                  style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                >
                  ALL ({watchlist.length})
                </button>
              </div>
            </div>
            {['ANIME', 'MANGA'].map(type => {
              const count = watchlist.filter(item => item.series.mediaType === type).length;
              return (
                <div key={type} className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setFilterMediaType(type)}
                      className={`px-3 py-1.5 text-sm font-medium transition-all uppercase tracking-wide ${
                        filterMediaType === type
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                      {type === 'ANIME' ? '[TV]' : '[BK]'} {type} ({count})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {filteredWatchlist.length === 0 ? (
          <div className="bg-cyber-bg-card p-8 text-center border border-cyber-border">
            <p className="text-cyber-text-dim mb-4 font-mono uppercase tracking-wide">
              {watchlist.length === 0 ? 'YOUR WATCHLIST IS EMPTY' : `NO ${filterMediaType === 'all' ? '' : filterMediaType} SERIES IN YOUR WATCHLIST`}
            </p>
            <p className="text-sm text-cyber-text-dim font-mono">
              ADD SERIES YOU WANT TO WATCH/READ LATER FROM THE DISCOVERY PAGE
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWatchlist.map((item) => (
              <div
                key={item.id}
                className="bg-cyber-bg-card border border-cyber-border overflow-hidden hover:border-cyber-accent transition-colors"
              >
                {item.series.titleImage && (
                  <img
                    src={item.series.titleImage}
                    alt={item.series.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 text-cyber-text-bright uppercase tracking-wide">{item.series.title}</h3>
                  <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                    <span className="px-2 py-1 bg-transparent border border-cyber-accent text-cyber-accent uppercase tracking-wide">
                      {item.series.mediaType === 'ANIME' ? '[TV]' : '[BK]'} {item.series.mediaType}
                    </span>
                    <span className="text-cyber-text-dim font-mono uppercase tracking-wide">
                      ADDED {new Date(item.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="inline-flex w-full" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <div className="bg-red-500 p-[1px] w-full" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                      <button
                        onClick={() => handleRemove(item.seriesId)}
                        className="w-full px-3 py-2 bg-cyber-bg border border-red-500 text-red-400 text-sm hover:bg-red-500 hover:text-black transition-all uppercase tracking-wider"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
