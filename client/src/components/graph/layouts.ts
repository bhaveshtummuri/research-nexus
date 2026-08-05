import type { GraphEdgeView } from '@/types/api';

import type { LayoutNode } from './use-force-layout';

export const GRAPH_LAYOUTS = ['force', 'hierarchical', 'radial', 'circular', 'grid'] as const;
export type GraphLayout = (typeof GRAPH_LAYOUTS)[number];

export const LAYOUT_LABELS: Record<GraphLayout, string> = {
  force: 'Force-directed',
  hierarchical: 'Hierarchical',
  radial: 'Radial',
  circular: 'Circular',
  grid: 'Grid',
};

export const LAYOUT_HINTS: Record<GraphLayout, string> = {
  force: 'Clusters emerge from the data — the best default for spotting communities.',
  hierarchical: 'Layers by hop distance from the busiest node. Good for citation and funding chains.',
  radial: 'Concentric rings by hop distance, so degrees of separation are readable at a glance.',
  circular: 'Every node on one ring, grouped by entity type. Makes cross-type density obvious.',
  grid: 'Even rows and columns. Useful for scanning a set rather than reading its structure.',
};

export interface LayoutBounds {
  width: number;
  height: number;
}

/**
 * Adjacency in both directions.
 *
 * Every static layout needs to walk the graph regardless of edge direction —
 * a citation chain is just as much a hierarchy read upward as downward — so the
 * list is built undirected once and shared.
 */
function buildAdjacency(nodes: LayoutNode[], edges: GraphEdgeView[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.elementId, []);

  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }

  return adjacency;
}

/**
 * Groups nodes by hop distance from a root, via breadth-first search.
 *
 * Disconnected components would otherwise be dropped entirely, so anything the
 * search never reaches is appended as one final layer rather than left at the
 * origin — a node the layout cannot place is still a node the user must see.
 */
function layersFrom(
  nodes: LayoutNode[],
  edges: GraphEdgeView[],
  rootId: string,
): LayoutNode[][] {
  const adjacency = buildAdjacency(nodes, edges);
  const byId = new Map(nodes.map((node) => [node.elementId, node]));

  const layers: LayoutNode[][] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const layer = frontier
      .map((id) => byId.get(id))
      .filter((node): node is LayoutNode => node !== undefined);
    if (layer.length > 0) layers.push(layer);

    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }

  const unreached = nodes.filter((node) => !seen.has(node.elementId));
  if (unreached.length > 0) layers.push(unreached);

  return layers;
}

/** The natural root for a rooted layout: the most connected node present. */
function pickRoot(nodes: LayoutNode[], preferredId?: string | null): LayoutNode | undefined {
  if (preferredId) {
    const preferred = nodes.find((node) => node.elementId === preferredId);
    if (preferred) return preferred;
  }
  return nodes.reduce<LayoutNode | undefined>(
    (best, node) => (best === undefined || node.degree > best.degree ? node : best),
    undefined,
  );
}

/** Stable ordering so a re-layout does not shuffle nodes between positions. */
function sortForDisplay(nodes: LayoutNode[]): LayoutNode[] {
  return [...nodes].sort(
    (a, b) => a.label.localeCompare(b.label) || b.degree - a.degree || a.id.localeCompare(b.id),
  );
}

/**
 * Every node on one ring, grouped by entity type.
 *
 * Type grouping is what makes this layout worth having: edges that cross the
 * circle are cross-type relationships, so the density of chords through the
 * middle is a direct read on how interconnected the entity types are.
 */
function circularLayout(nodes: LayoutNode[], { width, height }: LayoutBounds): void {
  const ordered = sortForDisplay(nodes);
  const radius = Math.max(Math.min(width, height) / 2 - 60, 40);
  const centerX = width / 2;
  const centerY = height / 2;

  ordered.forEach((node, index) => {
    const angle = (index / ordered.length) * Math.PI * 2 - Math.PI / 2;
    node.x = centerX + Math.cos(angle) * radius;
    node.y = centerY + Math.sin(angle) * radius;
  });
}

/**
 * Concentric rings by hop distance from the root.
 *
 * Ring N holds everything exactly N hops away, so degrees of separation become
 * a spatial property the eye can read without following a single edge.
 */
function radialLayout(
  nodes: LayoutNode[],
  edges: GraphEdgeView[],
  { width, height }: LayoutBounds,
  rootId?: string | null,
): void {
  const root = pickRoot(nodes, rootId);
  if (!root) return;

  const layers = layersFrom(nodes, edges, root.elementId);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.max(Math.min(width, height) / 2 - 50, 60);
  const step = layers.length > 1 ? maxRadius / (layers.length - 1) : 0;

  layers.forEach((layer, depth) => {
    if (depth === 0) {
      const [center] = layer;
      if (center) {
        center.x = centerX;
        center.y = centerY;
      }
      return;
    }

    const radius = step * depth;
    const ordered = sortForDisplay(layer);
    ordered.forEach((node, index) => {
      // Offsetting alternate rings keeps nodes from lining up radially and
      // occluding each other on the spokes.
      const offset = depth % 2 === 0 ? 0 : Math.PI / ordered.length;
      const angle = (index / ordered.length) * Math.PI * 2 + offset;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  });
}

/** Top-down layers by hop distance, each layer laid out as a centred row. */
function hierarchicalLayout(
  nodes: LayoutNode[],
  edges: GraphEdgeView[],
  { width, height }: LayoutBounds,
  rootId?: string | null,
): void {
  const root = pickRoot(nodes, rootId);
  if (!root) return;

  const layers = layersFrom(nodes, edges, root.elementId);
  const marginY = 56;
  const usableHeight = Math.max(height - marginY * 2, 1);
  const rowStep = layers.length > 1 ? usableHeight / (layers.length - 1) : 0;

  layers.forEach((layer, depth) => {
    const ordered = sortForDisplay(layer);
    const y = layers.length === 1 ? height / 2 : marginY + rowStep * depth;

    // Wide layers are allowed to overflow the viewport rather than being
    // squeezed until nodes overlap; panning is cheaper than illegibility.
    const spacing = Math.max(width / (ordered.length + 1), 34);
    const rowWidth = spacing * (ordered.length - 1);
    const startX = width / 2 - rowWidth / 2;

    ordered.forEach((node, index) => {
      node.x = startX + spacing * index;
      node.y = y;
    });
  });
}

/** Even rows and columns, ordered by type then degree. */
function gridLayout(nodes: LayoutNode[], { width, height }: LayoutBounds): void {
  const ordered = sortForDisplay(nodes);
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length * (width / Math.max(height, 1)))));
  const rows = Math.ceil(ordered.length / columns);

  const cellWidth = width / (columns + 1);
  const cellHeight = height / (rows + 1);

  ordered.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    node.x = cellWidth * (column + 1);
    node.y = cellHeight * (row + 1);
  });
}

/**
 * Applies a static layout, writing positions directly onto the layout nodes.
 *
 * Positions are pinned with `fx`/`fy` rather than only `x`/`y`: the d3
 * simulation stays alive so nodes remain draggable, and pinning is what stops
 * its forces from pulling everything back into a force layout on the next tick.
 * `force` is the one mode that clears the pins and hands control back.
 */
export function applyLayout(
  layout: GraphLayout,
  nodes: LayoutNode[],
  edges: GraphEdgeView[],
  bounds: LayoutBounds,
  rootId?: string | null,
): void {
  if (nodes.length === 0 || bounds.width === 0 || bounds.height === 0) return;

  if (layout === 'force') {
    for (const node of nodes) {
      node.fx = null;
      node.fy = null;
    }
    return;
  }

  switch (layout) {
    case 'circular':
      circularLayout(nodes, bounds);
      break;
    case 'radial':
      radialLayout(nodes, edges, bounds, rootId);
      break;
    case 'hierarchical':
      hierarchicalLayout(nodes, edges, bounds, rootId);
      break;
    case 'grid':
      gridLayout(nodes, bounds);
      break;
  }

  for (const node of nodes) {
    node.fx = node.x ?? null;
    node.fy = node.y ?? null;
  }
}
