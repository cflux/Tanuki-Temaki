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
    if (rating === 0) return '✗';
    return '★'.repeat(rating);
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
        <h1 className="text-3xl font-bold mb-6 text-cyber-text-bright uppercase tracking-widest border-b border-cyber-border pb-4">[STAR] RATINGS</h1>

        {/* Media Type Filter */}
        <div className="mb-4">
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
                  ALL ({ratedSeries.length})
                </button>
              </div>
            </div>
            {['ANIME', 'MANGA'].map(type => {
              const count = ratedSeries.filter(item => item.series.mediaType === type).length;
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

        {/* Star Rating Filter (for positive ratings only) */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
              <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                <button
                  onClick={() => setFilterRating('all')}
                  className={`px-3 py-1.5 text-sm font-medium transition-all uppercase tracking-wide font-mono ${
                    filterRating === 'all'
                      ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                      : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
                  }`}
                  style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                >
                  ALL ({positiveSeries.length})
                </button>
              </div>
            </div>
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratedSeries.filter(item => {
                const matchesMediaType = filterMediaType === 'all' || item.series.mediaType === filterMediaType;
                return matchesMediaType && item.rating === rating;
              }).length;
              return (
                <div key={rating} className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setFilterRating(rating)}
                      className={`px-3 py-1.5 text-sm font-medium transition-all uppercase tracking-wide font-mono ${
                        filterRating === rating
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                    >
                      {getRatingIcon(rating)} ({count})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <>
          {/* Positive Ratings Section */}
          {positiveSeries.length === 0 ? (
          <div className="bg-cyber-bg-card p-8 text-center border border-cyber-border mb-8">
            <p className="text-cyber-text-dim mb-4 font-mono uppercase tracking-wide">
              {filterRating === 'all'
                ? "YOU HAVEN'T RATED ANY SERIES POSITIVELY YET"
                : `NO SERIES RATED ${getRatingIcon(filterRating as number)}`
              }
            </p>
            <p className="text-sm text-cyber-text-dim font-mono">
              RATE SERIES FROM THE DISCOVERY PAGE TO SEE THEM HERE
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">
              <span className="text-cyber-accent">★</span>
              LIKED SERIES
              <span className="text-sm text-cyber-text-dim font-mono">({positiveSeries.length})</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {positiveSeries.map((item) => (
                <div
                  key={item.id}
                  className="bg-cyber-bg-card border border-cyber-border p-6 hover:border-cyber-accent transition-colors"
                >
                  <div className="flex gap-4">
                    {item.series.titleImage && (
                      <img
                        src={item.series.titleImage}
                        alt={item.series.title}
                        className="w-32 h-48 object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-xl flex-1 min-w-0 text-cyber-text-bright uppercase tracking-wide">{item.series.title}</h3>
                        <span className="px-2 py-1 bg-transparent border border-cyber-accent text-cyber-accent text-xs flex-shrink-0 uppercase tracking-wide">
                          {item.series.mediaType === 'ANIME' ? '[TV]' : '[BK]'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1">
                          <span className="text-2xl text-cyber-accent">{getRatingIcon(item.rating)}</span>
                          <span className="text-sm text-cyber-text-dim ml-1 font-mono uppercase">
                            {item.rating}/5
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-cyber-text-dim mb-3 font-mono uppercase tracking-wide">
                        RATED {new Date(item.updatedAt).toLocaleDateString()}
                      </div>

                      <div className="mt-auto">
                        <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                          <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                            <button
                              onClick={() => navigate('/', { state: { exploreTitle: item.series.title, exploreMediaType: item.series.mediaType } })}
                              className="px-4 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all uppercase tracking-wide"
                              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                            >
                              EXPLORE
                            </button>
                          </div>
                        </div>
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
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">
              <span className="text-red-500">✗</span>
              NOT FOR ME
              <span className="text-sm text-cyber-text-dim font-mono">({thumbsDownSeries.length})</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {thumbsDownSeries.map((item) => (
                <div
                  key={item.id}
                  className="bg-cyber-bg-card border border-cyber-border p-6 hover:border-cyber-accent transition-colors"
                >
                  <div className="flex gap-4">
                    {item.series.titleImage && (
                      <img
                        src={item.series.titleImage}
                        alt={item.series.title}
                        className="w-32 h-48 object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-xl flex-1 min-w-0 text-cyber-text-bright uppercase tracking-wide">{item.series.title}</h3>
                      <span className="px-2 py-1 bg-transparent border border-cyber-accent text-cyber-accent text-xs flex-shrink-0 uppercase tracking-wide">
                        {item.series.mediaType === 'ANIME' ? '[TV]' : '[BK]'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl text-red-500">{getRatingIcon(item.rating)}</span>
                        <span className="text-sm text-cyber-text-dim ml-1 font-mono uppercase">
                          NOT FOR ME
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-cyber-text-dim mb-3 font-mono uppercase tracking-wide">
                      RATED {new Date(item.updatedAt).toLocaleDateString()}
                    </div>

                    <div className="mt-auto">
                      <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                        <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                          <button
                            onClick={() => navigate('/', { state: { exploreTitle: item.series.title, exploreMediaType: item.series.mediaType } })}
                            className="px-4 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all uppercase tracking-wide"
                            style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                          >
                            EXPLORE
                          </button>
                        </div>
                      </div>
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
