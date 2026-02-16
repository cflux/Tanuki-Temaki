import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDiscoveryStore } from '../../store/discoveryStore';
import { seriesApi, recommendationApi, userApi } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { TreeView } from '../../components/views/TreeView';
import { TableView } from '../../components/views/TableView';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { SeriesSelectionModal } from '../../components/SeriesSelectionModal';
import { NAVIGATION_DELAY } from '../../config/uiConstants';

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
  const { user, preferPersonalized, resultsMediaFilter: savedResultsMediaFilter, setResultsMediaFilter: saveResultsMediaFilter, filterAdultContent } = useUserStore();
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

      const results = await seriesApi.searchMultiple(searchQuery, mediaType, 10, filterAdultContent);

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
      const series = await seriesApi.searchByTitle(selectedResult.title, mediaType, filterAdultContent);
      setRootSeries(series);

      // Step 2: Cache series data
      setLoadingProgress({
        step: 'caching',
        message: `Found "${series.title}", caching metadata...`,
      });

      // Small delay to show caching step
      await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY.ROUTE_TRANSITION));

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

  const handleExplore = useCallback(async (seriesUrl: string) => {
    // Find the series in the relationship graph
    const series = relationshipGraph?.nodes.find(n => n.series.url === seriesUrl)?.series;
    if (!series) return;

    // Update search box and trigger discovery
    setUrl(series.title);
    await performDiscovery(series.title);
  }, [relationshipGraph]);

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

      await new Promise(resolve => setTimeout(resolve, NAVIGATION_DELAY.ROUTE_TRANSITION));

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

  const handleSeriesClick = useCallback((seriesId: string) => {
    setSelectedSeries(seriesId);
    setViewMode('table');
  }, [setSelectedSeries, setViewMode]);


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

  // Initialize resultsMediaFilter from saved preference on mount
  useEffect(() => {
    setResultsMediaFilter(savedResultsMediaFilter);
  }, []); // Only run once on mount

  // Save resultsMediaFilter preference when it changes
  useEffect(() => {
    saveResultsMediaFilter(resultsMediaFilter);
  }, [resultsMediaFilter, saveResultsMediaFilter]);

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

  // Force table view on mobile (tree view not supported on small screens)
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile && viewMode === 'tree') {
        setViewMode('table');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [viewMode, setViewMode]);

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
      <header className="border-b border-cyber-accent bg-cyber-bg-elevated backdrop-blur sticky top-8 md:top-0 z-40 shadow-cyber-sm before:content-[''] before:absolute before:inset-x-0 before:bottom-full before:h-8 before:bg-cyber-bg before:md:hidden">
        <div className="mx-auto px-2 md:px-4 py-2 md:py-3 max-w-[1920px] md:pl-20">
          {/* Mobile Layout */}
          <div className="md:hidden space-y-2">
            {/* Row 1: Search Mode + Media Type */}
            <div className="flex gap-2 justify-center">
              {/* Search Mode Selector */}
              <div className="flex gap-1 bg-cyber-bg p-0.5 border border-cyber-border">
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setSearchMode('series')}
                      className={`px-2 py-1 text-[10px] font-medium transition-all uppercase ${
                        searchMode === 'series'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      SER
                    </button>
                  </div>
                </div>
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setSearchMode('tag')}
                      className={`px-2 py-1 text-[10px] font-medium transition-all uppercase ${
                        searchMode === 'tag'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      TAG
                    </button>
                  </div>
                </div>
              </div>

              {/* Media Type Selector */}
              <div className="flex gap-1 bg-cyber-bg p-0.5 border border-cyber-border">
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setMediaType('ANIME')}
                      className={`px-2 py-1 text-[10px] font-medium transition-all uppercase ${
                        mediaType === 'ANIME'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      ANIM
                    </button>
                  </div>
                </div>
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setMediaType('MANGA')}
                      className={`px-2 py-1 text-[10px] font-medium transition-all uppercase ${
                        mediaType === 'MANGA'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      MANG
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Search Input + GO Button + Results Filter */}
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                placeholder={
                  searchMode === 'tag'
                    ? 'TAG/GENRE...'
                    : `${mediaType}...`
                }
                className="flex-1 px-3 py-1.5 bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-accent text-base font-mono uppercase"
                disabled={isLoading}
              />
              <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <button
                    onClick={handleDiscover}
                    disabled={isLoading || !url.trim()}
                    className="px-4 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:hover:bg-cyber-bg font-medium transition-all text-xs uppercase"
                    style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                  >
                    {isLoading ? 'GO' : 'GO'}
                  </button>
                </div>
              </div>

              {/* Results Filter */}
              <div className="flex gap-1 bg-cyber-bg p-0.5 border border-cyber-border">
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setResultsMediaFilter('BOTH')}
                      className={`px-2 py-1 text-[10px] transition-all font-bold ${
                        resultsMediaFilter === 'BOTH'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      ALL
                    </button>
                  </div>
                </div>
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setResultsMediaFilter('ANIME')}
                      className={`px-2 py-1 text-[10px] transition-all font-bold ${
                        resultsMediaFilter === 'ANIME'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      TV
                    </button>
                  </div>
                </div>
                <div className="inline-flex" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
                    <button
                      onClick={() => setResultsMediaFilter('MANGA')}
                      className={`px-2 py-1 text-[10px] transition-all font-bold ${
                        resultsMediaFilter === 'MANGA'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent'
                          : 'bg-cyber-bg text-cyber-text-dim border border-transparent'
                      }`}
                      style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      disabled={isLoading}
                    >
                      BK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center gap-4 justify-center">
            {/* Search Mode Selector */}
            <div className="flex gap-1 bg-cyber-bg p-1 border border-cyber-border">
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setSearchMode('series')}
                    className={`px-3 py-1.5 text-xs font-medium transition-all uppercase tracking-wider ${
                      searchMode === 'series'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                  >
                    [SERIES]
                  </button>
                </div>
              </div>
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setSearchMode('tag')}
                    className={`px-3 py-1.5 text-xs font-medium transition-all uppercase tracking-wider ${
                      searchMode === 'tag'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                  >
                    [TAG]
                  </button>
                </div>
              </div>
            </div>

            {/* Media Type Selector */}
            <div className="flex gap-1 bg-cyber-bg p-1 border border-cyber-border">
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setMediaType('ANIME')}
                    className={`px-3 py-1.5 text-xs font-medium transition-all uppercase tracking-wider ${
                      mediaType === 'ANIME'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                  >
                    [TV] ANIME
                  </button>
                </div>
              </div>
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setMediaType('MANGA')}
                    className={`px-3 py-1.5 text-xs font-medium transition-all uppercase tracking-wider ${
                      mediaType === 'MANGA'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                  >
                    [BOOK] MANGA
                  </button>
                </div>
              </div>
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
                    ? 'SEARCH BY TAG/GENRE...'
                    : `SEARCH ${mediaType.toUpperCase()}...`
                }
                className="flex-1 px-4 py-2 bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm transition-all text-base font-mono uppercase"
                disabled={isLoading}
              />
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={handleDiscover}
                    disabled={isLoading || !url.trim()}
                    className="px-6 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:hover:bg-cyber-bg font-medium transition-all text-sm whitespace-nowrap uppercase tracking-wider shadow-cyber-md hover:shadow-cyber-lg"
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                  >
                    {isLoading ? 'SEARCHING...' : 'DISCOVER'}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Filter - Icon only */}
            <div className="flex gap-1 bg-cyber-bg p-1 border border-cyber-border">
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setResultsMediaFilter('BOTH')}
                    className={`px-2 h-9 flex items-center justify-center gap-0.5 text-xs transition-all font-bold ${
                      resultsMediaFilter === 'BOTH'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent hover:bg-cyber-bg-elevated border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                    title="Show both anime and manga in results"
                  >
                    ALL
                  </button>
                </div>
              </div>
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setResultsMediaFilter('ANIME')}
                    className={`w-9 h-9 flex items-center justify-center text-xs transition-all font-bold ${
                      resultsMediaFilter === 'ANIME'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent hover:bg-cyber-bg-elevated border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                    title="Show only anime in results"
                  >
                    TV
                  </button>
                </div>
              </div>
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setResultsMediaFilter('MANGA')}
                    className={`w-9 h-9 flex items-center justify-center text-xs transition-all font-bold ${
                      resultsMediaFilter === 'MANGA'
                        ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-sm'
                        : 'bg-cyber-bg text-cyber-text-dim hover:text-cyber-accent hover:bg-cyber-bg-elevated border border-transparent'
                    }`}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    disabled={isLoading}
                    title="Show only manga in results"
                  >
                    BK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mx-auto px-4 py-4 max-w-[1920px]">
          <div className="bg-cyber-bg-card border-2 border-red-500 p-4 shadow-[0_0_12px_rgba(255,0,0,0.5)]">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-red-400 font-semibold mb-1 uppercase tracking-wider">SEARCH ERROR</h3>
                <p className="text-red-200 text-sm font-mono">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 transition-colors font-bold"
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
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar - Hidden on mobile */}
          <div className="hidden md:block md:w-80 md:flex-shrink-0 space-y-6">

            {/* View Mode Toggle - Hidden on mobile, tree view disabled on mobile */}
            <div className="hidden md:block bg-cyber-bg-card p-4 border border-cyber-border">
              <h3 className="text-lg font-bold mb-3 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border-dim pb-2">VIEW MODE</h3>
              <div className="flex flex-col gap-2">
                <div className="flex w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <div className="bg-cyber-accent p-[1px] w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                    <button
                      onClick={() => setViewMode('tree')}
                      className={`px-4 py-2 font-medium transition-all uppercase tracking-wide w-full ${
                        viewMode === 'tree'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
                          : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
                      }`}
                      style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    >
                      [TREE] VIEW
                    </button>
                  </div>
                </div>
                <div className="flex w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <div className="bg-cyber-accent p-[1px] w-full" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-4 py-2 font-medium transition-all uppercase tracking-wide w-full ${
                        viewMode === 'table'
                          ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
                          : 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent'
                      }`}
                      style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    >
                      [LIST] VIEW
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-cyber-bg-card p-4 border border-cyber-border">
              <h3 className="text-lg font-bold mb-3 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border-dim pb-2">CURRENT SEARCH</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold text-cyber-accent font-mono">
                    {relationshipGraph.nodes.length}
                  </div>
                  <div className="text-sm text-cyber-text-dim uppercase tracking-wide">SERIES FOUND</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyber-accent-bright font-mono">
                    {relationshipGraph.edges.length}
                  </div>
                  <div className="text-sm text-cyber-text-dim uppercase tracking-wide">RELATIONSHIPS</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyber-accent-dim font-mono">
                    {new Set(relationshipGraph.nodes.map(n => n.cluster)).size}
                  </div>
                  <div className="text-sm text-cyber-text-dim uppercase tracking-wide">CLUSTERS</div>
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
                        <div className={`text-2xl font-bold ${ageColor} font-mono`}>
                          {ageText}
                        </div>
                        <div className="text-sm text-cyber-text-dim uppercase tracking-wide">DATA AGE</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Service filters */}
            {(animeServices.length > 0 || mangaServices.length > 0) && (
              <div className="bg-cyber-bg-card p-4 border border-cyber-border">
                <div className="flex items-center justify-between mb-3 border-b border-cyber-border-dim pb-2">
                  <h3 className="text-lg font-bold text-cyber-text-bright uppercase tracking-wider">FILTER BY SERVICE</h3>
                  {user && (
                    <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                      <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
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
                          className="text-xs px-3 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg transition-all uppercase tracking-wider"
                          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                          title="Apply your saved service preferences"
                        >
                          APPLY MY SERVICES
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Anime Streaming Services */}
                {animeServices.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-cyber-text-dim mb-2 uppercase tracking-wider">[TV] ANIME STREAMING</h4>
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
                          <div key={service} className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                            <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                              <button
                                onClick={() => toggleService(service)}
                                className={`px-3 py-1.5 text-sm transition-all uppercase tracking-wide ${
                                  deselectedServices.has(service)
                                    ? 'bg-cyber-bg-elevated text-cyber-text-dim line-through border border-cyber-border-dim'
                                    : 'bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg'
                                }`}
                                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                              >
                                {getAnimePlatformIcon(service)} {service}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manga Reading Platforms */}
                {mangaServices.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-cyber-text-dim mb-2 uppercase tracking-wider">[BOOK] MANGA READING</h4>
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
                          <div key={service} className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                            <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                              <button
                                onClick={() => toggleService(service)}
                                className={`px-3 py-1.5 text-sm transition-all uppercase tracking-wide ${
                                  deselectedServices.has(service)
                                    ? 'bg-cyber-bg-elevated text-cyber-text-dim line-through border border-cyber-border-dim'
                                    : 'bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg'
                                }`}
                                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                              >
                                {getMangaPlatformIcon(service)} {service}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="bg-cyber-bg-card p-4 border border-cyber-border">
                <div className="mb-3">
                  <h3 className="text-lg font-bold mb-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border-dim pb-2">FILTER BY TAG</h3>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm text-cyber-text-dim cursor-pointer select-none uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={filterMode === 'all'}
                        onChange={e => setFilterMode(e.target.checked ? 'all' : 'primary')}
                        className="accent-cyber-accent"
                      />
                      MATCH ALL
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
                        className="text-xs px-2 py-1 bg-transparent border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent transition-all uppercase tracking-wide"
                        title="Clear all tag filters"
                      >
                        CLEAR ALL
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

                    let className = 'px-2 py-0.5 text-xs transition-all uppercase tracking-wide font-mono ';
                    let title = `${count} series`;

                    if (isPrimary) {
                      title += ' • Primary tag (first-level branch)';
                    }
                    title += ' - Click to cycle: ';

                    if (isRequired) {
                      // Required state - cyber accent
                      className += 'bg-cyber-bg border border-cyber-accent text-cyber-accent shadow-cyber-sm hover:bg-cyber-accent hover:text-cyber-bg';
                      title += 'Required (show only) → Excluded → Neutral';
                    } else if (isExcluded) {
                      // Excluded state - red with strikethrough
                      className += 'bg-cyber-bg border border-red-500 text-red-400 line-through hover:bg-red-500 hover:text-black';
                      title += 'Excluded (hide) → Neutral → Required';
                    } else {
                      // Neutral state - dim
                      className += 'bg-cyber-bg border border-cyber-border-dim text-cyber-text-dim hover:border-cyber-border hover:text-cyber-text';
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
                        <span className={`ml-1 ${isExcluded ? 'text-red-400' : isRequired ? 'text-cyber-accent-bright' : 'text-cyber-text-dim'}`}>
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
