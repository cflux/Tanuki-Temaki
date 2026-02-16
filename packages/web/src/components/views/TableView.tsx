import { useMemo, useState, useEffect, useRef } from 'react';
import type { Series, SeriesRelationship } from '@tanuki-temaki/shared';
import { RatingWidget } from '../user/RatingWidget';
import { NotesWidget } from '../user/NotesWidget';
import { TagVotingWidget } from '../user/TagVotingWidget';
import { WatchlistButton } from '../user/WatchlistButton';
import { PersonalizedBadge } from '../PersonalizedBadge';
import { RecommendationExplanation } from '../RecommendationExplanation';
import { userApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

interface TableViewProps {
  relationship: SeriesRelationship;
  requiredTags: Set<string>;
  excludedTags: Set<string>;
  filterMode: 'primary' | 'all';
  rootTags: Set<string>;
  deselectedServices: Set<string>;
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH';
  userServices: string[];
  selectedSeriesId?: string | null;
  onExplore?: (seriesUrl: string) => void;
}

// Helper function for platform icons
const getPlatformIcon = (platform: string) => {
  const lower = platform.toLowerCase();
  if (lower.includes('crunchyroll')) return '🍥';
  if (lower.includes('netflix')) return '🎬';
  if (lower.includes('hulu')) return '💚';
  if (lower.includes('amazon')) return '📦';
  if (lower.includes('disney')) return '✨';
  if (lower.includes('funimation')) return '⚡';
  if (lower.includes('hidive')) return '🌊';
  return '📺';
};

export function TableView({ relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter, userServices, selectedSeriesId, onExplore }: TableViewProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'rating'>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const [watchlistStatuses, setWatchlistStatuses] = useState<Map<string, string | null>>(new Map());
  const { user } = useUserStore();

  const filteredAndSortedData = useMemo(
    () => {
      // Check if this is a tag-based search with multiple seeds
      const isTagBasedSearch = relationship.seedSeriesIds && relationship.seedSeriesIds.length > 0;
      const seedIdsSet = new Set(relationship.seedSeriesIds || []);

      // Separate seed/root series from related series
      let seedSeries: Series[] = [];
      let relatedSeries = relationship.nodes
        .filter(n => {
          if (isTagBasedSearch) {
            // For tag-based searches, check if this is a seed series
            if (seedIdsSet.has(n.series.id)) {
              seedSeries.push(n.series);
              return false;
            }
          } else {
            // For single-root searches, check if this is the root series by ID only
            if (n.series.id === relationship.rootId) {
              seedSeries = [n.series];
              return false;
            }
          }
          return true;
        })
        .filter(n => {
          // Media type filter
          if (resultsMediaFilter !== 'BOTH') {
            const seriesMediaType = n.series.mediaType || 'ANIME';
            if (seriesMediaType !== resultsMediaFilter) {
              return false;
            }
          }
          return true;
        })
        .filter(n => {
          // Service filter - check streaming links from metadata
          if (deselectedServices.size > 0) {
            const streamingLinks = (n.series.metadata as any)?.streamingLinks || {};
            const platforms = Object.keys(streamingLinks);

            // If has streaming links, check if any platform is selected
            if (platforms.length > 0) {
              const hasSelectedPlatform = platforms.some(p => !deselectedServices.has(p));
              if (!hasSelectedPlatform) return false;
            } else {
              // Fallback to provider field
              if (deselectedServices.has(n.series.provider)) return false;
            }
          }

          // Tag filter
          const tags = n.series.tags.map(t => t.value);

          // In primary mode, find the first root-shared tag (actual primary tag)
          const primaryTag = filterMode === 'primary'
            ? tags.find(t => rootTags.has(t))
            : undefined;

          // Check required tags - series must have at least one required tag
          if (requiredTags.size > 0) {
            const hasRequired = filterMode === 'primary'
              ? primaryTag !== undefined && requiredTags.has(primaryTag)
              : tags.some(t => requiredTags.has(t));
            if (!hasRequired) return false;
          }

          // Check excluded tags - series must not have any excluded tags
          if (excludedTags.size > 0) {
            const hasExcluded = filterMode === 'primary'
              ? primaryTag !== undefined && excludedTags.has(primaryTag)
              : tags.some(t => excludedTags.has(t));
            if (hasExcluded) return false;
          }

          return true;
        })
        .map(n => n.series);

      // Apply global search filter to related series
      if (globalFilter) {
        const searchLower = globalFilter.toLowerCase();
        relatedSeries = relatedSeries.filter(s =>
          s.title.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.genres.some(g => g.toLowerCase().includes(searchLower)) ||
          s.tags.some(t => t.value.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting to related series
      relatedSeries.sort((a, b) => {
        let comparison = 0;

        if (sortBy === 'title') {
          comparison = a.title.localeCompare(b.title);
        } else if (sortBy === 'rating') {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          comparison = ratingB - ratingA; // Higher ratings first
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

      // Combine seed series at the top with related series
      return [...seedSeries, ...relatedSeries];
    },
    [relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter, globalFilter, sortBy, sortOrder]
  );

  // Fetch watchlist statuses in batch
  useEffect(() => {
    if (!user || filteredAndSortedData.length === 0) {
      setWatchlistStatuses(new Map());
      return;
    }

    const fetchBatchStatuses = async () => {
      const seriesIds = filteredAndSortedData.map(s => s.id);
      const statuses = await userApi.getWatchlistStatusBatch(seriesIds);

      const statusMap = new Map<string, string | null>();
      statuses.forEach(({ seriesId, status }) => {
        statusMap.set(seriesId, status);
      });

      setWatchlistStatuses(statusMap);
    };

    fetchBatchStatuses();
  }, [user, filteredAndSortedData]);

  // Scroll to selected card when selectedSeriesId changes
  useEffect(() => {
    if (selectedSeriesId && selectedCardRef.current) {
      setTimeout(() => {
        if (selectedCardRef.current) {
          selectedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [selectedSeriesId]);

  const toggleSort = (field: 'title' | 'rating') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'rating' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="md:bg-cyber-bg-card md:border md:border-cyber-border md:p-4">
      {/* Search and Sort Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-4">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="SEARCH SERIES..."
          className="flex-1 max-w-md px-4 py-2 bg-cyber-bg border border-cyber-border focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm text-cyber-text placeholder-cyber-text-dim font-mono uppercase transition-all"
        />

        <div className="flex gap-2">
          <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <button
                onClick={() => toggleSort('title')}
                className={`px-3 py-2 text-sm font-medium transition-all uppercase tracking-wide ${
                  sortBy === 'title'
                    ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
                    : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
                }`}
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                TITLE {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
          <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <button
                onClick={() => toggleSort('rating')}
                className={`px-3 py-2 text-sm font-medium transition-all uppercase tracking-wide ${
                  sortBy === 'rating'
                    ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
                    : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
                }`}
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                RATING {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Series Cards */}
      <div className="space-y-4">
        {filteredAndSortedData.map((series) => {
          // Check if this is a seed/root series
          const isTagBasedSearch = relationship.seedSeriesIds && relationship.seedSeriesIds.length > 0;
          const isSeedSeries = isTagBasedSearch
            ? relationship.seedSeriesIds?.includes(series.id)
            : series.id === relationship.rootId;
          const isSelected = series.id === selectedSeriesId;
          const userRating = (series as any).userRating;
          const userNote = (series as any).userNote;
          const userTagVotes = (series as any).userTagVotes || {};
          const streamingLinks = (series.metadata as any)?.streamingLinks || {};
          const metadata = series.metadata as any;
          const chapters = metadata?.chapters;
          const volumes = metadata?.volumes;
          const episodes = metadata?.episodes;
          const mediaType = series.mediaType || 'ANIME';
          const mediaIcon = mediaType === 'MANGA' ? '[BOOK]' : '[TV]';
          const mediaBadgeColor = mediaType === 'MANGA' ? 'bg-transparent border border-cyber-accent text-cyber-accent' : 'bg-transparent border border-cyber-accent text-cyber-accent';

          // Personalization data (if personalized mode is enabled)
          const personalizedScore = (series as any).personalizedScore;
          const matchedTags = (series as any).matchedTags;
          const reason = (series as any).reason;

          // Check if series is available on user's preferred services
          const isOnUserService = userServices.length === 0 || Object.keys(streamingLinks).some(
            platform => userServices.includes(platform)
          );

          return (
            <div
              key={series.id}
              ref={isSelected ? selectedCardRef : null}
              className={`bg-cyber-bg-card border transition-all ${
                isSeedSeries
                  ? 'border-cyber-accent shadow-cyber-lg'
                  : isSelected
                  ? 'border-cyber-accent shadow-cyber-md'
                  : 'border-cyber-border hover:border-cyber-accent'
              } ${!isOnUserService ? 'opacity-40' : ''}`}
              title={!isOnUserService ? 'Not available on your preferred services' : ''}
            >
              {/* MOBILE LAYOUT */}
              <div className="md:hidden">
                {/* Mobile Row 1: Cover + Buttons */}
                <div className="flex justify-between items-start p-3 gap-3">
                  {/* Cover */}
                  <div className="flex-shrink-0">
                    {series.titleImage ? (
                      <div className="bg-cyber-accent flex items-center justify-center" style={{ width: 90, height: 120, clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}>
                        <img src={series.titleImage} alt={series.title} className="object-cover" style={{ width: 86, height: 116, clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    ) : (
                      <div className="bg-cyber-bg-elevated flex items-center justify-center text-cyber-text-dim uppercase tracking-wide text-xs" style={{ width: 86, height: 116, clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}>NO IMAGE</div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-2 items-end">
                    <WatchlistButton seriesId={series.id} initialStatus={watchlistStatuses.get(series.id) || null} />
                    {!isSeedSeries && (
                      <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                        <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                          <button onClick={() => onExplore?.(series.url)} className="px-3 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-xs font-medium transition-all uppercase tracking-wider" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>EXPLORE</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Row 2: Title, Services, Description */}
                <div className="px-3 pb-3">
                  {/* Title */}
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs border flex-shrink-0 uppercase tracking-wide ${mediaBadgeColor}`}>{mediaIcon} {mediaType}</span>
                    {isSeedSeries && <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-transparent border-cyber-accent text-cyber-accent flex-shrink-0 uppercase tracking-wide shadow-cyber-sm">[*] {isTagBasedSearch ? 'SEED SERIES' : 'ROOT SERIES'}</span>}
                    {personalizedScore !== undefined && <PersonalizedBadge score={personalizedScore} />}
                    <h3 className="font-semibold text-base text-cyber-text-bright uppercase tracking-wide w-full">{series.title}{series.isAdult && <span className="text-sm text-red-500" title="Adult content"> [18+]</span>}</h3>
                  </div>

                  {/* Ratings */}
                  <div className="flex flex-wrap gap-4 mb-2 items-center text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-cyber-text-dim uppercase">SERIES:</span>
                      {series.rating ? <span className="text-cyber-accent font-semibold font-mono">★ {series.rating.toFixed(1)}</span> : <span className="text-cyber-text-dim font-mono">N/A</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-cyber-text-dim uppercase">YOUR RATING:</span>
                      <RatingWidget seriesId={series.id} initialRating={userRating} />
                    </div>
                  </div>

                  {/* Metadata */}
                  {(chapters || volumes || episodes) && (
                    <div className="mb-2 flex gap-2 text-xs text-cyber-text-dim uppercase font-mono">
                      {mediaType === 'MANGA' ? <>{chapters && <span>[CH] {chapters}</span>}{volumes && <span>[VOL] {volumes}</span>}</> : <>{episodes && <span>[EP] {episodes}</span>}</>}
                    </div>
                  )}

                  {/* Services */}
                  <div className="flex gap-2 flex-wrap mb-2">
                    {Object.entries(streamingLinks).length > 0 ? Object.entries(streamingLinks).map(([platform, url]) => (
                      <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 bg-transparent hover:bg-cyber-accent hover:text-cyber-bg border border-cyber-accent text-xs text-cyber-accent transition-all uppercase">{getPlatformIcon(platform)} {platform}</a>
                    )) : (
                      <a href={series.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 bg-transparent hover:bg-cyber-accent hover:text-cyber-bg border border-cyber-accent text-xs text-cyber-accent transition-all uppercase">{getPlatformIcon(series.provider)} {series.provider}</a>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-cyber-text-dim font-mono">{series.description}</p>
                </div>

                {/* Mobile Row 3: Notes + Tags */}
                <div className="border-t border-cyber-border p-3">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-cyber-text mb-2 uppercase">PRIVATE NOTES</h4>
                      <NotesWidget seriesId={series.id} initialNote={userNote} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-cyber-text mb-2 uppercase">TAGS & GENRES <span className="text-xs text-cyber-text-dim font-normal">(VOTE)</span></h4>
                      {series.genres.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs text-cyber-text-dim mb-1 uppercase">GENRES:</div>
                          <div className="flex flex-wrap gap-2">{series.genres.map((genre, idx) => <TagVotingWidget key={`genre-${idx}`} seriesId={series.id} tagValue={genre} initialVote={userTagVotes[genre] ?? null} />)}</div>
                        </div>
                      )}
                      {series.tags.length > 0 && (
                        <div>
                          <div className="text-xs text-cyber-text-dim mb-1 uppercase">TAGS:</div>
                          <div className="flex flex-wrap gap-2">{series.tags.slice(0, 15).map((tag) => <TagVotingWidget key={tag.value} seriesId={series.id} tagValue={tag.value} initialVote={userTagVotes[tag.value] ?? null} />)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DESKTOP LAYOUT */}
              <div className="hidden md:block">
                {/* Row 1: Cover, Title, Description, Ratings */}
                <div className="flex gap-4 p-4">
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  {series.titleImage ? (
                    <div
                      className="bg-cyber-accent flex items-center justify-center"
                      style={{
                        width: 124,
                        height: 164,
                        clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)'
                      }}
                    >
                      <img
                        src={series.titleImage}
                        alt={series.title}
                        className="object-cover"
                        style={{
                          width: 120,
                          height: 160,
                          clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="bg-cyber-accent flex items-center justify-center"
                      style={{
                        width: 124,
                        height: 164,
                        clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)'
                      }}
                    >
                      <div
                        className="bg-cyber-bg-elevated flex items-center justify-center text-cyber-text-dim uppercase tracking-wide text-xs"
                        style={{
                          width: 120,
                          height: 160,
                          clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)'
                        }}
                      >
                        NO IMAGE
                      </div>
                    </div>
                  )}
                </div>

                {/* Title and Description */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  {/* Title with media type badge */}
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs border flex-shrink-0 uppercase tracking-wide ${mediaBadgeColor}`}>
                      {mediaIcon} {mediaType}
                    </span>
                    {isSeedSeries && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs border bg-transparent border-cyber-accent text-cyber-accent flex-shrink-0 uppercase tracking-wide shadow-cyber-sm">
                        [*] {isTagBasedSearch ? 'SEED SERIES' : 'ROOT SERIES'}
                      </span>
                    )}
                    {personalizedScore !== undefined && (
                      <PersonalizedBadge score={personalizedScore} />
                    )}
                    <h3 className="font-semibold text-lg text-cyber-text-bright flex items-center gap-2 uppercase tracking-wide">
                      {series.title}
                      {series.isAdult && <span className="text-base text-red-500" title="Adult content">[18+]</span>}
                    </h3>
                  </div>

                  {/* Ratings Row */}
                  <div className="flex gap-6 mb-3 items-center">
                    {/* Series Rating */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyber-text-dim uppercase tracking-wide">SERIES:</span>
                      {series.rating ? (
                        <span className="text-cyber-accent font-semibold text-lg font-mono">
                          ★ {series.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-cyber-text-dim font-mono text-sm">N/A</span>
                      )}
                    </div>

                    {/* Your Rating */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyber-text-dim uppercase tracking-wide">YOUR RATING:</span>
                      <RatingWidget
                        seriesId={series.id}
                        initialRating={userRating}
                      />
                    </div>
                  </div>

                  {/* Metadata (chapters/episodes) */}
                  {(chapters || volumes || episodes) && (
                    <div className="mb-2 flex gap-3 text-xs text-cyber-text-dim uppercase tracking-wide font-mono">
                      {mediaType === 'MANGA' ? (
                        <>
                          {chapters && <span>[CH] {chapters} CHAPTERS</span>}
                          {volumes && <span>[VOL] {volumes} VOLUMES</span>}
                        </>
                      ) : (
                        <>
                          {episodes && <span>[EP] {episodes} EPISODES</span>}
                        </>
                      )}
                    </div>
                  )}

                  {/* Streaming Links */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {Object.entries(streamingLinks).length > 0 ? (
                      Object.entries(streamingLinks).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1 bg-transparent hover:bg-cyber-accent hover:text-cyber-bg border border-cyber-accent text-xs text-cyber-accent transition-all uppercase tracking-wide"
                          title={`View on ${platform}`}
                        >
                          {getPlatformIcon(platform)} {platform}
                        </a>
                      ))
                    ) : (
                      <a
                        href={series.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2 py-1 bg-transparent hover:bg-cyber-accent hover:text-cyber-bg border border-cyber-accent text-xs text-cyber-accent transition-all uppercase tracking-wide"
                        title={`View on ${series.provider}`}
                      >
                        {getPlatformIcon(series.provider)} {series.provider}
                      </a>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-cyber-text-dim flex-1 font-mono" title={series.description}>
                    {series.description}
                  </p>
                </div>

                {/* Action Buttons Column */}
                <div className="flex flex-col gap-3 items-end flex-shrink-0">
                  {/* Watchlist Button */}
                  <WatchlistButton
                    seriesId={series.id}
                    initialStatus={watchlistStatuses.get(series.id) || null}
                  />

                  {/* Explore Button - only show for non-seed series */}
                  {!isSeedSeries && (
                    <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                      <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                        <button
                          onClick={() => onExplore?.(series.url)}
                          className="px-4 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all uppercase tracking-wider shadow-cyber-md hover:shadow-cyber-lg"
                          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                          title="Explore relationships from this series"
                        >
                          EXPLORE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Notes and Tags */}
              <div className="border-t border-cyber-border p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Notes Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyber-text mb-2 uppercase tracking-wider">PRIVATE NOTES</h4>
                    <NotesWidget
                      seriesId={series.id}
                      initialNote={userNote}
                    />
                  </div>

                  {/* Tags/Genres Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-cyber-text mb-2 uppercase tracking-wider">
                      TAGS & GENRES
                      <span className="text-xs text-cyber-text-dim font-normal ml-2">
                        (VOTE TO PERSONALIZE)
                      </span>
                    </h4>

                    {/* Genres with Voting */}
                    {series.genres.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-cyber-text-dim mb-1 uppercase tracking-wide">GENRES:</div>
                        <div className="flex flex-wrap gap-2">
                          {series.genres.map((genre, idx) => (
                            <TagVotingWidget
                              key={`genre-${idx}`}
                              seriesId={series.id}
                              tagValue={genre}
                              initialVote={userTagVotes[genre] ?? null}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags with Voting */}
                    {series.tags.filter(tag => tag.source !== 'genre').length > 0 && (
                      <div>
                        <div className="text-xs text-cyber-text-dim mb-1 uppercase tracking-wide">TAGS:</div>
                        <div className="flex flex-wrap gap-2">
                          {series.tags
                            .filter(tag => tag.source !== 'genre')
                            .map((tag) => (
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
                  </div>
                </div>

                {/* Personalization Explanation */}
                {(reason || (matchedTags && matchedTags.length > 0)) && (
                  <div className="mt-4">
                    <RecommendationExplanation
                      reason={reason}
                      matchedTags={matchedTags}
                      score={personalizedScore}
                    />
                  </div>
                )}
              </div>
              </div> {/* Close desktop layout */}
            </div>
          );
        })}
      </div>

      {/* Total count */}
      {filteredAndSortedData.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-cyber-border text-center">
          <div className="text-sm text-cyber-text-dim uppercase tracking-wide font-mono">
            {(() => {
              const isTagBasedSearch = relationship.seedSeriesIds && relationship.seedSeriesIds.length > 0;
              const seedCount = isTagBasedSearch ? (relationship.seedSeriesIds?.length || 0) : 1;
              const relatedCount = filteredAndSortedData.length - seedCount;

              if (filteredAndSortedData.length === seedCount) {
                return `${seedCount} ${isTagBasedSearch ? 'seed' : 'root'} series`;
              } else {
                return `${filteredAndSortedData.length} series (${seedCount} ${isTagBasedSearch ? 'seed' : 'root'} + ${relatedCount} related)`;
              }
            })()}
          </div>
        </div>
      ) : (
        <div className="mt-8 text-center text-zinc-500">
          No series found matching your filters
        </div>
      )}
    </div>
  );
}
