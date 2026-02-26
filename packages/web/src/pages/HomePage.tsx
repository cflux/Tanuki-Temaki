import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { userApi, recommendationApi } from '../lib/api';
import type { RecommendedSeries, UserWatchlistWithSeries, UserRatingWithSeries } from '../lib/api';

// Portrait card for watchlist items
function WatchlistCard({ item }: { item: UserWatchlistWithSeries }) {
  return (
    <Link
      to={`/series/${item.seriesId}`}
      className="bg-cyber-bg-elevated border border-cyber-border overflow-hidden hover:border-cyber-accent transition-colors flex flex-col"
    >
      <div className="relative aspect-[2/3] w-full bg-cyber-bg-card">
        {item.series.titleImage ? (
          <img
            src={item.series.titleImage}
            alt={item.series.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cyber-text-dim text-xs font-mono uppercase">
            NO IMAGE
          </div>
        )}
        <span className="absolute top-1 left-1 text-xs text-cyber-accent border border-cyber-accent bg-cyber-bg px-1 uppercase leading-tight">
          {item.series.mediaType === 'ANIME' ? 'TV' : 'BK'}
        </span>
      </div>
      <div className="p-2 flex-1">
        <p className="text-cyber-text-bright text-xs font-semibold uppercase tracking-wide line-clamp-2 leading-tight">
          {item.series.title}
        </p>
        <p className="text-cyber-text-dim text-xs font-mono mt-1">
          {new Date(item.addedAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}

// Portrait card for rated series
function RatedCard({ item }: { item: UserRatingWithSeries }) {
  return (
    <Link
      to={`/series/${item.seriesId ?? item.series?.id}`}
      className="bg-cyber-bg-elevated border border-cyber-border overflow-hidden hover:border-cyber-accent transition-colors flex flex-col"
    >
      <div className="relative aspect-[2/3] w-full bg-cyber-bg-card">
        {item.series?.titleImage ? (
          <img
            src={item.series.titleImage}
            alt={item.series?.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cyber-text-dim text-xs font-mono uppercase">
            NO IMAGE
          </div>
        )}
        <span className="absolute bottom-1 left-1 text-cyber-accent text-xs font-bold bg-cyber-bg px-1 leading-tight">
          {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
        </span>
      </div>
      <div className="p-2 flex-1">
        <p className="text-cyber-text-bright text-xs font-semibold uppercase tracking-wide line-clamp-2 leading-tight">
          {item.series?.title}
        </p>
      </div>
    </Link>
  );
}

// Portrait card for recommendations
function RecommendationCard({ rec }: { rec: RecommendedSeries }) {
  return (
    <Link
      to={`/series/${rec.series.id}`}
      className="bg-cyber-bg-elevated border border-cyber-border overflow-hidden hover:border-cyber-accent transition-colors flex flex-col"
    >
      <div className="relative aspect-[2/3] w-full bg-cyber-bg-card">
        {rec.series.titleImage ? (
          <img
            src={rec.series.titleImage}
            alt={rec.series.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cyber-text-dim text-xs font-mono uppercase">
            NO IMAGE
          </div>
        )}
        {rec.matchedTags.length > 0 && (
          <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
            {rec.matchedTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1 bg-cyber-bg border border-cyber-border text-cyber-text-dim uppercase leading-tight"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 flex-1">
        <p className="text-cyber-text-bright text-xs font-semibold uppercase tracking-wide line-clamp-2 leading-tight">
          {rec.series.title}
        </p>
        {rec.basedOnTitles.length > 0 && (
          <p className="text-cyber-text-dim text-xs font-mono mt-0.5 truncate">
            ↳ {rec.basedOnTitles[0]}
          </p>
        )}
      </div>
    </Link>
  );
}

function SectionSpinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-8 w-8 border-2 border-cyber-border border-t-cyber-accent" />
    </div>
  );
}

export function HomePage() {
  const { user, isLoading: authLoading } = useUserStore();
  const navigate = useNavigate();

  const [watchlist, setWatchlist] = useState<UserWatchlistWithSeries[]>([]);
  const [topRated, setTopRated] = useState<UserRatingWithSeries[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedSeries[]>([]);

  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [loadingRated, setLoadingRated] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }

    Promise.all([
      userApi.getWatchlist()
        .then((data) => setWatchlist(data))
        .catch(() => setWatchlist([]))
        .finally(() => setLoadingWatchlist(false)),

      userApi.getRatedSeries()
        .then((data) => {
          const filtered = data
            .filter((item) => item.rating >= 4)
            .sort((a, b) => b.rating - a.rating);
          setTopRated(filtered);
        })
        .catch(() => setTopRated([]))
        .finally(() => setLoadingRated(false)),

      recommendationApi.getRecommendations()
        .then(({ recommendations: recs }) => setRecommendations(recs))
        .catch(() => setRecommendations([]))
        .finally(() => setLoadingRecs(false)),
    ]);
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text p-6 pt-24 md:pt-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-cyber-text-bright uppercase tracking-widest mb-1">
            [HOME] DASHBOARD
          </h1>
          <p className="text-cyber-text-dim font-mono text-sm">
            WELCOME BACK, {user.username.toUpperCase()}
          </p>
        </div>

        {/* ── WATCHLIST ── */}
        <div className="mb-8 bg-cyber-bg-card border border-cyber-border p-6">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2 mb-4">
            <h2 className="text-xl font-semibold text-cyber-text-bright uppercase tracking-wider">
              [LIST] WATCHLIST
            </h2>
            <Link
              to="/watchlist"
              className="text-cyber-accent text-xs font-mono uppercase tracking-wider hover:underline"
            >
              VIEW ALL →
            </Link>
          </div>

          {loadingWatchlist ? (
            <SectionSpinner />
          ) : watchlist.length === 0 ? (
            <p className="text-cyber-text-dim font-mono text-sm uppercase tracking-wide">
              YOUR WATCHLIST IS EMPTY
            </p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
              {watchlist.slice(0, 9).map((item) => (
                <WatchlistCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* ── TOP RATED ── */}
        <div className="mb-8 bg-cyber-bg-card border border-cyber-border p-6">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2 mb-4">
            <h2 className="text-xl font-semibold text-cyber-text-bright uppercase tracking-wider">
              [STAR] TOP RATED
            </h2>
            <Link
              to="/rated"
              className="text-cyber-accent text-xs font-mono uppercase tracking-wider hover:underline"
            >
              VIEW ALL →
            </Link>
          </div>

          {loadingRated ? (
            <SectionSpinner />
          ) : topRated.length === 0 ? (
            <p className="text-cyber-text-dim font-mono text-sm uppercase tracking-wide">
              RATE SOME SERIES 4–5 STARS TO SEE THEM HERE
            </p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
              {topRated.slice(0, 9).map((item) => (
                <RatedCard key={item.seriesId ?? item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* ── FOR YOU ── */}
        <div className="mb-8 bg-cyber-bg-card border border-cyber-border p-6">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2 mb-4">
            <h2 className="text-xl font-semibold text-cyber-text-bright uppercase tracking-wider">
              [AI] FOR YOU
            </h2>
          </div>

          {loadingRecs ? (
            <SectionSpinner />
          ) : recommendations.length === 0 ? (
            <p className="text-cyber-text-dim font-mono text-sm uppercase tracking-wide">
              RATE SOME SERIES TO GET RECOMMENDATIONS
            </p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-9 gap-3">
              {recommendations.slice(0, 9).map((rec) => (
                <RecommendationCard key={rec.series.id} rec={rec} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
