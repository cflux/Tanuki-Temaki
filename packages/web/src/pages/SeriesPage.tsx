import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { seriesApi, downloadApi } from '../lib/api';
import type { Series } from '../lib/api';
import { TagVotingWidget } from '../components/user/TagVotingWidget';
import { RatingWidget } from '../components/user/RatingWidget';
import { useUserStore } from '../store/userStore';
import { toast } from '../components/Toast';

export function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [series, setSeries] = useState<Series | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dlServices, setDlServices] = useState<string[]>([]);
  const [dlPending, setDlPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);
    seriesApi.getSeriesById(id)
      .then((data) => {
        if (!data) setNotFound(true);
        else setSeries(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (user) {
      downloadApi.getSupportedServices()
        .then(setDlServices)
        .catch(() => setDlServices([]));
    }
  }, [user]);

  const handleRequestDownload = useCallback(async (service: string, url: string) => {
    if (!id) return;
    setDlPending(prev => new Set(prev).add(service));
    try {
      await downloadApi.requestDownload(id, service.toLowerCase(), url);
      toast('Download request sent to Corvid Cache', 'success');
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Request failed';
      toast(msg, 'error');
    } finally {
      setDlPending(prev => {
        const next = new Set(prev);
        next.delete(service);
        return next;
      });
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent" />
      </div>
    );
  }

  if (notFound || !series) {
    return (
      <div className="min-h-screen p-6 pt-24 md:pt-6 flex flex-col items-center justify-center">
        <p className="text-cyber-text-dim font-mono uppercase tracking-widest mb-4">[ERR] SERIES NOT FOUND</p>
        <button
          onClick={() => navigate(-1)}
          className="text-cyber-accent font-mono text-sm uppercase tracking-wide hover:underline"
        >
          ← GO BACK
        </button>
      </div>
    );
  }

  const meta = series.metadata as Record<string, any>;
  const episodes: number | undefined = meta?.episodes ?? meta?.totalEpisodes;
  const chapters: number | undefined = meta?.chapters;
  const season: string | undefined = meta?.season;
  const year: number | undefined = meta?.seasonYear ?? meta?.year;
  const format: string | undefined = meta?.format;
  const rawLinks = meta?.streamingLinks;
  const streamingLinks: Array<{ url: string; site: string }> | undefined =
    rawLinks && !Array.isArray(rawLinks) && typeof rawLinks === 'object'
      ? Object.entries(rawLinks).map(([site, url]) => ({ site, url: url as string }))
      : Array.isArray(rawLinks) ? rawLinks : undefined;

  const topTags = [...series.tags]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20);

  const userTagVotes: Record<string, number> = (series as any).userTagVotes ?? {};
  const userRating: number | null = (series as any).userRating ?? null;

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text p-6 pt-24 md:pt-6">
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="text-cyber-accent font-mono text-xs uppercase tracking-wider hover:underline mb-6 block"
        >
          ← BACK
        </button>

        {/* Main layout */}
        <div className="flex flex-col md:flex-row gap-8">

          {/* Cover image */}
          <div className="flex-shrink-0 w-full md:w-56">
            {series.titleImage ? (
              <img
                src={series.titleImage}
                alt={series.title}
                className="w-full md:w-56 aspect-[2/3] object-cover border border-cyber-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full md:w-56 aspect-[2/3] bg-cyber-bg-card border border-cyber-border flex items-center justify-center text-cyber-text-dim text-xs font-mono uppercase">
                NO IMAGE
              </div>
            )}

          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">

            {/* Media type + format badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2 py-0.5 border border-cyber-accent text-cyber-accent text-xs font-mono uppercase tracking-wider">
                {series.mediaType === 'ANIME' ? '[TV] ANIME' : '[BK] MANGA'}
              </span>
              {format && (
                <span className="px-2 py-0.5 border border-cyber-border text-cyber-text-dim text-xs font-mono uppercase tracking-wider">
                  {format}
                </span>
              )}
              {series.ageRating && (
                <span className="px-2 py-0.5 border border-cyber-border text-cyber-text-dim text-xs font-mono uppercase tracking-wider">
                  {series.ageRating}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-cyber-text-bright uppercase tracking-wide mb-3 leading-tight">
              {series.title}
            </h1>

            {/* Meta row: rating, episodes, season/year */}
            <div className="flex flex-wrap gap-4 mb-5 text-sm font-mono">
              {series.rating != null && (
                <div>
                  <span className="text-cyber-text-dim uppercase tracking-wide text-xs">ANILIST</span>
                  <span className="text-cyber-accent font-bold ml-2">{series.rating.toFixed(1)}</span>
                  <span className="text-cyber-text-dim text-xs">/10</span>
                </div>
              )}
              {episodes != null && (
                <div>
                  <span className="text-cyber-text-dim uppercase tracking-wide text-xs">EPISODES</span>
                  <span className="text-cyber-text ml-2">{episodes}</span>
                </div>
              )}
              {chapters != null && (
                <div>
                  <span className="text-cyber-text-dim uppercase tracking-wide text-xs">CHAPTERS</span>
                  <span className="text-cyber-text ml-2">{chapters}</span>
                </div>
              )}
              {(season || year) && (
                <div>
                  <span className="text-cyber-text-dim uppercase tracking-wide text-xs">SEASON</span>
                  <span className="text-cyber-text ml-2 uppercase">
                    {[season, year].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
            </div>

            {/* Available on — streaming services + download buttons */}
            {streamingLinks && streamingLinks.length > 0 && (
              <div className="mb-5">
                <p className="text-cyber-text-dim text-xs font-mono uppercase tracking-widest mb-2">AVAILABLE ON</p>
                <div className="flex flex-wrap gap-2">
                  {streamingLinks.map((link) => {
                    const canDownload = user && dlServices.includes(link.site.toLowerCase());
                    const isPending = dlPending.has(link.site);
                    return (
                      <div
                        key={link.site}
                        className="flex items-center border border-cyber-border bg-cyber-bg-card"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm font-mono text-cyber-text hover:text-cyber-accent transition-colors uppercase tracking-wide"
                        >
                          {link.site}
                        </a>
                        {canDownload && (
                          <button
                            onClick={() => handleRequestDownload(link.site, link.url)}
                            disabled={isPending}
                            className="px-2 py-1.5 border-l border-cyber-border text-sm font-mono text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg transition-colors disabled:opacity-50"
                            title="Request download via Corvid Cache"
                          >
                            {isPending ? '...' : 'DL'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User rating */}
            <div className="mb-5">
              <p className="text-cyber-text-dim text-xs font-mono uppercase tracking-widest mb-2">YOUR RATING</p>
              <RatingWidget seriesId={series.id} initialRating={userRating} />
            </div>

            {/* Description */}
            {series.description && (
              <div className="mb-5">
                <p className="text-cyber-text-dim text-sm leading-relaxed line-clamp-6">
                  {/* Strip HTML tags from AniList descriptions */}
                  {series.description.replace(/<[^>]*>/g, '')}
                </p>
              </div>
            )}

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="mb-5">
                <p className="text-cyber-text-dim text-xs font-mono uppercase tracking-widest mb-2">GENRES</p>
                <div className="flex flex-wrap gap-1.5">
                  {series.genres.map((g) => (
                    <TagVotingWidget
                      key={g}
                      seriesId={series.id}
                      tagValue={g}
                      initialVote={userTagVotes[g] ?? null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {topTags.length > 0 && (
              <div className="mb-5">
                <p className="text-cyber-text-dim text-xs font-mono uppercase tracking-widest mb-2">TAGS</p>
                <div className="flex flex-wrap gap-1.5">
                  {topTags.map((tag) => (
                    <TagVotingWidget
                      key={tag.id}
                      seriesId={series.id}
                      tagValue={tag.value}
                      initialVote={userTagVotes[tag.value] ?? null}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Explore relationships button */}
            <div
              className="inline-flex"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              <div
                className="bg-cyber-accent p-[1px]"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                <button
                  onClick={() =>
                    navigate('/search', {
                      state: { exploreTitle: series.title, exploreMediaType: series.mediaType },
                    })
                  }
                  className="px-6 py-3 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg font-medium transition-all uppercase tracking-wider text-sm"
                  style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                >
                  {'[>>]'} EXPLORE RELATIONSHIPS
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
