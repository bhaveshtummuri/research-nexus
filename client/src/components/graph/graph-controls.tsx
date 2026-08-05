import { Eraser, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn, LABEL_STYLES, RELATIONSHIP_LABELS } from '@/lib/utils';
import type { GraphView, NodeLabel, RelationshipType } from '@/types/api';

import { GRAPH_LAYOUTS, LAYOUT_HINTS, LAYOUT_LABELS, type GraphLayout } from './layouts';

export interface GraphFilters {
  query: string;
  nodeLabels: Set<NodeLabel>;
  relationshipTypes: Set<RelationshipType>;
  hideIsolated: boolean;
}

export const EMPTY_FILTERS: GraphFilters = {
  query: '',
  nodeLabels: new Set(),
  relationshipTypes: new Set(),
  hideIsolated: false,
};

/**
 * Applies the filter set to a graph view.
 *
 * Order matters. Node filters run first, then edges are dropped if either
 * endpoint has gone — an edge to a hidden node would otherwise dangle. Only
 * then can isolation be judged, because removing nodes is what makes their
 * former neighbours isolated in the first place.
 *
 * Pure and exported so the behaviour can be tested without a canvas.
 */
export function applyGraphFilters(view: GraphView, filters: GraphFilters): GraphView {
  const query = filters.query.trim().toLowerCase();

  let nodes = view.nodes.filter((node) => {
    if (filters.nodeLabels.size > 0 && !filters.nodeLabels.has(node.label)) return false;
    if (query && !node.name.toLowerCase().includes(query)) return false;
    return true;
  });

  const keptIds = new Set(nodes.map((node) => node.elementId));

  const edges = view.edges.filter((edge) => {
    if (!keptIds.has(edge.source) || !keptIds.has(edge.target)) return false;
    if (filters.relationshipTypes.size > 0 && !filters.relationshipTypes.has(edge.type)) {
      return false;
    }
    return true;
  });

  if (filters.hideIsolated) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    nodes = nodes.filter((node) => connected.has(node.elementId));
  }

  return { nodes, edges, stats: view.stats };
}

interface GraphControlsProps {
  view: GraphView;
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  layout: GraphLayout;
  onLayoutChange: (layout: GraphLayout) => void;
  depth: number;
  onDepthChange: (depth: number) => void;
  onReset: () => void;
}

/**
 * The control surface for the explorer.
 *
 * Filter options are derived from the loaded graph rather than from the full
 * schema, so the panel never offers a type that would return nothing — the list
 * shrinks as the user narrows the view, which is itself information.
 */
export function GraphControls({
  view,
  filters,
  onFiltersChange,
  layout,
  onLayoutChange,
  depth,
  onDepthChange,
  onReset,
}: GraphControlsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const presentLabels = useMemo(() => {
    const counts = new Map<NodeLabel, number>();
    for (const node of view.nodes) counts.set(node.label, (counts.get(node.label) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [view.nodes]);

  const presentTypes = useMemo(() => {
    const counts = new Map<RelationshipType, number>();
    for (const edge of view.edges) counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [view.edges]);

  const activeFilterCount =
    filters.nodeLabels.size +
    filters.relationshipTypes.size +
    (filters.hideIsolated ? 1 : 0) +
    (filters.query ? 1 : 0);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className="surface-gradient space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="graph-node-search"
            className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Find a node
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="graph-node-search"
              value={filters.query}
              onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
              placeholder="Filter visible nodes by name…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5 lg:w-48">
          <label
            htmlFor="graph-layout"
            className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Layout
          </label>
          <Select
            id="graph-layout"
            value={layout}
            onChange={(event) => onLayoutChange(event.target.value as GraphLayout)}
          >
            {GRAPH_LAYOUTS.map((value) => (
              <option key={value} value={value}>
                {LAYOUT_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5 lg:w-44">
          <label
            htmlFor="graph-depth"
            className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Expansion depth · {depth}
          </label>
          <input
            id="graph-depth"
            type="range"
            min={1}
            max={3}
            step={1}
            value={depth}
            onChange={(event) => onDepthChange(Number(event.target.value))}
            className="h-9 w-full accent-primary"
            aria-valuetext={`${depth} hop${depth === 1 ? '' : 's'}`}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
          >
            <Filter className="size-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <Badge variant="primary" className="ml-1 tabular-nums">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <Eraser className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground">
        <SlidersHorizontal className="mr-1 inline size-3" aria-hidden />
        {LAYOUT_HINTS[layout]}
      </p>

      {showFilters ? (
        <div className="space-y-3 border-t border-border pt-3">
          <FilterGroup title="Entity types">
            {presentLabels.map(([label, count]) => {
              const active = filters.nodeLabels.has(label);
              return (
                <FilterChip
                  key={label}
                  active={active}
                  onClick={() =>
                    onFiltersChange({ ...filters, nodeLabels: toggle(filters.nodeLabels, label) })
                  }
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: LABEL_STYLES[label]?.color }}
                    aria-hidden
                  />
                  {LABEL_STYLES[label]?.name ?? label}
                  <span className="tabular-nums opacity-60">{count}</span>
                </FilterChip>
              );
            })}
          </FilterGroup>

          <FilterGroup title="Relationship types">
            {presentTypes.map(([type, count]) => (
              <FilterChip
                key={type}
                active={filters.relationshipTypes.has(type)}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    relationshipTypes: toggle(filters.relationshipTypes, type),
                  })
                }
              >
                {RELATIONSHIP_LABELS[type] ?? type}
                <span className="tabular-nums opacity-60">{count}</span>
              </FilterChip>
            ))}
          </FilterGroup>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={filters.hideIsolated}
              onChange={(event) =>
                onFiltersChange({ ...filters, hideIsolated: event.target.checked })
              }
              className="size-3.5 accent-primary"
            />
            Hide isolated nodes
            <span className="text-2xs text-muted-foreground">
              (nodes with no visible relationship after filtering)
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs transition-colors',
        active
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-surface-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
