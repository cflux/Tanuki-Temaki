import { create } from 'zustand';
import type { Series, SeriesRelationship } from '@tanuki-temaki/shared';

export interface LoadingProgress {
  step: 'searching' | 'caching' | 'tracing' | 'complete' | 'rate_limited';
  message: string;
  current?: number;
  total?: number;
  rateLimitInfo?: {
    waitTimeMs: number;
    attempt: number;
    maxRetries: number;
  };
}

interface DiscoveryState {
  // Current discovery
  rootSeries: Series | null;
  relationshipGraph: SeriesRelationship | null;
  mediaType: 'ANIME' | 'MANGA'; // Search media type
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH'; // Results display filter

  // UI state
  viewMode: 'tree' | 'table';
  selectedSeriesId: string | null;
  isLoading: boolean;
  loadingProgress: LoadingProgress | null;
  error: string | null;
  treeViewport: { x: number; y: number; zoom: number } | null;

  // Tag filter state
  requiredTags: Set<string>; // Series MUST have at least one of these
  excludedTags: Set<string>; // Series must NOT have any of these
  filterMode: 'primary' | 'all';

  // Service filter state
  deselectedServices: Set<string>;

  // Actions
  setRootSeries: (series: Series | null) => void;
  setRelationshipGraph: (graph: SeriesRelationship | null) => void;
  setMediaType: (type: 'ANIME' | 'MANGA') => void;
  setResultsMediaFilter: (filter: 'ANIME' | 'MANGA' | 'BOTH') => void;
  setViewMode: (mode: 'tree' | 'table') => void;
  setSelectedSeries: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: LoadingProgress | null) => void;
  setError: (error: string | null) => void;
  setTreeViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  toggleTag: (tag: string) => void; // Cycles: neutral → required → excluded
  setFilterMode: (mode: 'primary' | 'all') => void;
  clearTagFilters: () => void;
  toggleService: (service: string) => void;
  clearServiceFilters: () => void;
  reset: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  // Initial state
  rootSeries: null,
  relationshipGraph: null,
  mediaType: 'ANIME',
  resultsMediaFilter: 'BOTH',
  viewMode: 'tree',
  selectedSeriesId: null,
  isLoading: false,
  loadingProgress: null,
  error: null,
  treeViewport: null,
  requiredTags: new Set(),
  excludedTags: new Set(),
  filterMode: 'all',
  deselectedServices: new Set(),

  // Actions
  setRootSeries: (series) => set({ rootSeries: series }),
  setRelationshipGraph: (graph) => set({ relationshipGraph: graph, requiredTags: new Set(), excludedTags: new Set() }),
  setMediaType: (type) => set({ mediaType: type }),
  setResultsMediaFilter: (filter) => set({ resultsMediaFilter: filter }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedSeries: (id) => set({ selectedSeriesId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setError: (error) => set({ error }),
  setTreeViewport: (viewport) => set({ treeViewport: viewport }),
  toggleTag: (tag) =>
    set((state) => {
      const required = new Set(state.requiredTags);
      const excluded = new Set(state.excludedTags);

      // Cycle through states: neutral → required → excluded → neutral
      if (!required.has(tag) && !excluded.has(tag)) {
        // neutral → required
        required.add(tag);
      } else if (required.has(tag)) {
        // required → excluded
        required.delete(tag);
        excluded.add(tag);
      } else {
        // excluded → neutral
        excluded.delete(tag);
      }

      return { requiredTags: required, excludedTags: excluded };
    }),
  setFilterMode: (mode) => set({ filterMode: mode }),
  clearTagFilters: () => set({ requiredTags: new Set(), excludedTags: new Set() }),
  toggleService: (service) =>
    set((state) => {
      const next = new Set(state.deselectedServices);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return { deselectedServices: next };
    }),
  clearServiceFilters: () => set({ deselectedServices: new Set() }),
  reset: () =>
    set({
      rootSeries: null,
      relationshipGraph: null,
      mediaType: 'ANIME',
      resultsMediaFilter: 'BOTH',
      selectedSeriesId: null,
      isLoading: false,
      loadingProgress: null,
      error: null,
      requiredTags: new Set(),
      excludedTags: new Set(),
      filterMode: 'all',
      deselectedServices: new Set(),
    }),
}));
