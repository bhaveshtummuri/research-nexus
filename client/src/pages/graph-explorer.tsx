import { Layers, Network, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { NoGraphData, NoResults } from '@/components/common/empty-state';
import { EntityPicker, type PickedEntity } from '@/components/common/entity-picker';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { PanelBoundary } from '@/components/common/route-boundary';
import { EdgeInspector } from '@/components/graph/edge-inspector';
import { GraphCanvas, type SelectedEdge } from '@/components/graph/graph-canvas';
import {
  applyGraphFilters,
  EMPTY_FILTERS,
  GraphControls,
  type GraphFilters,
} from '@/components/graph/graph-controls';
import { GraphLegend } from '@/components/graph/graph-legend';
import type { GraphLayout } from '@/components/graph/layouts';
import { NodeInspector } from '@/components/graph/node-inspector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useGraphExpansion, useGraphSample } from '@/hooks/use-api';
import { notify } from '@/lib/notify';
import { formatNumber, pluralise } from '@/lib/utils';
import type { GraphEdgeView, GraphNodeView, GraphView } from '@/types/api';

const EMPTY_VIEW: GraphView = {
  nodes: [],
  edges: [],
  stats: { nodeCount: 0, edgeCount: 0, truncated: false, labelCounts: [], relationshipCounts: [] },
};

/** A neighbourhood the user expanded, kept separate so it can be collapsed. */
interface Expansion {
  id: string;
  name: string;
  view: GraphView;
}

/**
 * Interactive graph explorer.
 *
 * The view is a merge of a base sample plus a stack of expansions, each kept
 * under the node that produced it. Holding expansions separately rather than
 * flattening everything into one accumulated blob is what makes collapse
 * possible: removing an expansion and re-merging restores exactly the graph
 * that existed before it, with no bookkeeping about which node came from where.
 * The merge deduplicates on element id, so a node reached twice is drawn once.
 */
export function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [focus, setFocus] = useState<PickedEntity | null>(null);
  const [depth, setDepth] = useState(1);
  const [limit, setLimit] = useState(80);
  const [layout, setLayout] = useState<GraphLayout>('force');
  const [filters, setFilters] = useState<GraphFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<GraphNodeView | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [expansions, setExpansions] = useState<Expansion[]>([]);

  const sample = useGraphSample({ limit });
  const expansion = useGraphExpansion({ id: focusId ?? '', depth, limit }, Boolean(focusId));

  const activeQuery = focusId ? expansion : sample;

  // Record each completed expansion under the node that produced it.
  useEffect(() => {
    if (!focusId || !expansion.data) return;
    setExpansions((current) => {
      if (current.some((entry) => entry.id === focusId)) return current;
      const root = expansion.data.nodes.find((node) => node.id === focusId);
      return [...current, { id: focusId, name: root?.name ?? focusId, view: expansion.data }];
    });
  }, [focusId, expansion.data]);

  const baseView = sample.data ?? EMPTY_VIEW;

  const mergedView = useMemo(() => {
    // With no expansions the sample stands alone; otherwise every expansion is
    // layered onto it in the order the user opened them.
    if (expansions.length === 0) return focusId ? (expansion.data ?? EMPTY_VIEW) : baseView;
    return expansions.reduce(
      (accumulated, entry) => mergeViews(accumulated, entry.view),
      focusId ? EMPTY_VIEW : baseView,
    );
  }, [expansions, baseView, focusId, expansion.data]);

  const view = useMemo(() => applyGraphFilters(mergedView, filters), [mergedView, filters]);

  /**
   * Reports a completed load, and warns when the result was capped.
   *
   * Truncation is the one that matters: a graph silently cut to the node budget
   * looks like a complete answer, and a user drawing conclusions from a partial
   * neighbourhood has no way to tell. The ref keeps this to one message per
   * distinct result rather than one per render.
   */
  const announcedRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeQuery.isLoading || !activeQuery.data) return;

    const signature = `${focusId ?? 'sample'}:${mergedView.stats.nodeCount}:${mergedView.stats.edgeCount}`;
    if (announcedRef.current === signature) return;
    announcedRef.current = signature;

    const { nodeCount, edgeCount, truncated } = mergedView.stats;
    if (truncated) {
      notify.warning('Graph truncated to the node budget', {
        id: 'graph-truncated',
        description: `Showing ${formatNumber(nodeCount)} of a larger neighbourhood. Reduce the depth for a complete view.`,
      });
    } else {
      notify.info('Graph loaded', {
        id: 'graph-loaded',
        description: `${formatNumber(nodeCount)} ${pluralise(nodeCount, 'node')} and ${formatNumber(edgeCount)} ${pluralise(edgeCount, 'relationship')}.`,
      });
    }
  }, [activeQuery.isLoading, activeQuery.data, focusId, mergedView.stats]);

  const setFocusId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set('focus', id);
      else next.delete('focus');
      setSearchParams(next, { replace: true });
      setSelected(null);
      setSelectedEdge(null);
      if (!id) setExpansions([]);
    },
    [searchParams, setSearchParams],
  );

  const handleExpand = useCallback(
    (node: GraphNodeView) => {
      if (expansions.some((entry) => entry.id === node.id)) {
        notify.info(`${node.name} is already expanded`);
        return;
      }
      setFocusId(node.id);
      notify.success(`Expanding ${node.name}`, {
        description: `Fetching neighbours within ${depth} ${pluralise(depth, 'hop')}.`,
      });
    },
    [depth, expansions, setFocusId],
  );

  /**
   * Collapse drops one expansion and re-merges the rest.
   *
   * Nodes shared with another expansion survive, because they are still present
   * in that expansion's own view — no reference counting required.
   */
  const handleCollapse = useCallback(
    (id: string) => {
      setExpansions((current) => current.filter((entry) => entry.id !== id));
      setSelected(null);
      setSelectedEdge(null);
      if (focusId === id) {
        const next = new URLSearchParams(searchParams);
        next.delete('focus');
        setSearchParams(next, { replace: true });
      }
    },
    [focusId, searchParams, setSearchParams],
  );

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setLayout('force');
    setExpansions([]);
    setSelected(null);
    setSelectedEdge(null);
    setFocusId(null);
  }, [setFocusId]);

  const hiddenCount = mergedView.nodes.length - view.nodes.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <Network className="size-2.5" aria-hidden />
            Live traversal
          </Badge>
        }
        title="Graph explorer"
        description="Every node and edge here comes from a bounded Cypher traversal. Click to inspect, click an edge to read the relationship, double-click to expand a neighbourhood."
        actions={
          focusId || expansions.length > 0 ? (
            <Button variant="secondary" onClick={() => setFocusId(null)}>
              Reset to overview
            </Button>
          ) : null
        }
      />

      <div className="surface-gradient flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-end">
        <EntityPicker
          label="Focus entity"
          value={focus}
          onChange={(entity) => {
            setFocus(entity);
            setExpansions([]);
            setFocusId(entity?.id ?? null);
          }}
          placeholder="Search for an author, paper, topic or institution…"
          className="flex-1"
        />

        <div className="space-y-1.5 lg:w-40">
          <label
            htmlFor="graph-budget"
            className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Node budget
          </label>
          <Select
            id="graph-budget"
            value={String(limit)}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value="50">50 nodes</option>
            <option value="80">80 nodes</option>
            <option value="150">150 nodes</option>
            <option value="250">250 nodes</option>
          </Select>
        </div>
      </div>

      <GraphControls
        view={mergedView}
        filters={filters}
        onFiltersChange={setFilters}
        layout={layout}
        onLayoutChange={setLayout}
        depth={depth}
        onDepthChange={setDepth}
        onReset={handleReset}
      />

      {expansions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            <Layers className="size-3" aria-hidden />
            Expanded
          </span>
          {expansions.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleCollapse(entry.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-2xs transition-colors hover:border-destructive/40 hover:text-destructive"
              aria-label={`Collapse ${entry.name}`}
            >
              {entry.name}
              <X className="size-2.5" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}

      {activeQuery.isError ? (
        <ErrorState error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {/* The canvas is the one surface here doing enough per frame — layout
                maths, hit-testing, imperative drawing — to be worth isolating.
                A failure inside it costs the canvas, not the controls and
                inspectors the user needs to recover. */}
            <PanelBoundary
              title="The canvas stopped rendering"
              description="Something went wrong drawing this graph. Rebuilding usually clears it; a smaller depth or a narrower filter avoids it entirely."
              resetKey={`${focusId ?? 'sample'}:${layout}`}
            >
              <GraphCanvas
                nodes={view.nodes}
                edges={view.edges}
                selectedElementId={selected?.elementId ?? null}
                selectedEdgeId={selectedEdge?.elementId ?? null}
                onSelect={(node) => {
                  setSelected(node);
                  if (node) setSelectedEdge(null);
                }}
                onSelectEdge={(edge) => {
                  setSelectedEdge(edge);
                  if (edge) setSelected(null);
                }}
                onExpand={handleExpand}
                layout={layout}
                isLoading={activeQuery.isLoading}
                height={620}
              />
            </PanelBoundary>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <GraphLegend stats={view.stats} />
              <p className="text-2xs text-muted-foreground">
                {formatNumber(view.nodes.length)} nodes · {formatNumber(view.edges.length)}{' '}
                relationships
                {hiddenCount > 0 ? ` · ${formatNumber(hiddenCount)} hidden by filters` : ''}
                {mergedView.stats.truncated ? ' · truncated to the node budget' : ''}
              </p>
            </div>

            {view.nodes.length === 0 && !activeQuery.isLoading ? (
              hiddenCount > 0 ? (
                <NoResults entity="nodes" onClear={() => setFilters(EMPTY_FILTERS)} />
              ) : (
                <NoGraphData onLoad={() => setFocusId(null)} />
              )
            ) : null}
          </div>

          {/* One panel slot: an edge selection replaces the node inspector
              rather than stacking, so the sidebar never scrolls to two panels. */}
          {selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              onSelectNode={(node) => {
                setSelectedEdge(null);
                setSelected(node);
              }}
            />
          ) : (
            <NodeInspector node={selected} onExpand={handleExpand} />
          )}
        </div>
      )}

      {!focusId && expansions.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          Showing the most connected entities across the graph. Pick a focus entity above to explore
          a specific neighbourhood.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Merges two views, deduplicating on element id.
 *
 * Element ids are stable per node, so a node reached from two different
 * expansions appears once rather than twice at different coordinates. Edges are
 * dropped when either endpoint is absent, which keeps the result renderable.
 */
export function mergeViews(current: GraphView, incoming: GraphView): GraphView {
  const nodes = new Map<string, GraphNodeView>();
  for (const node of [...current.nodes, ...incoming.nodes]) nodes.set(node.elementId, node);

  const edges = new Map<string, GraphEdgeView>();
  for (const edge of [...current.edges, ...incoming.edges]) edges.set(edge.elementId, edge);

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()].filter(
    (edge) => nodes.has(edge.source) && nodes.has(edge.target),
  );

  const labelCounts = new Map<string, number>();
  for (const node of nodeList) labelCounts.set(node.label, (labelCounts.get(node.label) ?? 0) + 1);

  const relationshipCounts = new Map<string, number>();
  for (const edge of edgeList) {
    relationshipCounts.set(edge.type, (relationshipCounts.get(edge.type) ?? 0) + 1);
  }

  return {
    nodes: nodeList,
    edges: edgeList,
    stats: {
      nodeCount: nodeList.length,
      edgeCount: edgeList.length,
      truncated: current.stats.truncated || incoming.stats.truncated,
      labelCounts: [...labelCounts.entries()]
        .map(([label, count]) => ({ label, count }) as GraphView['stats']['labelCounts'][number])
        .sort((a, b) => b.count - a.count),
      relationshipCounts: [...relationshipCounts.entries()]
        .map(
          ([type, count]) => ({ type, count }) as GraphView['stats']['relationshipCounts'][number],
        )
        .sort((a, b) => b.count - a.count),
    },
  };
}
