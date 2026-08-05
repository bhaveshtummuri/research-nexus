import { describe, expect, it } from 'vitest';

import { applyGraphFilters, EMPTY_FILTERS } from '@/components/graph/graph-controls';
import { applyLayout, GRAPH_LAYOUTS } from '@/components/graph/layouts';
import {
  distanceToSegmentSquared,
  isPointVisible,
  isSegmentVisible,
  NODE_SHAPES,
  visibleBounds,
} from '@/components/graph/node-shapes';
import { mergeViews } from '@/pages/graph-explorer';
import { NODE_LABELS, type GraphEdgeView, type GraphNodeView, type GraphView } from '@/types/api';
import type { LayoutNode } from '@/components/graph/use-force-layout';

const BOUNDS = { width: 800, height: 600 };

function node(id: string, label: GraphNodeView['label'] = 'Author', degree = 1): LayoutNode {
  return {
    elementId: `e-${id}`,
    id,
    label,
    name: id,
    caption: '',
    degree,
    properties: {},
    radius: 8,
  };
}

function edge(source: string, target: string, type: GraphEdgeView['type'] = 'AUTHORED'): GraphEdgeView {
  return {
    elementId: `edge-${source}-${target}`,
    type,
    source: `e-${source}`,
    target: `e-${target}`,
    properties: {},
  };
}

function view(nodes: GraphNodeView[], edges: GraphEdgeView[]): GraphView {
  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      truncated: false,
      labelCounts: [],
      relationshipCounts: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

describe('applyLayout', () => {
  it('positions every node for every static layout', () => {
    for (const layout of GRAPH_LAYOUTS) {
      if (layout === 'force') continue;

      const nodes = [node('a', 'Author', 3), node('b', 'Paper'), node('c', 'ResearchTopic')];
      applyLayout(layout, nodes, [edge('a', 'b'), edge('b', 'c')], BOUNDS);

      for (const entry of nodes) {
        expect(Number.isFinite(entry.x), `${layout} left ${entry.id} without an x`).toBe(true);
        expect(Number.isFinite(entry.y), `${layout} left ${entry.id} without a y`).toBe(true);
        // Static layouts must pin, or the simulation drags everything back into
        // a force arrangement on the next tick.
        expect(entry.fx, `${layout} did not pin ${entry.id}`).toBe(entry.x);
        expect(entry.fy).toBe(entry.y);
      }
    }
  });

  it('releases pins for the force layout so the simulation regains control', () => {
    const nodes = [node('a'), node('b')];
    applyLayout('circular', nodes, [], BOUNDS);
    expect(nodes[0]?.fx).not.toBeNull();

    applyLayout('force', nodes, [], BOUNDS);
    expect(nodes[0]?.fx).toBeNull();
    expect(nodes[0]?.fy).toBeNull();
  });

  it('places disconnected nodes rather than leaving them at the origin', () => {
    // BFS never reaches an isolated node; dropping it would hide real data.
    const nodes = [node('hub', 'Author', 5), node('leaf'), node('orphan')];
    applyLayout('radial', nodes, [edge('hub', 'leaf')], BOUNDS);

    const orphan = nodes.find((entry) => entry.id === 'orphan');
    expect(Number.isFinite(orphan?.x)).toBe(true);
    expect(orphan?.x).not.toBe(0);
  });

  it('puts the most connected node at the centre of a radial layout', () => {
    const nodes = [node('spoke1'), node('hub', 'Author', 9), node('spoke2')];
    applyLayout('radial', nodes, [edge('hub', 'spoke1'), edge('hub', 'spoke2')], BOUNDS);

    const hub = nodes.find((entry) => entry.id === 'hub');
    expect(hub?.x).toBeCloseTo(BOUNDS.width / 2);
    expect(hub?.y).toBeCloseTo(BOUNDS.height / 2);
  });

  it('layers a hierarchical layout by hop distance', () => {
    const nodes = [node('root', 'Author', 4), node('child'), node('grandchild')];
    applyLayout(
      'hierarchical',
      nodes,
      [edge('root', 'child'), edge('child', 'grandchild')],
      BOUNDS,
    );

    const [root, child, grandchild] = nodes;
    // Each layer sits strictly below the one before it.
    expect(root?.y).toBeLessThan(child?.y ?? 0);
    expect(child?.y).toBeLessThan(grandchild?.y ?? 0);
  });

  it('honours an explicit root over the highest-degree node', () => {
    const nodes = [node('hub', 'Author', 9), node('chosen', 'Author', 1)];
    applyLayout('radial', nodes, [edge('hub', 'chosen')], BOUNDS, 'e-chosen');

    const chosen = nodes.find((entry) => entry.id === 'chosen');
    expect(chosen?.x).toBeCloseTo(BOUNDS.width / 2);
  });

  it('does nothing when there is no space to lay out into', () => {
    const nodes = [node('a')];
    applyLayout('grid', nodes, [], { width: 0, height: 0 });
    expect(nodes[0]?.fx).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('applyGraphFilters', () => {
  const source = view(
    [node('a', 'Author'), node('p', 'Paper'), node('t', 'ResearchTopic'), node('lonely', 'Author')],
    [edge('a', 'p', 'AUTHORED'), edge('p', 't', 'HAS_TOPIC')],
  );

  it('returns everything when no filter is set', () => {
    const result = applyGraphFilters(source, EMPTY_FILTERS);
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(2);
  });

  it('drops edges whose endpoint was filtered out', () => {
    // A dangling edge would reference a node the renderer cannot resolve.
    const result = applyGraphFilters(source, {
      ...EMPTY_FILTERS,
      nodeLabels: new Set(['Author', 'Paper']),
    });

    expect(result.nodes.map((entry) => entry.id).sort()).toEqual(['a', 'lonely', 'p']);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.type).toBe('AUTHORED');
  });

  it('filters by relationship type without removing nodes', () => {
    const result = applyGraphFilters(source, {
      ...EMPTY_FILTERS,
      relationshipTypes: new Set(['HAS_TOPIC']),
    });

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(1);
  });

  it('matches the node search case-insensitively', () => {
    const result = applyGraphFilters(source, { ...EMPTY_FILTERS, query: 'LONELY' });
    expect(result.nodes.map((entry) => entry.id)).toEqual(['lonely']);
  });

  it('hides isolated nodes only after other filters have run', () => {
    // `lonely` starts isolated; `t` becomes isolated once HAS_TOPIC is excluded.
    const result = applyGraphFilters(source, {
      ...EMPTY_FILTERS,
      relationshipTypes: new Set(['AUTHORED']),
      hideIsolated: true,
    });

    expect(result.nodes.map((entry) => entry.id).sort()).toEqual(['a', 'p']);
  });
});

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

describe('distanceToSegmentSquared', () => {
  it('is zero on the segment', () => {
    expect(distanceToSegmentSquared(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it('measures perpendicular distance from the middle', () => {
    expect(distanceToSegmentSquared(5, 3, 0, 0, 10, 0)).toBe(9);
  });

  it('clamps past the endpoints rather than extending the line', () => {
    // Without clamping this would report 0: the point is on the infinite line.
    expect(distanceToSegmentSquared(20, 0, 0, 0, 10, 0)).toBe(100);
  });

  it('handles a degenerate segment', () => {
    expect(distanceToSegmentSquared(3, 4, 0, 0, 0, 0)).toBe(25);
  });
});

describe('viewport culling', () => {
  const bounds = visibleBounds(800, 600, 1, 0, 0, 0);

  it('keeps points inside the viewport', () => {
    expect(isPointVisible(400, 300, bounds)).toBe(true);
  });

  it('rejects points outside it', () => {
    expect(isPointVisible(-50, 300, bounds)).toBe(false);
    expect(isPointVisible(400, 900, bounds)).toBe(false);
  });

  it('accounts for pan and zoom', () => {
    // Zoomed to 2x and panned, graph-space coverage halves.
    const zoomed = visibleBounds(800, 600, 2, -400, 0, 0);
    expect(zoomed.minX).toBe(200);
    expect(zoomed.maxX).toBe(600);
  });

  it('keeps a segment that crosses the viewport even when both ends are outside', () => {
    expect(isSegmentVisible(-100, 300, 900, 300, bounds)).toBe(true);
  });

  it('rejects a segment entirely to one side', () => {
    expect(isSegmentVisible(-300, 10, -100, 20, bounds)).toBe(false);
  });
});

describe('NODE_SHAPES', () => {
  it('assigns a shape to every node label', () => {
    // Colour alone is not an accessible encoding; a missing shape would fall
    // back to a circle and silently collide with Author.
    for (const label of NODE_LABELS) {
      expect(NODE_SHAPES[label], `${label} has no shape`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Expansion merging
// ---------------------------------------------------------------------------

describe('mergeViews', () => {
  it('deduplicates nodes reached from two expansions', () => {
    const first = view([node('a'), node('shared')], [edge('a', 'shared')]);
    const second = view([node('b'), node('shared')], [edge('b', 'shared')]);

    const merged = mergeViews(first, second);
    expect(merged.nodes).toHaveLength(3);
    expect(merged.edges).toHaveLength(2);
  });

  it('drops edges left dangling by the merge', () => {
    const first = view([node('a')], []);
    const second = view([node('b')], [edge('b', 'missing')]);

    expect(mergeViews(first, second).edges).toHaveLength(0);
  });

  it('recomputes label and relationship counts', () => {
    const merged = mergeViews(
      view([node('a', 'Author')], []),
      view([node('p', 'Paper'), node('a', 'Author')], [edge('a', 'p')]),
    );

    expect(merged.stats.nodeCount).toBe(2);
    expect(merged.stats.labelCounts).toHaveLength(2);
    expect(merged.stats.relationshipCounts[0]?.count).toBe(1);
  });
});
