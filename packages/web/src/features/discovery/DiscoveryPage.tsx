import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDiscoveryStore } from '../../store/discoveryStore';
import { seriesApi, recommendationApi, userApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { TreeView } from '../../components/views/TreeView';
import { TableView } from '../../components/views/TableView';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { SeriesSelectionModal } from '../../components/SeriesSelectionModal';

export function DiscoveryPage() {
  const location = useLocation();
  const processedLocationKey = useRef<string | null>(null);
  const [searchMode, setSearchMode] = useState<'series' | 'tag'>('series');
  const [url, setUrl] = useState('');
  const [seriesOptions, setSeriesOptions] = useState<Array<{
    id: string;
    title: string;
    description: string;
    titleImage: string | null;
    mediaType: 'ANIME' | 'MANGA';
    anilistId: number;
    format?: string;
    episodes?: number;
    chapters?: number;
    season?: string;
    year?: number;
  }>>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userServices, setUserServices] = useState<string[]>([]);
  const [cacheStats, setCacheStats] = useState<{
    totalSeries: number;
    totalTags: number;
    totalRelationships: number;
    byProvider: Array<{ provider: string; count: number }>;
    byMediaType: Array<{ mediaType: string; count: number }>;
  } | null>(null);
  const { user, preferPersonalized } = useUserStore();
  const {
    relationshipGraph,
    mediaType,
    resultsMediaFilter,
    isLoading,
    loadingProgress,
    error,
    viewMode,
    requiredTags,
    excludedTags,
    filterMode,
    selectedSeriesId,
    deselectedServices,
    setRootSeries,
    setRelationshipGraph,
    setMediaType,
    setResultsMediaFilter,
    setLoading,
    setLoadingProgress,
    setError,
    setViewMode,
    toggleTag,
    setFilterMode,
    setSelectedSeries,
    toggleService,
  } = useDiscoveryStore();

  // Collect all streaming services from the series, categorized by anime/manga
  const { animeServices, mangaServices } = useMemo(() => {
    if (!relationshipGraph) return { animeServices: [], mangaServices: [] };

    const animeServiceSet = new Set<string>();
    const mangaServiceSet = new Set<string>();

    relationshipGraph.nodes.forEach(n => {
      const mediaType = n.series.mediaType || 'ANIME';
      const streamingLinks = (n.series.metadata as any)?.streamingLinks || {};
      const targetSet = mediaType === 'MANGA' ? mangaServiceSet : animeServiceSet;

      Object.keys(streamingLinks).forEach(platform => {
        targetSet.add(platform);
      });

      // Fallback to provider field if no streaming links
      if (Object.keys(streamingLinks).length === 0 && n.series.provider) {
        targetSet.add(n.series.provider);
      }
    });

    return {
      animeServices: Array.from(animeServiceSet).sort(),
      mangaServices: Array.from(mangaServiceSet).sort(),
    };
  }, [relationshipGraph]);

  // Get root tags (primary tags shared with children)
  const rootTags = useMemo(() => {
    if (!relationshipGraph) return new Set<string>();
    const rootNode = relationshipGraph.nodes.find(n => n.series.id === relationshipGraph.rootId);
    if (!rootNode) return new Set<string>();
    return new Set(rootNode.series.tags.map(t => t.value));
  }, [relationshipGraph]);

  // Collect only tags that are visible in the tree:
  // - Root tags shared with at least one child (first-level branch labels)
  // - Top 4 new tags per child card (the differentiating tags shown on each card)
  const allTags = useMemo(() => {
    if (!relationshipGraph) return [];
    const rootNode = relationshipGraph.nodes.find(n => n.series.id === relationshipGraph.rootId);
    if (!rootNode) return [];
    const rootTagSet = rootTags;

    const freq = new Map<string, number>();
    const primaryTags = new Set<string>(); // Track which tags are primary (first-level branches)

    relationshipGraph.nodes
      .filter(n => n.series.id !== relationshipGraph.rootId)
      .forEach(n => {
        const seriesTags = n.series.tags.map(t => t.value);
        // Root tags this child shares → become first-level branch labels
        seriesTags
          .filter(v => rootTagSet.has(v))
          .forEach(t => {
            freq.set(t, (freq.get(t) ?? 0) + 1);
            primaryTags.add(t); // Mark as primary
          });
        // Top 4 new tags → shown on the card
        seriesTags
          .filter(v => !rootTagSet.has(v))
          .slice(0, 4)
          .forEach(t => freq.set(t, (freq.get(t) ?? 0) + 1));
      });
    return Array.from(freq.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count, isPrimary: primaryTags.has(tag) }));
  }, [relationshipGraph]);

  const performDiscovery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Reset view state for new discovery
    useDiscoveryStore.setState({ treeViewport: null }); // Clear saved viewport so fitView works
    setSelectedSeries(null);

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save original title and update with loading indicator
    const originalTitle = document.title;
    document.title = '🔄 Loading... - Tanuki Temaki';

    setLoading(true);
    setError(null);

    try {
      // Check if user is trying to use a Crunchyroll URL in Manga mode
      const crunchyrollUrlMatch = searchQuery.match(/crunchyroll\.com\/(?:series|watch)\/[^\/]+\/([^\/\?]+)/);
      if (crunchyrollUrlMatch && mediaType === 'MANGA') {
        setError('Crunchyroll URLs are not supported for manga. Please search by manga title instead (e.g., "Fire Force").');
        setLoading(false);
        return;
      }

      // If input is a Crunchyroll URL, extract the title
      if (crunchyrollUrlMatch) {
        // Convert URL slug to title (replace hyphens with spaces, capitalize)
        searchQuery = crunchyrollUrlMatch[1]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      // Step 1: Search AniList for multiple results
      document.title = '🔍 Searching... - Tanuki Temaki';
      setLoadingProgress({
        step: 'searching',
        message: `Searching for "${searchQuery}" on AniList...`,
      });

      const results = await seriesApi.searchMultiple(searchQuery, mediaType, 10);

      // If multiple results, show selection modal
      if (results.length > 1) {
        setSeriesOptions(results);
        setSearchQuery(searchQuery);
        setShowSelectionModal(true);
        setLoading(false);
        setLoadingProgress(null);
        document.title = originalTitle;
        return;
      }

      // If only one result, proceed directly
      if (results.length === 0) {
        throw new Error(`No ${mediaType.toLowerCase()} found with title: ${searchQuery}`);
      }

      // Use the single result
      const selectedResult = results[0];
      const series = await seriesApi.searchByTitle(selectedResult.title, mediaType);
      setRootSeries(series);

      // Step 2: Cache series data
      setLoadingProgress({
        step: 'caching',
        message: `Found "${series.title}", caching metadata...`,
      });

      // Small delay to show caching step
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Trace relationships with streaming progress
      const baseGraph = await seriesApi.traceRelationshipsStream(
        series.id,
        2,
        (progress) => {
          // Map backend progress to frontend format
          let step: 'searching' | 'caching' | 'tracing' | 'complete' | 'rate_limited' = 'tracing';
          let message = progress.message;

          if (progress.step === 'fetching_root') {
            step = 'caching';
            document.title = '💾 Caching... - Tanuki Temaki';
          } else if (progress.step === 'fetching_relations' || progress.step === 'processing_series') {
            step = 'tracing';
            // Show progress in title if available
            if (progress.current !== undefined && progress.total !== undefined) {
              document.title = `🔄 Tracing (${progress.current}/${progress.total}) - Tanuki Temaki`;
            } else {
              document.title = '🔄 Tracing... - Tanuki Temaki';
            }
          } else if (progress.step === 'rate_limited') {
            step = 'rate_limited';
            document.title = '⏳ Rate Limited - Tanuki Temaki';
          } else if (progress.step === 'complete') {
            step = 'complete';
            document.title = '✅ Complete - Tanuki Temaki';
          }

          setLoadingProgress({
            step,
            message,
            current: progress.current,
            total: progress.total,
          });
        }
      );

      // Step 4: Apply personalization if enabled and user is logged in
      let finalGraph = baseGraph;
      if (preferPersonalized && user) {
        setLoadingProgress({
          step: 'tracing',
          message: 'Personalizing recommendations...',
        });
        document.title = '✨ Personalizing... - Tanuki Temaki';
        finalGraph = await recommendationApi.getPersonalizedRecommendations(series.id, 2);
      }

      setRelationshipGraph(finalGraph);

      // Show completion briefly, then restore original title
      document.title = '✅ Complete - Tanuki Temaki';
      setTimeout(() => {
        setLoadingProgress(null);
        document.title = originalTitle;
      }, 2000);
    } catch (error) {
      document.title = '❌ Error - Tanuki Temaki';
      setError(error instanceof Error ? error.message : 'Failed to fetch series');
      console.error('Discovery error:', error);
      setLoadingProgress(null);
      // Restore title after showing error briefly
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (searchMode === 'tag') {
      await handleTagDiscovery();
    } else {
      await performDiscovery(url.trim());
    }
  };

  const handleTagDiscovery = async () => {
    const tagValue = url.trim();
    if (!tagValue) return;

    // Save original title and update with loading indicator
    const originalTitle = document.title;
    document.title = '🔄 Loading... - Tanuki Temaki';

    // Reset view state for new discovery
    useDiscoveryStore.setState({ treeViewport: null });
    setSelectedSeries(null);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setLoading(true);
    setError(null);

    try {
      // Generate recommendations from tag with SSE progress updates
      const mediaTypeValue = resultsMediaFilter === 'BOTH' ? 'all' : mediaType;

      const graph = await recommendationApi.getRecommendationsFromTagWithProgress(
        tagValue,
        mediaTypeValue,
        undefined, // Use backend default for maxDepth
        undefined, // Use backend default for topSeriesCount
        preferPersonalized && !!user,
        (step, message, data) => {
          // Update progress UI based on SSE events
          setLoadingProgress({ step: step as any, message });

          // Update document title based on step
          if (step === 'searching') {
            document.title = `🔍 Searching... - Tanuki Temaki`;
          } else if (step === 'fetching') {
            document.title = `📊 Finding... - Tanuki Temaki`;
          } else if (step === 'tracing') {
            const depthInfo = data?.maxDepth ? ` D${data.maxDepth}` : '';
            document.title = `🔄 Tracing [${data?.current || 0}/${data?.total || 0}]${depthInfo} - Tanuki Temaki`;
          } else if (step === 'merging') {
            document.title = `🔀 Merging... - Tanuki Temaki`;
          } else if (step === 'personalizing') {
            document.title = `✨ Personalizing... - Tanuki Temaki`;
          } else if (step === 'complete') {
            document.title = `✅ Complete - Tanuki Temaki`;
          }
        }
      );

      setRelationshipGraph(graph);
      setRootSeries(null); // No specific root series for tag search

      // Show completion briefly
      setLoadingProgress({
        step: 'complete',
        message: `✅ Found recommendations for "${tagValue}"!`,
      });
      document.title = '✅ Complete - Tanuki Temaki';
      setTimeout(() => {
        setLoadingProgress(null);
        document.title = originalTitle;
      }, 2000);
    } catch (error: any) {
      document.title = '❌ Error - Tanuki Temaki';

      // Check if it's a 404 (no series found for tag) with suggestions
      if (error.response?.status === 404 && error.response?.data?.suggestions) {
        const suggestions = error.response.data.suggestions.slice(0, 5).join(', ');
        setError(
          `No series found with the tag "${tagValue}". Try one of these popular tags instead: ${suggestions}`
        );
        // Don't log 404s to console - they're expected when a tag doesn't exist
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
        console.warn('Tag discovery error:', error.response.data.message);
      } else {
        setError(error instanceof Error ? error.message : 'Failed to generate recommendations from tag');
        console.error('Tag discovery error:', error);
      }

      setLoadingProgress(null);
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleExplore = async (seriesUrl: string) => {
    // Find the series in the relationship graph
    const series = relationshipGraph?.nodes.find(n => n.series.url === seriesUrl)?.series;
    if (!series) return;

    // Update search box and trigger discovery
    setUrl(series.title);
    await performDiscovery(series.title);
  };

  const handleSeriesSelect = async (anilistId: number, title: string) => {
    // Close modal
    setShowSelectionModal(false);
    setSeriesOptions([]);

    // Update search box
    setUrl(title);

    // Reset view state for new discovery
    useDiscoveryStore.setState({ treeViewport: null });
    setSelectedSeries(null);

    // Scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save original title and update with loading indicator
    const originalTitle = document.title;
    document.title = '🔄 Loading... - Tanuki Temaki';

    setLoading(true);
    setError(null);

    try {
      // Fetch the specific series by AniList ID
      document.title = '🔍 Fetching... - Tanuki Temaki';
      setLoadingProgress({
        step: 'searching',
        message: `Fetching "${title}" from AniList...`,
      });

      const series = await seriesApi.fetchByAniListId(anilistId, mediaType);
      setRootSeries(series);

      // Cache series data
      setLoadingProgress({
        step: 'caching',
        message: `Found "${series.title}", caching metadata...`,
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Trace relationships
      const baseGraph = await seriesApi.traceRelationshipsStream(
        series.id,
        2,
        (progress) => {
          let step: 'searching' | 'caching' | 'tracing' | 'complete' | 'rate_limited' = 'tracing';
          let message = progress.message;

          if (progress.step === 'fetching_root') {
            step = 'caching';
            document.title = '💾 Caching... - Tanuki Temaki';
          } else if (progress.step === 'fetching_relations' || progress.step === 'processing_series') {
            step = 'tracing';
            if (progress.current !== undefined && progress.total !== undefined) {
              document.title = `🔄 Tracing (${progress.current}/${progress.total}) - Tanuki Temaki`;
            } else {
              document.title = '🔄 Tracing... - Tanuki Temaki';
            }
          } else if (progress.step === 'rate_limited') {
            step = 'rate_limited';
            document.title = '⏳ Rate Limited - Tanuki Temaki';
          } else if (progress.step === 'complete') {
            step = 'complete';
            document.title = '✅ Complete - Tanuki Temaki';
          }

          setLoadingProgress({
            step,
            message,
            current: progress.current,
            total: progress.total,
          });
        }
      );

      // Apply personalization if enabled and user is logged in
      let finalGraph = baseGraph;
      if (preferPersonalized && user) {
        setLoadingProgress({
          step: 'tracing',
          message: 'Personalizing recommendations...',
        });
        document.title = '✨ Personalizing... - Tanuki Temaki';
        finalGraph = await recommendationApi.getPersonalizedRecommendations(series.id, 2);
      }

      setRelationshipGraph(finalGraph);

      document.title = '✅ Complete - Tanuki Temaki';
      setTimeout(() => {
        setLoadingProgress(null);
        document.title = originalTitle;
      }, 2000);
    } catch (error) {
      document.title = '❌ Error - Tanuki Temaki';
      setError(error instanceof Error ? error.message : 'Failed to fetch series');
      console.error('Discovery error:', error);
      setLoadingProgress(null);
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionCancel = () => {
    setShowSelectionModal(false);
    setSeriesOptions([]);
  };

  const handleSeriesClick = (seriesId: string) => {
    setSelectedSeries(seriesId);
    setViewMode('table');
  };

  const handleClearDatabase = async () => {
    if (!confirm('⚠️ Clear ALL cached data?\n\nThis will delete all series, tags, and relationships from the database. This cannot be undone!')) {
      return;
    }

    try {
      await seriesApi.clearDatabase();
      // Reset the UI state
      setRootSeries(null);
      setRelationshipGraph(null);
      setError(null);
      setCacheStats(null);
      alert('✅ Database cleared successfully!');
      // Refresh cache stats
      fetchCacheStats();
    } catch (error) {
      setError('Failed to clear database');
      console.error('Clear database error:', error);
    }
  };

  const fetchCacheStats = async () => {
    try {
      const stats = await seriesApi.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    }
  };

  // Load user's service preferences
  useEffect(() => {
    const loadUserServices = async () => {
      if (user) {
        try {
          const services = await userApi.getAvailableServices();
          setUserServices(services);
        } catch (error) {
          console.error('Failed to load user services:', error);
        }
      } else {
        setUserServices([]);
      }
    };

    loadUserServices();
  }, [user]);

  // Fetch cache stats on mount and after discoveries
  useEffect(() => {
    fetchCacheStats();
  }, []);

  useEffect(() => {
    if (relationshipGraph) {
      fetchCacheStats();
    }
  }, [relationshipGraph]);

  // Handle navigation from other pages (e.g., explore from ratings page)
  useEffect(() => {
    const state = location.state as { exploreTitle?: string; exploreMediaType?: 'ANIME' | 'MANGA' } | null;

    // Only process if we have state and haven't processed this navigation yet
    if (state?.exploreTitle && processedLocationKey.current !== location.key) {
      processedLocationKey.current = location.key;

      const title = state.exploreTitle;
      const mediaTypeToSet = state.exploreMediaType;

      // Clear the state to prevent it from persisting
      window.history.replaceState({}, document.title);

      // Set the media type if provided
      if (mediaTypeToSet) {
        setMediaType(mediaTypeToSet);
      }
      // Set the search box
      setUrl(title);
      // Trigger discovery
      performDiscovery(title);
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Loading Overlay */}
      {isLoading && loadingProgress && <LoadingOverlay progress={loadingProgress} />}

      {/* Series Selection Modal */}
      <SeriesSelectionModal
        isOpen={showSelectionModal}
        searchQuery={searchQuery}
        options={seriesOptions}
        onSelect={handleSeriesSelect}
        onCancel={handleSelectionCancel}
      />

      {/* Search Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto px-4 py-3 max-w-[1920px] pl-20">
          <div className="flex items-center gap-4 justify-center">
            {/* Search Mode Selector */}
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setSearchMode('series')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  searchMode === 'series'
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                disabled={isLoading}
              >
                🎬 Series
              </button>
              <button
                onClick={() => setSearchMode('tag')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  searchMode === 'tag'
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                disabled={isLoading}
              >
                🏷️ Tag
              </button>
            </div>

            {/* Media Type Selector */}
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setMediaType('ANIME')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mediaType === 'ANIME'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                disabled={isLoading}
              >
                📺 Anime
              </button>
              <button
                onClick={() => setMediaType('MANGA')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  mediaType === 'MANGA'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                disabled={isLoading}
              >
                📖 Manga
              </button>
            </div>

            {/* Search */}
            <div className="flex-1 flex gap-2 max-w-2xl">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                placeholder={
                  searchMode === 'tag'
                    ? 'Search by tag/genre (e.g. action, romance, comedy)...'
                    : `Search ${mediaType.toLowerCase()} by title${mediaType === 'ANIME' ? ' or Crunchyroll URL' : ''}...`
                }
                className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleDiscover}
                disabled={isLoading || !url.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
              >
                {isLoading ? 'Searching...' : 'Discover'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mx-auto px-4 py-4 max-w-[1920px]">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-red-400 font-semibold mb-1">Search Error</h3>
                <p className="text-red-200 text-sm">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <main className="flex-1 px-4 py-6 max-w-[1920px] mx-auto w-full">
        {relationshipGraph && (
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-6">
            {/* Media Type Filter */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-lg font-bold mb-3">Show in Results</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setResultsMediaFilter('BOTH')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    resultsMediaFilter === 'BOTH'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  📺📖 Both Anime & Manga
                </button>
                <button
                  onClick={() => setResultsMediaFilter('ANIME')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    resultsMediaFilter === 'ANIME'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  📺 Anime Only
                </button>
                <button
                  onClick={() => setResultsMediaFilter('MANGA')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    resultsMediaFilter === 'MANGA'
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  📖 Manga Only
                </button>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-lg font-bold mb-3">View Mode</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'tree'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  🌳 Tree View
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  📋 Table View
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-lg font-bold mb-3">Current Search</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-blue-500">
                    {relationshipGraph.nodes.length}
                  </div>
                  <div className="text-sm text-zinc-400">Series Found</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">
                    {relationshipGraph.edges.length}
                  </div>
                  <div className="text-sm text-zinc-400">Relationships</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-500">
                    {new Set(relationshipGraph.nodes.map(n => n.cluster)).size}
                  </div>
                  <div className="text-sm text-zinc-400">Clusters</div>
                </div>
                <div>
                  {(() => {
                    // Find oldest data timestamp
                    const oldestTimestamp = Math.min(
                      ...relationshipGraph.nodes.map(n => new Date(n.series.fetchedAt).getTime())
                    );
                    const ageMs = Date.now() - oldestTimestamp;
                    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
                    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
                    const ageMinutes = Math.floor(ageMs / (60 * 1000));

                    let ageText = '';
                    let ageColor = 'text-green-500';

                    if (ageDays > 0) {
                      ageText = `${ageDays}d old`;
                      ageColor = ageDays > 7 ? 'text-red-500' : ageDays > 3 ? 'text-yellow-500' : 'text-green-500';
                    } else if (ageHours > 0) {
                      ageText = `${ageHours}h old`;
                      ageColor = 'text-green-500';
                    } else {
                      ageText = ageMinutes < 1 ? 'Just now' : `${ageMinutes}m old`;
                      ageColor = 'text-green-500';
                    }

                    return (
                      <>
                        <div className={`text-2xl font-bold ${ageColor}`}>
                          {ageText}
                        </div>
                        <div className="text-sm text-zinc-400">Data Age</div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Clear Database Button (for testing) */}
              <button
                onClick={handleClearDatabase}
                className="w-full mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
                title="Delete all cached data from database"
              >
                🗑️ Clear Database
              </button>
            </div>

            {/* Cache Stats */}
            {cacheStats && (
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <h3 className="text-lg font-bold mb-3">Database Cache</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-blue-500">
                      {cacheStats.totalSeries}
                    </div>
                    <div className="text-sm text-zinc-400">Total Series</div>
                  </div>

                  {/* Media Type Breakdown */}
                  {cacheStats.byMediaType.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="text-xs font-semibold text-zinc-500 mb-2">By Type</div>
                      {cacheStats.byMediaType.map(({ mediaType, count }) => (
                        <div key={mediaType} className="flex justify-between items-center mb-1">
                          <span className="text-sm text-zinc-400">
                            {mediaType === 'ANIME' ? '📺 Anime' : '📖 Manga'}
                          </span>
                          <span className={`text-sm font-semibold ${
                            mediaType === 'ANIME' ? 'text-blue-400' : 'text-green-400'
                          }`}>
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Tags</span>
                      <span className="text-sm font-semibold text-zinc-300">{cacheStats.totalTags}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-400">Relations</span>
                      <span className="text-sm font-semibold text-zinc-300">{cacheStats.totalRelationships}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Service filters */}
            {(animeServices.length > 0 || mangaServices.length > 0) && (
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold">Filter by Service</h3>
                  {user && (
                    <button
                      onClick={async () => {
                        try {
                          const userServices = await userApi.getAvailableServices();
                          // Deselect all services NOT in user's preferences
                          const allServices = [...animeServices, ...mangaServices];
                          allServices.forEach(service => {
                            const isInPreferences = userServices.includes(service);
                            const isCurrentlyDeselected = deselectedServices.has(service);
                            // If service is not in preferences and not already deselected, deselect it
                            if (!isInPreferences && !isCurrentlyDeselected) {
                              toggleService(service);
                            }
                            // If service is in preferences and currently deselected, re-select it
                            else if (isInPreferences && isCurrentlyDeselected) {
                              toggleService(service);
                            }
                          });
                        } catch (error) {
                          console.error('Failed to load service preferences:', error);
                        }
                      }}
                      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      title="Apply your saved service preferences"
                    >
                      Apply My Services
                    </button>
                  )}
                </div>

                {/* Anime Streaming Services */}
                {animeServices.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-zinc-400 mb-2">📺 Anime Streaming</h4>
                    <div className="flex flex-wrap gap-2">
                      {animeServices.map((service) => {
                        // Get platform icon for anime platforms
                        const getAnimePlatformIcon = (platform: string) => {
                          const lower = platform.toLowerCase();
                          if (lower.includes('crunchyroll')) return '🍥';
                          if (lower.includes('netflix')) return '🎬';
                          if (lower.includes('hulu')) return '💚';
                          if (lower.includes('amazon') || lower.includes('prime video')) return '📦';
                          if (lower.includes('disney')) return '✨';
                          if (lower.includes('funimation')) return '⚡';
                          if (lower.includes('hidive')) return '🌊';
                          if (lower.includes('vrv')) return '📡';
                          if (lower.includes('animelab')) return '🧪';
                          if (lower.includes('wakanim')) return '🌸';
                          if (lower.includes('tubi')) return '📺';
                          if (lower.includes('peacock')) return '🦚';
                          if (lower.includes('hbo') || lower.includes('max')) return '🎭';
                          if (lower.includes('bilibili')) return '📱';
                          if (lower.includes('aniplus')) return '➕';
                          return '📺';
                        };

                        return (
                          <button
                            key={service}
                            onClick={() => toggleService(service)}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                              deselectedServices.has(service)
                                ? 'bg-zinc-800 text-zinc-600 line-through'
                                : 'bg-orange-600/20 border border-orange-600/50 text-orange-300 hover:bg-orange-600/30'
                            }`}
                          >
                            {getAnimePlatformIcon(service)} {service}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manga Reading Platforms */}
                {mangaServices.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-400 mb-2">📖 Manga Reading</h4>
                    <div className="flex flex-wrap gap-2">
                      {mangaServices.map((service) => {
                        // Get platform icon for manga platforms
                        const getMangaPlatformIcon = (platform: string) => {
                          const lower = platform.toLowerCase();
                          if (lower.includes('manga planet')) return '🪐';
                          if (lower.includes('mangaplus') || lower.includes('manga plus')) return '➕';
                          if (lower.includes('viz')) return '📚';
                          if (lower.includes('kodansha') || lower.includes('k manga') || lower.includes('kmanga')) return '🎌';
                          if (lower.includes('azuki') || lower.includes('omoi')) return '🍵';
                          if (lower.includes('comico')) return '💬';
                          if (lower.includes('pocket')) return '📱';
                          if (lower.includes('crunchyroll manga') || lower.includes('crunchyroll.com/comics')) return '🍥';
                          if (lower.includes('bookwalker')) return '📕';
                          if (lower.includes('comixology') || lower.includes('kindle')) return '📘';
                          if (lower.includes('seven seas')) return '🌊';
                          if (lower.includes('yen press')) return '💴';
                          if (lower.includes('inkr') || lower.includes('inkr comics')) return '🖊️';
                          if (lower.includes('webtoon') || lower.includes('webtoons')) return '📜';
                          if (lower.includes('tapas')) return '🎨';
                          if (lower.includes('lezhin')) return '💎';
                          if (lower.includes('tappytoon')) return '🎪';
                          return '📖';
                        };

                        return (
                          <button
                            key={service}
                            onClick={() => toggleService(service)}
                            className={`px-3 py-1.5 rounded text-sm transition-colors ${
                              deselectedServices.has(service)
                                ? 'bg-zinc-800 text-zinc-600 line-through'
                                : 'bg-green-600/20 border border-green-600/50 text-green-300 hover:bg-green-600/30'
                            }`}
                          >
                            {getMangaPlatformIcon(service)} {service}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <div className="mb-3">
                  <h3 className="text-lg font-bold mb-2">Filter by Tag</h3>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterMode === 'all'}
                        onChange={e => setFilterMode(e.target.checked ? 'all' : 'primary')}
                        className="accent-blue-500"
                      />
                      Match all (not just primary)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Clear all filters - set all tags to neutral
                          allTags.forEach(({ tag }) => {
                            // Click until neutral (not in required or excluded)
                            while (requiredTags.has(tag) || excludedTags.has(tag)) {
                              toggleTag(tag);
                            }
                          });
                        }}
                        className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                        title="Clear all tag filters"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags
                    .filter(({ isPrimary }) => filterMode === 'all' || isPrimary) // Show only primary tags in primary mode
                    .map(({ tag, count, isPrimary }) => {
                    const isRequired = requiredTags.has(tag);
                    const isExcluded = excludedTags.has(tag);

                    let className = 'px-2 py-0.5 rounded text-xs transition-colors ';
                    let title = `${count} series`;

                    if (isPrimary) {
                      title += ' • Primary tag (first-level branch)';
                    }
                    title += ' - Click to cycle: ';

                    if (isRequired) {
                      // Required state - green
                      className += 'bg-green-600/30 border border-green-600/50 text-green-300 hover:bg-green-600/40';
                      title += 'Required (show only) → Excluded → Neutral';
                    } else if (isExcluded) {
                      // Excluded state - red with strikethrough
                      className += 'bg-red-600/30 border border-red-600/50 text-red-300 hover:bg-red-600/40 line-through';
                      title += 'Excluded (hide) → Neutral → Required';
                    } else {
                      // Neutral state - gray
                      className += 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600';
                      title += 'Neutral → Required → Excluded';
                    }

                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={className}
                        title={title}
                      >
                        {isRequired && '✓ '}
                        {isExcluded && '✗ '}
                        {isPrimary && '★ '}
                        {tag}
                        <span className={`ml-1 ${isExcluded ? 'text-red-400' : isRequired ? 'text-green-400' : 'text-zinc-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Visualization */}
            {viewMode === 'tree' ? (
              <TreeView
                relationship={relationshipGraph}
                requiredTags={requiredTags}
                excludedTags={excludedTags}
                filterMode={filterMode}
                rootTags={rootTags}
                deselectedServices={deselectedServices}
                resultsMediaFilter={resultsMediaFilter}
                userServices={userServices}
                onSeriesClick={handleSeriesClick}
              />
            ) : (
              <TableView
                key={relationshipGraph.rootId}
                relationship={relationshipGraph}
                requiredTags={requiredTags}
                excludedTags={excludedTags}
                filterMode={filterMode}
                rootTags={rootTags}
                deselectedServices={deselectedServices}
                resultsMediaFilter={resultsMediaFilter}
                userServices={userServices}
                selectedSeriesId={selectedSeriesId}
                onExplore={handleExplore}
              />
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
