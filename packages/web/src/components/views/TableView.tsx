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
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      {/* Search and Sort Controls */}
      <div className="mb-4 flex items-center gap-4">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search series..."
          className="flex-1 max-w-md px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-200 placeholder-zinc-500"
        />

        <div className="flex gap-2">
          <button
            onClick={() => toggleSort('title')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'title'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => toggleSort('rating')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'rating'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Rating {sortBy === 'rating' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
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
          const mediaIcon = mediaType === 'MANGA' ? '📖' : '📺';
          const mediaBadgeColor = mediaType === 'MANGA' ? 'bg-green-600/20 border-green-600/50 text-green-300' : 'bg-blue-600/20 border-blue-600/50 text-blue-300';

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
              className={`bg-zinc-800/50 rounded-lg border transition-all ${
                isSeedSeries
                  ? 'border-purple-500 ring-2 ring-purple-500/30'
                  : isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/50'
                  : 'border-zinc-700 hover:border-zinc-600'
              } ${!isOnUserService ? 'opacity-40' : ''}`}
              title={!isOnUserService ? 'Not available on your preferred services' : ''}
            >
              {/* Row 1: Cover, Title, Description, Ratings */}
              <div className="flex gap-4 p-4">
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  {series.titleImage ? (
                    <img
                      src={series.titleImage}
                      alt={series.title}
                      className="object-cover rounded"
                      style={{ width: 120, height: 160 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="bg-zinc-700 rounded flex items-center justify-center text-zinc-500"
                      style={{ width: 120, height: 160 }}
                    >
                      No Image
                    </div>
                  )}
                </div>

                {/* Title and Description */}
                <div className="flex-1 min-w-0">
                  {/* Title with media type badge */}
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border flex-shrink-0 ${mediaBadgeColor}`}>
                      {mediaIcon} {mediaType}
                    </span>
                    {isSeedSeries && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-purple-600/20 border-purple-600/50 text-purple-300 flex-shrink-0">
                        🎯 {isTagBasedSearch ? 'SEED SERIES' : 'ROOT SERIES'}
                      </span>
                    )}
                    {personalizedScore !== undefined && (
                      <PersonalizedBadge score={personalizedScore} />
                    )}
                    <h3 className="font-semibold text-lg text-zinc-100">{series.title}</h3>
                  </div>

                  {/* Metadata (chapters/episodes) */}
                  {(chapters || volumes || episodes) && (
                    <div className="mb-2 flex gap-3 text-xs text-zinc-400">
                      {mediaType === 'MANGA' ? (
                        <>
                          {chapters && <span>📚 {chapters} chapters</span>}
                          {volumes && <span>📕 {volumes} volumes</span>}
                        </>
                      ) : (
                        <>
                          {episodes && <span>📺 {episodes} episodes</span>}
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
                          className="inline-flex items-center px-2 py-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/50 rounded text-xs text-orange-300 transition-colors"
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
                        className="inline-flex items-center px-2 py-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/50 rounded text-xs text-orange-300 transition-colors"
                        title={`View on ${series.provider}`}
                      >
                        {getPlatformIcon(series.provider)} {series.provider}
                      </a>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 line-clamp-3" title={series.description}>
                    {series.description}
                  </p>
                </div>

                {/* Ratings Column */}
                <div className="flex flex-col gap-4 items-end flex-shrink-0" style={{ minWidth: 280 }}>
                  {/* Series Rating */}
                  <div className="text-center">
                    <div className="text-xs text-zinc-500 mb-1">Series Rating</div>
                    {series.rating ? (
                      <div className="text-amber-400 font-semibold text-xl">
                        ★ {series.rating.toFixed(1)}
                      </div>
                    ) : (
                      <span className="text-zinc-600">N/A</span>
                    )}
                  </div>

                  {/* Your Rating */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 text-center">Your Rating</div>
                    <RatingWidget
                      seriesId={series.id}
                      initialRating={userRating}
                    />
                  </div>

                  {/* Watchlist Button */}
                  <WatchlistButton
                    seriesId={series.id}
                    initialStatus={watchlistStatuses.get(series.id) || null}
                  />

                  {/* Explore Button - only show for non-seed series */}
                  {!isSeedSeries && (
                    <button
                      onClick={() => onExplore?.(series.url)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors w-full"
                      title="Explore relationships from this series"
                    >
                      Explore
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Notes and Tags */}
              <div className="border-t border-zinc-700 p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Notes Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-300 mb-2">Private Notes</h4>
                    <NotesWidget
                      seriesId={series.id}
                      initialNote={userNote}
                    />
                  </div>

                  {/* Tags/Genres Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-300 mb-2">
                      Tags & Genres
                      <span className="text-xs text-zinc-500 font-normal ml-2">
                        (Vote to personalize recommendations)
                      </span>
                    </h4>

                    {/* Genres with Voting */}
                    {series.genres.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-zinc-500 mb-1">Genres:</div>
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
                        <div className="text-xs text-zinc-500 mb-1">Tags:</div>
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
            </div>
          );
        })}
      </div>

      {/* Total count */}
      {filteredAndSortedData.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
          <div className="text-sm text-zinc-400">
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
