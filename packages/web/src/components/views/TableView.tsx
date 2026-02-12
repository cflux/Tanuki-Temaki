import { useMemo, useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { Series, SeriesRelationship } from '@tanuki-temaki/shared';

interface TableViewProps {
  relationship: SeriesRelationship;
  requiredTags: Set<string>;
  excludedTags: Set<string>;
  filterMode: 'primary' | 'all';
  rootTags: Set<string>;
  deselectedServices: Set<string>;
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH';
  selectedSeriesId?: string | null;
  onExplore?: (seriesUrl: string) => void;
}

const columnHelper = createColumnHelper<Series>();

function createColumns(onExplore?: (seriesUrl: string) => void) {
  return [
    columnHelper.accessor('titleImage', {
    header: 'Cover',
    cell: (info) => {
      const image = info.getValue();
      return image ? (
        <img
          src={image}
          alt=""
          className="object-cover rounded"
          style={{ width: 144, height: 192, flexShrink: 0, maxWidth: 'none' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="bg-zinc-800 rounded flex items-center justify-center text-zinc-600"
          style={{ width: 144, height: 192, flexShrink: 0 }}
        >
          No Image
        </div>
      );
    },
    enableSorting: false,
    enableColumnFilter: false,
    size: 144,
    minSize: 144,
  }),
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => {
      const series = info.row.original;
      const streamingLinks = (series.metadata as any)?.streamingLinks || {};

      // Get platform icon
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

      const mediaType = series.mediaType || 'ANIME';
      const mediaIcon = mediaType === 'MANGA' ? '📖' : '📺';
      const mediaBadgeColor = mediaType === 'MANGA' ? 'bg-green-600/20 border-green-600/50 text-green-300' : 'bg-blue-600/20 border-blue-600/50 text-blue-300';

      // Extract metadata
      const metadata = series.metadata as any;
      const chapters = metadata?.chapters;
      const volumes = metadata?.volumes;
      const episodes = metadata?.episodes;

      return (
        <div style={{ width: 400, minWidth: 400, maxWidth: 400 }}>
          <div className="font-semibold mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${mediaBadgeColor}`}>
              {mediaIcon} {mediaType}
            </span>
            <span>{info.getValue()}</span>
          </div>

          {/* Manga/Anime metadata */}
          {(chapters || volumes || episodes) && (
            <div className="mb-2 flex gap-2 text-xs text-zinc-400">
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

          <div className="flex gap-2 flex-wrap">
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
        </div>
      );
    },
    size: 400,
    minSize: 400,
    maxSize: 400,
  }),
  columnHelper.accessor('description', {
    header: 'Description',
    cell: (info) => {
      const description = info.getValue();
      return (
        <div className="text-sm text-zinc-400" title={description}>
          {description.length > 300 ? `${description.slice(0, 300)}...` : description}
        </div>
      );
    },
  }),
  columnHelper.accessor('genres', {
    header: 'Genres',
    cell: (info) => (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {info.getValue().map((genre, idx) => (
          <span
            key={idx}
            className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300"
          >
            {genre}
          </span>
        ))}
      </div>
    ),
    enableSorting: false,
    size: 200,
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
    cell: (info) => (
      <div className="flex flex-wrap gap-1 max-w-[250px]">
        {info.getValue().slice(0, 5).map((tag) => (
          <span
            key={tag.id}
            className="px-2 py-1 bg-blue-900/30 border border-blue-700 rounded text-xs text-blue-300"
            title={`${tag.source} • ${(tag.confidence * 100).toFixed(0)}%`}
          >
            {tag.value}
          </span>
        ))}
        {info.getValue().length > 5 && (
          <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-500">
            +{info.getValue().length - 5}
          </span>
        )}
      </div>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('rating', {
    header: 'Rating',
    cell: (info) => {
      const rating = info.getValue();
      return rating ? (
        <div className="text-amber-400 font-semibold">
          ★ {rating.toFixed(1)}
        </div>
      ) : (
        <span className="text-zinc-600">N/A</span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: (info) => (
      <button
        onClick={() => onExplore?.(info.row.original.url)}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
        title="Explore relationships from this series"
      >
        Explore
      </button>
    ),
    size: 100,
    enableSorting: false,
  }),
  ];
}

export function TableView({ relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter, selectedSeriesId, onExplore }: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  const columns = useMemo(() => createColumns(onExplore), [onExplore]);

  const data = useMemo(
    () => {
      const normalize = (t: string) => {
        let normalized = t.toLowerCase();

        // Remove common season/part indicators
        normalized = normalized
          .replace(/season\s*\d+/gi, '')
          .replace(/part\s*\d+/gi, '')
          .replace(/cour\s*\d+/gi, '')
          .replace(/\d+(st|nd|rd|th)\s*season/gi, '')
          .replace(/-[^-]*-$/g, '') // Remove trailing subtitle like "-Arise from the Shadow-"
          .replace(/\s+/g, ''); // Remove spaces

        // Remove all non-alphanumeric
        return normalized.replace(/[^a-z0-9]/g, '');
      };

      const rootNode = relationship.nodes.find(n => n.series.id === relationship.rootId);
      const rootTitleNorm = normalize(rootNode?.series.title ?? '');

      return relationship.nodes
        .filter(n => {
          const isRootById = n.series.id === relationship.rootId;
          const isRootByTitle = normalize(n.series.title) === rootTitleNorm;
          return !(isRootById || isRootByTitle);
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
    },
    [relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Scroll to selected row when selectedSeriesId changes
  useEffect(() => {
    if (selectedSeriesId && selectedRowRef.current) {
      // Scroll to the selected row
      setTimeout(() => {
        if (selectedRowRef.current) {
          selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [selectedSeriesId]);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search series..."
          className="w-full max-w-md px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-200 placeholder-zinc-500"
        />
      </div>

      {/* Table */}
      <div>
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-zinc-700">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-left p-3 text-zinc-300 font-semibold cursor-pointer hover:bg-zinc-800 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <span className="text-zinc-500">
                          {{
                            asc: '↑',
                            desc: '↓',
                          }[header.column.getIsSorted() as string] ?? '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isSelected = row.original.id === selectedSeriesId;
              return (
                <tr
                  key={row.id}
                  ref={isSelected ? selectedRowRef : null}
                  className={`border-b border-zinc-800 hover:bg-zinc-800 transition-colors ${
                    isSelected ? 'bg-blue-900/30 ring-2 ring-blue-500' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 text-zinc-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total count */}
      <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
        <div className="text-sm text-zinc-400">
          {table.getFilteredRowModel().rows.length} series
        </div>
      </div>
    </div>
  );
}
