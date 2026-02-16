import { useMemo, useState, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  ConnectionLineType,
  MarkerType,
  Handle,
  Position,
  useStore,
  type EdgeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { SeriesRelationship, SeriesNode as SeriesNodeType } from '@tanuki-temaki/shared';
import { useDiscoveryStore } from '../../store/discoveryStore';

const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#a78bfa', '#fb923c',
];

function hashColor(str: string): string {
  let hash = 0;
  for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ---- Layout constants ----
const CARD_W = 340;
const CARD_H = 170; // Increased height to accommodate wrapping titles
const TAG_H = 46;
const LEVEL_STEP = 400;
const SIBLING_GAP = 80; // Spacing between sibling groups
const CARD_GAP = 40; // Spacing between cards within the same multi-column group
const COL_GAP = 40; // horizontal gap between columns in 2-col leaf groups (wide enough to route lines through)

// ---- Node components ----

const TagLabelNode = memo(function TagLabelNode({ data }: { data: any }) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverZoom, setHoverZoom] = useState(1);
  const [nodeWrapper, setNodeWrapper] = useState<HTMLElement | null>(null);
  const getZoom = useStore((state) => () => state.transform[2]);

  // Calculate scale to make tag appear larger on hover, compensating for zoom
  const targetScale = isHovered ? 1.5 / hoverZoom : 1;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className="px-5 py-2.5 rounded-lg font-bold text-base text-white shadow-lg select-none whitespace-nowrap border-2 border-white/20 cursor-pointer"
        style={{
          backgroundColor: data.color,
          minWidth: 100,
          textAlign: 'center',
          transform: `scale(${targetScale})`,
          transformOrigin: 'center',
          position: 'relative',
          zIndex: isHovered ? 9999 : 1,
          willChange: isHovered ? 'transform' : 'auto',
        }}
        onMouseEnter={(e) => {
          const currentZoom = getZoom();
          setHoverZoom(currentZoom);
          setIsHovered(true);
          const wrapper = e.currentTarget.closest('.react-flow__node') as HTMLElement;
          setNodeWrapper(wrapper);
          if (wrapper) {
            wrapper.style.zIndex = '9999';
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (nodeWrapper) {
            nodeWrapper.style.zIndex = '';
            setNodeWrapper(null);
          }
        }}
      >
        # {data.label}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
});

const SeriesCardNode = memo(function SeriesCardNode({ data }: { data: any }) {
  const { series, isRoot, newTags, color, userServices, onSeriesClick } = data;
  const [isHovered, setIsHovered] = useState(false);
  const [hoverZoom, setHoverZoom] = useState(1); // Store zoom level when hovering starts
  const [nodeWrapper, setNodeWrapper] = useState<HTMLElement | null>(null);
  const getZoom = useStore((state) => () => state.transform[2]); // Get zoom reader function, not the value

  if (!series) return null;

  const displayedTags = isRoot
    ? (series.tags ?? []).slice(0, 4)
    : (newTags?.length > 0 ? newTags : series.tags ?? []);

  // Calculate scale to show card at 500px width when hovered
  // Using stored zoom from when hover started (not subscribed to live zoom changes)
  const targetWidth = 500;
  const targetScale = isHovered ? targetWidth / CARD_W / hoverZoom : 1;

  // Check if series is available on user's preferred services
  const streamingLinks = (series.metadata as any)?.streamingLinks || {};
  const isOnUserService = !userServices || userServices.length === 0 || Object.keys(streamingLinks).some(
    platform => userServices.includes(platform)
  );

  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />}
      <div
        className={`bg-zinc-800 border-2 rounded-lg shadow-lg select-none flex overflow-hidden ${
          isRoot
            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900'
            : 'cursor-pointer hover:ring-2 hover:ring-blue-500/50'
        }`}
        title={!isOnUserService ? 'Not available on your preferred services' : ''}
        style={{
          borderColor: color,
          width: CARD_W,
          minHeight: CARD_H,
          transform: `scale(${targetScale})`,
          transformOrigin: 'center',
          position: 'relative',
          zIndex: isHovered ? 9999 : 1,
          willChange: isHovered ? 'transform' : 'auto',
          opacity: isHovered ? 1 : (!isOnUserService ? 0.4 : 1),
        }}
        onMouseEnter={(e) => {
          // Read current zoom level only when hovering (no subscription = no re-renders during zoom)
          const currentZoom = getZoom();
          setHoverZoom(currentZoom);
          setIsHovered(true);
          // Store reference to parent React Flow node wrapper
          const wrapper = e.currentTarget.closest('.react-flow__node') as HTMLElement;
          setNodeWrapper(wrapper);
          if (wrapper) {
            wrapper.style.zIndex = '9999';
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (nodeWrapper) {
            nodeWrapper.style.zIndex = '';
            setNodeWrapper(null);
          }
        }}
        onClick={() => !isRoot && onSeriesClick?.(series.id)}
      >
        {/* Image on left */}
        {series.titleImage ? (
          <img
            src={series.titleImage}
            alt={series.title}
            className="object-cover flex-shrink-0 self-stretch rounded-l-lg pt-px"
            style={{ width: 110 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex-shrink-0 self-stretch rounded-l-lg pt-px" style={{ width: 12, backgroundColor: color }} />
        )}
        {/* Text on right */}
        <div className="p-2 flex flex-col justify-start overflow-hidden min-w-0">
          {/* Media Type Badge */}
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${
              (series.mediaType || 'ANIME') === 'MANGA'
                ? 'bg-green-600/20 border-green-600/50 text-green-300'
                : 'bg-blue-600/20 border-blue-600/50 text-blue-300'
            }`}>
              {(series.mediaType || 'ANIME') === 'MANGA' ? '📖' : '📺'} {series.mediaType || 'ANIME'}
            </span>
            {/* Manga/Anime metadata */}
            {(() => {
              const metadata = series.metadata as any;
              const chapters = metadata?.chapters;
              const volumes = metadata?.volumes;
              const episodes = metadata?.episodes;
              const mediaType = series.mediaType || 'ANIME';

              if (chapters || volumes || episodes) {
                return (
                  <span className="text-xs text-zinc-400">
                    {mediaType === 'MANGA' ? (
                      <>
                        {chapters && <span>📚 {chapters}ch</span>}
                        {chapters && volumes && <span className="mx-1">•</span>}
                        {volumes && <span>📕 {volumes}vol</span>}
                      </>
                    ) : (
                      <>
                        {episodes && <span>📺 {episodes}ep</span>}
                      </>
                    )}
                  </span>
                );
              }
              return null;
            })()}
          </div>
          <h3 className="text-white font-semibold text-sm line-clamp-3 mb-1 flex items-start gap-1" title={series.title}>
            <span className="flex-1">{series.title}</span>
            {series.isAdult && <span className="text-xs flex-shrink-0" title="Adult content">🔞</span>}
          </h3>
          <div className="flex flex-wrap gap-1">
            {isRoot
              ? displayedTags.map((tag: any) => (
                  <span key={tag.id} className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                    {tag.value}
                  </span>
                ))
              : newTags?.length > 0
              ? displayedTags.map((tag: string, i: number) => (
                  <span key={i} className="text-xs bg-blue-900/40 border border-blue-700 text-blue-300 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))
              : displayedTags.map((tag: any) => (
                  <span key={tag.id} className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                    {tag.value}
                  </span>
                ))
            }
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
});

const nodeTypes = { seriesCard: SeriesCardNode, tagLabel: TagLabelNode };

// Custom edge that routes over the top of multi-column groups.
// All edges from a tag node to its multi-column children share a common horizontal
// routing line above the group, then drop down to their respective columns.
//   data.gapX   — x coordinate of the target column (center of the card)
//   data.routeY — y coordinate to route over (above all cards in the group)
const GapEdge = memo(function GapEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }: EdgeProps) {
  const gapX: number = data?.gapX ?? (sourceX + targetX) / 2;
  const routeY: number = data?.routeY ?? (sourceY + targetY) / 2;
  const r = 6;

  // Path: source → V to routeY (over) → H to gapX (column) → V to targetY (down) → H to target
  const d1 = routeY >= sourceY ? 1 : -1;
  const d2 = targetY >= routeY ? 1 : -1;
  const d = [
    `M ${sourceX},${sourceY}`,
    `V ${routeY - d1 * r}`,
    `Q ${sourceX},${routeY} ${sourceX + r},${routeY}`,
    `H ${gapX - r}`,
    `Q ${gapX},${routeY} ${gapX},${routeY + d2 * r}`,
    `V ${targetY - d2 * r}`,
    `Q ${gapX},${targetY} ${gapX + r},${targetY}`,
    `H ${targetX}`,
  ].join(' ');

  return <path id={id} d={d} className="react-flow__edge-path" style={style} markerEnd={markerEnd} />;
});

const edgeTypes = { gapEdge: GapEdge };

// ---- Tree structure ----

interface TagTree {
  id: string;
  type: 'series' | 'tag';
  isRoot?: boolean;
  series?: SeriesNodeType;
  newTags?: string[];
  label?: string;
  color: string;
  children: TagTree[];
}

function buildTagTree(
  items: Array<{ node: SeriesNodeType; newTags: string[] }>,
  usedTags: string[],
  depth: number,
  maxDepth: number,
  excludeIds: Set<string>
): TagTree[] {
  const filtered = items.filter(i => !excludeIds.has(i.node.series.id));
  if (filtered.length === 0) return [];

  // At max depth, return all as leaf series nodes
  if (depth >= maxDepth) {
    return filtered.map(({ node, newTags }) => ({
      id: node.series.id,
      type: 'series' as const,
      series: node,
      newTags: newTags.slice(0, 4),
      color: hashColor(node.cluster ?? 'default'),
      children: [],
    }));
  }

  // Count how many series have each available new tag (not already used in path)
  const tagCounts = new Map<string, number>();
  filtered.forEach(({ newTags }) => {
    newTags
      .filter(t => !usedTags.includes(t))
      .forEach(t => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1));
  });

  if (tagCounts.size === 0) {
    // No differentiating tags remain — flatten to series
    return filtered.map(({ node, newTags }) => ({
      id: node.series.id,
      type: 'series' as const,
      series: node,
      newTags: newTags.slice(0, 4),
      color: hashColor(node.cluster ?? 'default'),
      children: [],
    }));
  }

  // Each series picks its own first qualifying tag (count >= 2) in AniList relevance order.
  // This respects what each series considers its primary characteristic rather than
  // letting popular groups steal members away from their natural placement.
  const groups = new Map<string, Array<{ node: SeriesNodeType; newTags: string[] }>>();
  const unassigned: Array<{ node: SeriesNodeType; newTags: string[] }> = [];

  const assignItems = (
    items: Array<{ node: SeriesNodeType; newTags: string[] }>,
    counts: Map<string, number>,
    target: Map<string, Array<{ node: SeriesNodeType; newTags: string[] }>>,
    fallback: Array<{ node: SeriesNodeType; newTags: string[] }>
  ) => {
    items.forEach(item => {
      const available = item.newTags.filter(t => !usedTags.includes(t));
      const tag = available.find(t => (counts.get(t) ?? 0) >= 2);
      if (tag) {
        if (!target.has(tag)) target.set(tag, []);
        target.get(tag)!.push(item);
      } else {
        fallback.push(item);
      }
    });
  };

  assignItems(filtered, tagCounts, groups, unassigned);

  // Pull singleton groups out and re-group them among themselves.
  const regroupPool: Array<{ node: SeriesNodeType; newTags: string[] }> = [];
  for (const [tag, items] of [...groups]) {
    if (items.length === 1) {
      regroupPool.push(items[0]);
      groups.delete(tag);
    }
  }
  if (regroupPool.length >= 2) {
    const reTagCounts = new Map<string, number>();
    regroupPool.forEach(({ newTags }) => {
      newTags.filter(t => !usedTags.includes(t))
        .forEach(t => reTagCounts.set(t, (reTagCounts.get(t) ?? 0) + 1));
    });
    assignItems(regroupPool, reTagCounts, groups, unassigned);
  } else {
    unassigned.push(...regroupPool);
  }

  const result: TagTree[] = [];

  // Collect tag nodes, merging duplicates that arise from collapsing intermediate levels
  const tagNodeMap = new Map<string, TagTree>();

  const addTagNode = (label: string, id: string, children: TagTree[]) => {
    const existing = tagNodeMap.get(label);
    if (existing) {
      existing.children.push(...children);
    } else {
      tagNodeMap.set(label, {
        id,
        type: 'tag' as const,
        label,
        color: hashColor(label),
        children,
      });
    }
  };

  // Add tag groups sorted by size (largest first)
  for (const [tag, groupItems] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (groupItems.length === 0) continue;
    const children = buildTagTree(groupItems, [...usedTags, tag], depth + 1, maxDepth, excludeIds);
    // If children are all tag nodes (no direct series), skip this intermediate tag
    // to avoid tag→tag chains with no series between them
    if (children.length > 0 && children.every(c => c.type === 'tag')) {
      for (const child of children) {
        addTagNode(child.label!, child.id, child.children);
      }
    } else {
      addTagNode(tag, `tag:${depth}:${[...usedTags, tag].join('>')}`, children);
    }
  }

  // Try to attach unassigned series to an existing tag node before giving up
  // Compute tag frequencies among orphans so we pick the most-shared tag first
  const orphanTagFreq = new Map<string, number>();
  unassigned.forEach(({ newTags }) => {
    newTags.filter(t => !usedTags.includes(t))
      .forEach(t => orphanTagFreq.set(t, (orphanTagFreq.get(t) ?? 0) + 1));
  });

  unassigned.forEach(({ node, newTags }) => {
    const seriesNode: TagTree = {
      id: node.series.id,
      type: 'series' as const,
      series: node,
      newTags: newTags.slice(0, 4),
      color: hashColor(node.cluster ?? 'default'),
      children: [],
    };
    // Sort remaining tags by how many other orphans share them (ascending count
    // within existing groups first, then most-shared among orphans)
    const remainingTags = newTags
      .filter(t => !usedTags.includes(t))
      .sort((a, b) => (orphanTagFreq.get(b) ?? 0) - (orphanTagFreq.get(a) ?? 0));
    const matchingTag = remainingTags.find(t => tagNodeMap.has(t));
    if (matchingTag) {
      tagNodeMap.get(matchingTag)!.children.push(seriesNode);
    } else if (remainingTags.length > 0) {
      // No existing group matches — create a tag node so nothing floats bare at root
      addTagNode(remainingTags[0], `tag:${depth}:${[...usedTags, remainingTags[0]].join('>')}`, [seriesNode]);
    } else {
      result.push(seriesNode);
    }
  });

  result.push(...tagNodeMap.values());

  return result;
}

// Consolidate singleton tag nodes (tag nodes with only 1 series child) under "other" tags
// Regroup singletons by shared tags first, then put isolated ones into "other"
function consolidateSingletons(node: TagTree): void {
  if (node.type !== 'tag' && !node.isRoot) return;

  // First, recursively process all children
  node.children.forEach(child => consolidateSingletons(child));

  // Find tag children that have exactly 1 series child
  const singletonTags: TagTree[] = [];
  const otherChildren: TagTree[] = [];

  node.children.forEach(child => {
    if (child.type === 'tag' &&
        child.children.length === 1 &&
        child.children[0].type === 'series') {
      singletonTags.push(child);
    } else {
      otherChildren.push(child);
    }
  });

  if (singletonTags.length >= 2) {
    const singletonSeries = singletonTags.map(tag => tag.children[0]);

    // Count how many series share each tag
    const tagCounts = new Map<string, TagTree[]>();
    singletonSeries.forEach(series => {
      (series.newTags ?? []).forEach(tag => {
        if (!tagCounts.has(tag)) tagCounts.set(tag, []);
        tagCounts.get(tag)!.push(series);
      });
    });

    const used = new Set<TagTree>();

    // Merge series into existing tag nodes or create new ones
    // Each series should only be added to ONE tag group
    for (const [tag, seriesList] of tagCounts.entries()) {
      // Filter out series that have already been added to another group
      const availableSeries = seriesList.filter(s => !used.has(s));

      if (availableSeries.length >= 2) {
        const existingTag = otherChildren.find(c => c.type === 'tag' && c.label === tag);
        if (existingTag) {
          existingTag.children.push(...availableSeries);
        } else {
          otherChildren.push({
            id: `${node.id}:regrouped:${tag}`,
            type: 'tag',
            label: tag,
            color: hashColor(tag),
            children: availableSeries,
          });
        }
        availableSeries.forEach(s => used.add(s));
      }
    }

    // Put isolated series into "other"
    const isolated = singletonSeries.filter(s => !used.has(s));
    if (isolated.length >= 2) {
      otherChildren.push({
        id: `${node.id}:other`,
        type: 'tag',
        label: 'other',
        color: '#6b7280',
        children: isolated,
      });
    } else {
      // If only 1 isolated, keep it as the original singleton tag
      isolated.forEach(s => {
        const originalTag = singletonTags.find(tag => tag.children[0] === s);
        if (originalTag) otherChildren.push(originalTag);
      });
    }

    node.children = otherChildren;
  }
}

/**
 * Flatten tag nodes that have only one child which is also a tag node.
 * This prevents unnecessary intermediate levels like: fantasy -> isekai (where fantasy has no series).
 */
function flattenSingleTagChildren(nodes: TagTree[]): TagTree[] {
  return nodes.map(node => {
    // Recursively process children first
    if (node.children.length > 0) {
      node.children = flattenSingleTagChildren(node.children);
    }

    // If this is a tag node with exactly one child that is also a tag node, flatten it
    if (node.type === 'tag' && node.children.length === 1 && node.children[0].type === 'tag') {
      // Skip this node and return its child instead
      return node.children[0];
    }

    return node;
  });
}

// ---- Left-to-right layout (depth = x, siblings stack vertically) ----

// When a tag node has 2+ direct leaf-series children, arrange them in columns
// with max 2 cards per column, extending horizontally as needed.
function hasOnlyLeafSeries(node: TagTree): boolean {
  return node.children.length >= 2 &&
    node.children.every(c => c.type === 'series' && c.children.length === 0);
}

function nodeH(node: TagTree): number {
  if (node.type === 'tag') return TAG_H;
  // Conservative estimate: account for tag wrapping and rendering variations
  const tagCount = node.isRoot
    ? (node.series?.series.tags?.length ?? 0)
    : (node.newTags?.length ?? 0) > 0
      ? node.newTags!.length
      : (node.series?.series.tags?.length ?? 0);
  // Add 10px padding per extra tag row to account for wrapping
  const extraRows = Math.max(0, Math.ceil(tagCount / 2) - 2);
  return CARD_H + extraRows * 34;
}

function subtreeH(node: TagTree): number {
  if (node.children.length === 0) return nodeH(node);
  if (hasOnlyLeafSeries(node)) {
    // Max 2 rows, extending horizontally
    const rows = Math.min(2, node.children.length);
    const maxH = Math.max(...node.children.map(nodeH));
    const clearance = 40; // Space between routing line and cards
    // Height includes clearance above cards, uses CARD_GAP for spacing within group
    return clearance + rows * maxH + (rows - 1) * CARD_GAP;
  }
  const childSum = node.children.reduce((s, c) => s + subtreeH(c), 0);
  return childSum + (node.children.length - 1) * SIBLING_GAP;
}

function layoutTree(
  node: TagTree,
  depth: number,
  startY: number,
  positions: Map<string, { x: number; y: number }>
): void {
  const nh = nodeH(node);
  const sh = subtreeH(node);
  const x = depth * LEVEL_STEP;

  if (node.children.length === 0) {
    positions.set(node.id, { x, y: startY });
  } else if (hasOnlyLeafSeries(node)) {
    // Multi-column layout: tag centered on routing line, children below with clearance
    const tagNodeHeight = nodeH(node);
    const clearance = 40; // Space between routing line and top of cards
    positions.set(node.id, { x, y: startY - tagNodeHeight / 2 });
    const maxH = Math.max(...node.children.map(nodeH));
    node.children.forEach((child, i) => {
      const col = Math.floor(i / 2);  // 2 cards per column
      const row = i % 2;
      positions.set(child.id, {
        x: (depth + 1) * LEVEL_STEP + col * (CARD_W + COL_GAP),
        y: startY + clearance + row * (maxH + CARD_GAP),
      });
    });
  } else {
    // Standard layout: center parent over stacked children
    positions.set(node.id, { x, y: startY + Math.max(0, (sh - nh) / 2) });
    let childY = startY;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];

      layoutTree(child, depth + 1, childY, positions);
      const sh = subtreeH(child);
      childY += sh + SIBLING_GAP;
    }
  }
}

function collectNodesEdges(
  node: TagTree,
  positions: Map<string, { x: number; y: number }>,
  fNodes: Node[],
  fEdges: Edge[],
  onSeriesClick?: (seriesId: string) => void,
  inheritedColor?: string,
  userServices?: string[]
) {
  const pos = positions.get(node.id) ?? { x: 0, y: 0 };
  // Series card borders use the nearest tag ancestor's color so the branch is visually clear
  // Tag nodes always keep their own color
  const displayColor = (node.isRoot || node.type === 'tag') ? node.color : (inheritedColor ?? node.color);

  fNodes.push({
    id: node.id,
    type: node.type === 'tag' ? 'tagLabel' : 'seriesCard',
    position: pos,
    data: {
      series: node.series?.series,
      isRoot: node.isRoot,
      newTags: node.newTags,
      label: node.label,
      color: displayColor,
      userServices,
      onSeriesClick,
    },
  });

  // Edges out of a tag node use the tag's own color; edges out of the root use each child's color
  const edgeColor = node.type === 'tag' ? node.color : undefined;
  const childInheritedColor = node.type === 'tag' ? node.color : inheritedColor;
  const parentPos = positions.get(node.id);
  const isLeafParent = hasOnlyLeafSeries(node);

  // For multi-column leaf layouts, route all edges at the tag level (above cards)
  let overY: number | undefined;
  if (isLeafParent && node.children.length > 0) {
    const firstChildY = Math.min(...node.children.map(c => positions.get(c.id)?.y ?? 0));
    const clearance = 40; // Must match clearance in layoutTree
    overY = firstChildY - clearance; // Route at tag level, above cards
  }

  for (const child of node.children) {
    const c = edgeColor ?? child.color;
    const childPos = positions.get(child.id);

    // Use gapEdge for all children in multi-column layout (routing over the top)
    const useOverRouting = isLeafParent && overY !== undefined && parentPos && childPos;
    // Route to the left of the card so the final segment goes RIGHT into the card (correct arrow direction)
    const colX = useOverRouting ? childPos.x - 30 : undefined;

    fEdges.push({
      id: `${node.id}->${child.id}`,
      source: node.id,
      target: child.id,
      type: useOverRouting ? 'gapEdge' : 'smoothstep',
      data: useOverRouting ? { gapX: colX, routeY: overY } : undefined,
      style: { stroke: c, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: c, width: 16, height: 16 },
    });
    collectNodesEdges(child, positions, fNodes, fEdges, onSeriesClick, childInheritedColor, userServices);
  }
}

// ---- Component ----

interface TreeViewProps {
  relationship: SeriesRelationship;
  requiredTags: Set<string>;
  excludedTags: Set<string>;
  filterMode: 'primary' | 'all';
  rootTags: Set<string>;
  deselectedServices: Set<string>;
  resultsMediaFilter: 'ANIME' | 'MANGA' | 'BOTH';
  userServices: string[];
  onSeriesClick?: (seriesId: string) => void;
}

export function TreeView({ relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter, userServices, onSeriesClick }: TreeViewProps) {
  const treeViewport = useDiscoveryStore(state => state.treeViewport);
  const setTreeViewport = useDiscoveryStore(state => state.setTreeViewport);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    // Check if this is a tag-based search with multiple seed series
    const isTagBasedSearch = relationship.seedSeriesIds && relationship.seedSeriesIds.length > 0;

    // console.log('[TreeView] Rendering tree view', {
    //   isTagBasedSearch,
    //   seedSeriesIds: relationship.seedSeriesIds,
    //   totalNodes: relationship.nodes.length,
    //   rootId: relationship.rootId,
    // });

    const buildMultiRootTree = () => {
      if (!relationship.seedSeriesIds) {
        // console.log('[TreeView] No seedSeriesIds found');
        return { nodes: [], edges: [] };
      }

      // console.log('[TreeView] Building multi-root tree with seeds:', relationship.seedSeriesIds);

      // Get seed series nodes
      // seedSeriesIds now contains the actual database IDs after tracing
      const seedNodes = relationship.seedSeriesIds
        .map(id => {
          const found = relationship.nodes.find(n => n.series.id === id);
          // if (!found) {
          //   console.log('[TreeView] Could not find seed node with ID:', id);
          // }
          return found;
        })
        .filter((n): n is SeriesNodeType => n !== undefined);

      // console.log('[TreeView] Found seed nodes:', seedNodes.length);

      if (seedNodes.length === 0) {
        // console.log('[TreeView] No seed nodes found!');
        return { nodes: [], edges: [] };
      }

      // Collect all seed IDs to exclude from children
      const excludeIds = new Set(seedNodes.map(n => n.series.id));

      // Normalize title for comparison
      const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
      const seedTitlesNorm = new Set(seedNodes.map(n => normalizeTitle(n.series.title)));

      // Collect all tags from seed series to understand what the "root tags" are
      const allSeedTags = new Set<string>();
      seedNodes.forEach(n => {
        n.series.tags.forEach(t => allSeedTags.add(t.value));
      });

      // Get all non-seed nodes that pass filters
      const childItems = relationship.nodes
        .filter(n =>
          !excludeIds.has(n.series.id) &&
          !seedTitlesNorm.has(normalizeTitle(n.series.title))
        )
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
          // Service filter
          if (deselectedServices.size > 0) {
            const streamingLinks = (n.series.metadata as any)?.streamingLinks || {};
            const platforms = Object.keys(streamingLinks);

            if (platforms.length > 0) {
              const hasSelectedPlatform = platforms.some(p => !deselectedServices.has(p));
              if (!hasSelectedPlatform) return false;
            } else {
              if (deselectedServices.has(n.series.provider)) return false;
            }
          }

          // Tag filter
          const tags = n.series.tags.map(t => t.value);

          if (requiredTags.size > 0) {
            const hasRequired = tags.some(t => requiredTags.has(t));
            if (!hasRequired) return false;
          }

          if (excludedTags.size > 0) {
            const hasExcluded = tags.some(t => excludedTags.has(t));
            if (hasExcluded) return false;
          }

          return true;
        })
        .map(node => ({
          node,
          newTags: node.series.tags.map(t => t.value).filter(v => !allSeedTags.has(v)),
        }));

      // console.log('[TreeView] Child items after filtering:', {
      //   total: childItems.length,
      //   beforeFilters: relationship.nodes.length - seedNodes.length,
      // });

      // Build individual trees for each seed series
      const seedTrees: TagTree[] = seedNodes.map((seedNode, idx) => {
        return {
          id: seedNode.series.id,
          type: 'series' as const,
          isRoot: true,
          series: seedNode,
          color: hashColor(seedNode.cluster ?? `seed-${idx}`),
          children: [], // Children will be assigned based on edges below
        };
      });

      // Create a map for quick seed tree lookup
      const seedTreeMap = new Map(seedTrees.map(tree => [tree.id, tree]));

      // Build a full tree structure for each seed by recursively following edges
      const childParentMap = new Map<string, Set<string>>(); // childId -> Set<seedId>
      const _nodeTreeMap = new Map<string, TagTree>(); // nodeId -> TagTree (for lookup)

      // Create edge lookup maps for O(1) access instead of O(n) iteration
      const edgesFrom = new Map<string, string[]>(); // nodeId -> [childIds]
      const edgesTo = new Map<string, string[]>(); // nodeId -> [parentIds]
      relationship.edges.forEach(edge => {
        if (!edgesFrom.has(edge.from)) edgesFrom.set(edge.from, []);
        if (!edgesTo.has(edge.to)) edgesTo.set(edge.to, []);
        edgesFrom.get(edge.from)!.push(edge.to);
        edgesTo.get(edge.to)!.push(edge.from);
      });

      // Helper: Find which seed(s) a node ultimately belongs to
      const findParentSeeds = (nodeId: string, visited = new Set<string>()): Set<string> => {
        if (visited.has(nodeId)) return new Set();
        visited.add(nodeId);

        // If this is a seed itself, return it
        if (seedTreeMap.has(nodeId)) {
          return new Set([nodeId]);
        }

        const seedParents = new Set<string>();
        const parents = edgesTo.get(nodeId) || [];
        parents.forEach(parentId => {
          const parentSeeds = findParentSeeds(parentId, visited);
          parentSeeds.forEach(s => seedParents.add(s));
        });
        return seedParents;
      };

      // Map all children to their parent seeds
      childItems.forEach(({ node }) => {
        const allParents = findParentSeeds(node.series.id);
        childParentMap.set(node.series.id, allParents);
      });

      // Helper: Clone a tree with unique IDs (for multi-parent nodes)
      const cloneTreeWithUniqueIds = (tree: TagTree, prefix: string): TagTree => {
        return {
          ...tree,
          id: `${prefix}::${tree.id}`,
          children: tree.children.map(child => cloneTreeWithUniqueIds(child, prefix)),
        };
      };

      // Helper: Recursively build tree for a node
      const buildNodeTree = (nodeId: string, parentColor: string, visited = new Set<string>()): TagTree | null => {
        if (visited.has(nodeId)) return null;
        visited.add(nodeId);

        // Skip seeds (they're already in seedTrees)
        if (seedTreeMap.has(nodeId)) return null;

        // Find node in the full relationship graph, not just filtered childItems
        const nodeData = relationship.nodes.find(n => n.series.id === nodeId);
        if (!nodeData) return null;

        // Skip if this is a seed (shouldn't happen but safety check)
        if (excludeIds.has(nodeId)) return null;

        // Compute newTags: tags that are not in the seed series tags
        const newTags = nodeData.series.tags
          .map(t => t.value)
          .filter(v => !allSeedTags.has(v))
          .slice(0, 4); // Limit to top 4 tags

        const nodeTree: TagTree = {
          id: nodeId,
          type: 'series',
          series: nodeData,
          newTags,
          color: parentColor,
          children: [],
        };

        // Find direct children of this node using edge lookup map
        const children = edgesFrom.get(nodeId) || [];
        children.forEach(childId => {
          const childTree = buildNodeTree(childId, parentColor, visited);
          if (childTree) {
            nodeTree.children.push(childTree);
          }
        });

        return nodeTree;
      };

      // Build tree for each seed
      seedTrees.forEach(seedTree => {
        const seedId = seedTree.id;
        const seedColor = seedTree.color;
        const visited = new Set<string>([seedId]);

        // Find all direct children of this seed using edge lookup map
        const seedChildren = edgesFrom.get(seedId) || [];
        seedChildren.forEach(childId => {
          const childParents = childParentMap.get(childId);
          // Add if this child belongs to this seed (may also belong to other seeds)
          if (childParents && childParents.has(seedId)) {
            const childTree = buildNodeTree(childId, seedColor, visited);
            if (childTree) {
              // If multi-parent child, clone the entire tree with unique IDs
              if (childParents.size > 1) {
                const uniqueTree = cloneTreeWithUniqueIds(childTree, seedId);
                seedTree.children.push(uniqueTree);
              } else {
                seedTree.children.push(childTree);
              }
            }
          }
        });

        // Count total descendants recursively
        const countDescendants = (tree: TagTree): number => {
          return tree.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
        };
        const _totalDescendants = countDescendants(seedTree);

        // console.log(`[TreeView] Seed "${seedTree.series?.series.title}" has ${seedTree.children.length} direct children, ${_totalDescendants} total descendants`);
      });

      // Debug: Count children by parent count
      const _orphanItems = childItems.filter(({ node }) => {
        const parents = childParentMap.get(node.series.id);
        return !parents || parents.size === 0;
      });
      const _singleParentItems = childItems.filter(({ node }) => {
        const parents = childParentMap.get(node.series.id);
        return parents && parents.size === 1;
      });
      const _multiParentItems = childItems.filter(({ node }) => {
        const parents = childParentMap.get(node.series.id);
        return parents && parents.size > 1;
      });

      // console.log('[TreeView] Child assignment:', {
      //   orphans: orphanItems.length,
      //   singleParent: singleParentItems.length,
      //   multiParent: multiParentItems.length,
      //   total: childItems.length,
      // });

      // Handle orphan items (children with no parent seeds)
      // Add them to a separate group
      const orphanChildren: TagTree[] = [];
      if (orphanItems.length > 0) {
        // console.log('[TreeView] Found orphan children:', orphanItems.map(i => i.node.series.title));

        // Debug: Check if these orphans have ANY edges at all
        // orphanItems.slice(0, 3).forEach(({ node }) => {
        //   const incomingEdges = relationship.edges.filter(e => e.to === node.series.id);
        //   const outgoingEdges = relationship.edges.filter(e => e.from === node.series.id);
        //   console.log(`[TreeView] Orphan "${node.series.title}":`, {
        //     id: node.series.id,
        //     incomingEdges: incomingEdges.length,
        //     outgoingEdges: outgoingEdges.length,
        //     incomingFrom: incomingEdges.map(e => e.from),
        //   });
        // });

        orphanChildren.push({
          id: 'orphans',
          type: 'tag',
          label: 'Other Recommendations',
          color: '#9ca3af',
          children: buildTagTree(orphanItems, [], 1, 2, excludeIds),
        });
      }

      // Multi-parent children are now duplicated under each seed they belong to
      // No need for separate shared tag groups

      // Create a virtual root that contains all seed series
      const virtualRoot: TagTree = {
        id: 'virtual-root',
        type: 'tag',
        label: 'Tag Results',
        color: '#6b7280',
        children: [
          ...seedTrees,
          ...orphanChildren,
        ],
      };

      // Consolidate and flatten
      consolidateSingletons(virtualRoot);
      virtualRoot.children = flattenSingleTagChildren(virtualRoot.children);

      // Layout the tree
      const positions = new Map<string, { x: number; y: number }>();
      layoutTree(virtualRoot, -1, 0, positions); // Start at -1 so seeds are at x=0

      // Collect nodes and edges, but skip the virtual root node itself
      const fNodes: Node[] = [];
      const fEdges: Edge[] = [];

      virtualRoot.children.forEach(child => {
        collectNodesEdges(child, positions, fNodes, fEdges, onSeriesClick, undefined, userServices);
      });

      // console.log('[TreeView] Multi-root tree built:', {
      //   nodes: fNodes.length,
      //   edges: fEdges.length,
      //   virtualRootChildren: virtualRoot.children.length,
      // });

      return { nodes: fNodes, edges: fEdges };
    };

    if (isTagBasedSearch) {
      // Multi-root tree for tag-based searches
      return buildMultiRootTree();
    }

    // Single-root tree for series-based searches
    const rootSeriesNode = relationship.nodes.find(n => n.series.id === relationship.rootId);
    if (!rootSeriesNode) return { nodes: [], edges: [] };

    // Use the resolved ID from the found node as the canonical root ID
    const rootId = rootSeriesNode.series.id;
    const excludeIds = new Set([rootId]);

    // Normalize title for comparison — strips all non-alphanumeric chars to handle
    // unicode apostrophe variants (' vs ') and other encoding differences
    const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rootTitleNorm = normalizeTitle(rootSeriesNode.series.title);
    const childItems = relationship.nodes
      .filter(n =>
        n.series.id !== rootId &&
        normalizeTitle(n.series.title) !== rootTitleNorm
      )
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
      .map(node => ({
        node,
        newTags: node.series.tags.map(t => t.value).filter(v => !rootTags.has(v)),
      }));

    // First level: group children by which of ROOT's own tags they share.
    // Count how many children have each root tag as their PRIMARY tag to order branches by popularity.
    const rootTagCounts = new Map<string, number>();
    childItems.forEach(({ node }) => {
      // Only count the PRIMARY tag (first root-shared tag)
      const primaryTag = node.series.tags
        .map(t => t.value)
        .find(v => rootTags.has(v));

      if (primaryTag) {
        rootTagCounts.set(primaryTag, (rootTagCounts.get(primaryTag) ?? 0) + 1);
      }
    });
    const sortedRootTags = Array.from(rootTagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    const firstLevelGroups = new Map<string, typeof childItems>();
    const noSharedTagItems: typeof childItems = [];
    childItems.forEach(item => {
      // Find the PRIMARY tag (first root-shared tag in the series's tag list)
      const primaryTag = item.node.series.tags
        .map(t => t.value)
        .find(t => rootTags.has(t));

      if (primaryTag) {
        if (!firstLevelGroups.has(primaryTag)) firstLevelGroups.set(primaryTag, []);
        firstLevelGroups.get(primaryTag)!.push(item);
      } else {
        noSharedTagItems.push(item);
      }
    });

    const firstLevelChildren: TagTree[] = [];
    for (const tag of sortedRootTags) {
      const items = firstLevelGroups.get(tag);
      if (!items || items.length === 0) continue;
      firstLevelChildren.push({
        id: `tag:0:${tag}`,
        type: 'tag',
        label: tag,
        color: hashColor(tag),
        children: buildTagTree(items, [tag], 1, 3, excludeIds),
      });
    }
    if (noSharedTagItems.length > 0) {
      firstLevelChildren.push({
        id: 'tag:0:related',
        type: 'tag',
        label: 'related',
        color: '#6b7280',
        children: buildTagTree(noSharedTagItems, [], 1, 3, excludeIds),
      });
    }

    const rootTree: TagTree = {
      id: rootId,
      type: 'series',
      isRoot: true,
      series: rootSeriesNode,
      color: '#3b82f6',
      children: firstLevelChildren,
    };

    // Consolidate singleton tag nodes under "other" tags
    consolidateSingletons(rootTree);

    // Flatten tag nodes that have only one tag child to avoid unnecessary intermediate levels
    rootTree.children = flattenSingleTagChildren(rootTree.children);

    const positions = new Map<string, { x: number; y: number }>();
    layoutTree(rootTree, 0, 0, positions);

    const fNodes: Node[] = [];
    const fEdges: Edge[] = [];
    collectNodesEdges(rootTree, positions, fNodes, fEdges, onSeriesClick, undefined, userServices);

    return { nodes: fNodes, edges: fEdges };
  }, [relationship, requiredTags, excludedTags, filterMode, rootTags, deselectedServices, resultsMediaFilter, userServices, onSeriesClick]);

  return (
    <div className="h-[calc(100vh-200px)] w-full bg-zinc-900 rounded-lg border border-zinc-800">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView={!treeViewport}
        fitViewOptions={{ padding: 0.12, maxZoom: 0.85 }}
        defaultViewport={treeViewport ?? undefined}
        onMove={(_, viewport) => setTreeViewport(viewport)}
        minZoom={0.05}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={16} />
        <Controls className="bg-zinc-800 border border-zinc-700" position="top-left" />
      </ReactFlow>
    </div>
  );
}
