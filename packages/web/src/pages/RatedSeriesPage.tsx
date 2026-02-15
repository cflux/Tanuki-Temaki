import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { userApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function RatedSeriesPage() {
  const { user, isLoading: authLoading } = useUserStore();
  const navigate = useNavigate();
  const [ratedSeries, setRatedSeries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | 'all'>('all');
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

    const fetchRated = async () => {
      try {
        const data = await userApi.getRatedSeries();
        setRatedSeries(data);
      } catch (error) {
        console.error('Failed to fetch rated series:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRated();
  }, [user, authLoading, navigate]);

  // Split series into positive (1-5 stars) and negative (0 stars/thumbs down)
  const positiveSeries = ratedSeries.filter(item => {
    const matchesMediaType = filterMediaType === 'all' || item.series.mediaType === filterMediaType;
    const isPositive = item.rating > 0;
    const matchesRating = filterRating === 'all' || item.rating === filterRating;
    return matchesMediaType && isPositive && matchesRating;
  });

  const thumbsDownSeries = ratedSeries.filter(item => {
    const matchesMediaType = filterMediaType === 'all' || item.series.mediaType === filterMediaType;
    return matchesMediaType && item.rating === 0;
  });

  const getRatingIcon = (rating: number) => {
    if (rating === 0) return '👎';
    return '⭐'.repeat(rating);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading rated series...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">⭐ My Ratings</h1>

        {/* Media Type Filter */}
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMediaType('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterMediaType === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              All Types ({ratedSeries.length})
            </button>
            {['ANIME', 'MANGA'].map(type => {
              const count = ratedSeries.filter(item => item.series.mediaType === type).length;
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

        {/* Star Rating Filter (for positive ratings only) */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterRating('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterRating === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              All Ratings ({positiveSeries.length})
            </button>
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratedSeries.filter(item => {
                const matchesMediaType = filterMediaType === 'all' || item.series.mediaType === filterMediaType;
                return matchesMediaType && item.rating === rating;
              }).length;
              return (
                <button
                  key={rating}
                  onClick={() => setFilterRating(rating)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterRating === rating
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {getRatingIcon(rating)} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <>
          {/* Positive Ratings Section */}
          {positiveSeries.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg p-8 text-center border border-zinc-800 mb-8">
            <p className="text-zinc-400 mb-4">
              {filterRating === 'all'
                ? "You haven't rated any series positively yet"
                : `No series rated ${getRatingIcon(filterRating as number)}`
              }
            </p>
            <p className="text-sm text-zinc-500">
              Rate series from the discovery page to see them here
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-yellow-500">⭐</span>
              Liked Series
              <span className="text-sm text-zinc-500 font-normal">({positiveSeries.length})</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {positiveSeries.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex gap-4">
                    {item.series.titleImage && (
                      <img
                        src={item.series.titleImage}
                        alt={item.series.title}
                        className="w-32 h-48 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-xl flex-1 min-w-0">{item.series.title}</h3>
                        <span className="px-2 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-300 rounded text-xs flex-shrink-0">
                          {item.series.mediaType}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1">
                          <span className="text-2xl">{getRatingIcon(item.rating)}</span>
                          <span className="text-sm text-zinc-400 ml-1">
                            {item.rating} star{item.rating !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-500 mb-3">
                        Rated {new Date(item.updatedAt).toLocaleDateString()}
                      </div>

                      <div className="mt-auto">
                        <button
                          onClick={() => navigate('/', { state: { exploreTitle: item.series.title, exploreMediaType: item.series.mediaType } })}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                        >
                          🔍 Explore
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thumbs Down Section */}
        {thumbsDownSeries.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-red-500">👎</span>
              Not For Me
              <span className="text-sm text-zinc-500 font-normal">({thumbsDownSeries.length})</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {thumbsDownSeries.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex gap-4">
                    {item.series.titleImage && (
                      <img
                        src={item.series.titleImage}
                        alt={item.series.title}
                        className="w-32 h-48 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-xl flex-1 min-w-0">{item.series.title}</h3>
                      <span className="px-2 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-300 rounded text-xs flex-shrink-0">
                        {item.series.mediaType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl">{getRatingIcon(item.rating)}</span>
                        <span className="text-sm text-zinc-400 ml-1">
                          {item.rating === 0 ? 'Not for me' : `${item.rating} star${item.rating !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 mb-3">
                      Rated {new Date(item.updatedAt).toLocaleDateString()}
                    </div>

                    <div className="mt-auto">
                      <button
                        onClick={() => navigate('/', { state: { exploreTitle: item.series.title, exploreMediaType: item.series.mediaType } })}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                      >
                        🔍 Explore
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
      </div>
    </div>
  );
}
