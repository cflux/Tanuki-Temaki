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
        <div className="text-zinc-400">Loading watchlist...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📝 My Watchlist</h1>

        {/* Media Type Filter */}
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMediaType('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterMediaType === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              All Types ({watchlist.length})
            </button>
            {['ANIME', 'MANGA'].map(type => {
              const count = watchlist.filter(item => item.series.mediaType === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setFilterMediaType(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterMediaType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {type === 'ANIME' ? '📺' : '📖'} {type} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {filteredWatchlist.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg p-8 text-center border border-zinc-800">
            <p className="text-zinc-400 mb-4">
              {watchlist.length === 0 ? 'Your watchlist is empty' : `No ${filterMediaType === 'all' ? '' : filterMediaType.toLowerCase()} series in your watchlist`}
            </p>
            <p className="text-sm text-zinc-500">
              Add series you want to watch/read later from the discovery page
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWatchlist.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors"
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
                  <h3 className="font-semibold text-lg mb-2">{item.series.title}</h3>
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="px-2 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-300 rounded">
                      {item.series.mediaType}
                    </span>
                    <span className="text-zinc-500">
                      Added {new Date(item.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(item.seriesId)}
                    className="w-full px-3 py-2 bg-red-600/20 border border-red-600/50 text-red-300 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
                  >
                    Remove from Watchlist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
