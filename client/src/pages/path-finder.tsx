import { ArrowLeftRight, Expand, Route, Search, Shuffle, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityPicker, type PickedEntity } from '@/components/common/entity-picker';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Section } from '@/components/common/section';
import { GraphCanvas } from '@/components/graph/graph-canvas';
import { GraphLegend } from '@/components/graph/graph-legend';
import { PathTrail } from '@/components/graph/path-trail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useShortestPath } from '@/hooks/use-api';

/**
 * Shortest-path discovery.
 *
 * This is the clearest demonstration of the project's thesis: answering "how are
 * these two people connected" needs a recursive CTE and post-hoc pruning in SQL,
 * and is one `shortestPath` call here.
 */
/** Shared by the depth selector and the "search wider" recovery action, so the
 *  button can never offer a depth the selector does not have. */
const HOP_OPTIONS = [2, 3, 4, 5, 6, 8] as const;
const MAX_HOPS: number = Math.max(...HOP_OPTIONS);

export function PathFinderPage() {
  const [searchParams] = useSearchParams();

  const [from, setFrom] = useState<PickedEntity | null>(null);
  const [to, setTo] = useState<PickedEntity | null>(null);
  const [mode, setMode] = useState<'collaboration' | 'any'>('collaboration');
  const [maxDepth, setMaxDepth] = useState(6);
  const [showAll, setShowAll] = useState(true);
  const [submitted, setSubmitted] = useState<{ from: string; to: string } | null>(() => {
    const initialFrom = searchParams.get('from');
    const initialTo = searchParams.get('to');
    return initialFrom && initialTo ? { from: initialFrom, to: initialTo } : null;
  });

  const { data, isLoading, isError, error, refetch } = useShortestPath(
    {
      from: submitted?.from ?? '',
      to: submitted?.to ?? '',
      mode,
      maxDepth,
      all: showAll ? 'true' : 'false',
    },
    Boolean(submitted),
  );

  const canSearch = Boolean(from && to && from.id !== to.id);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  // Steps to the next depth the selector actually offers, rather than +1, so the
  // retry is a meaningfully wider search instead of a barely different one.
  const widenSearch = () => {
    const next = HOP_OPTIONS.find((value) => value > maxDepth);
    if (next) setMaxDepth(next);
  };

  const highlighted = new Set(
    (data?.paths ?? []).flatMap((path) => path.nodes.map((node) => node.elementId)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <Route className="size-2.5" aria-hidden />
            shortestPath traversal
          </Badge>
        }
        title="Path finder"
        description="Find the shortest chain of relationships connecting any two entities. Collaboration mode walks co-authorship only; any-relationship mode routes through papers, institutions, datasets and funding as needed."
      />

      <div className="surface-gradient space-y-4 rounded-lg border border-border p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
          <EntityPicker
            label="From"
            value={from}
            onChange={setFrom}
            labels={mode === 'collaboration' ? ['Author'] : undefined}
            placeholder={mode === 'collaboration' ? 'Search researchers…' : 'Search any entity…'}
          />
          <div className="flex items-end justify-center pb-0.5">
            <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap endpoints">
              <ArrowLeftRight className="size-4" />
            </Button>
          </div>
          <EntityPicker
            label="To"
            value={to}
            onChange={setTo}
            labels={mode === 'collaboration' ? ['Author'] : undefined}
            placeholder={mode === 'collaboration' ? 'Search researchers…' : 'Search any entity…'}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Relationship scope
            </label>
            <Select
              value={mode}
              onChange={(event) => setMode(event.target.value as 'collaboration' | 'any')}
              aria-label="Relationship scope"
              className="w-56"
            >
              <option value="collaboration">Co-authorship only</option>
              <option value="any">Any relationship</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Max hops
            </label>
            <Select
              value={String(maxDepth)}
              onChange={(event) => setMaxDepth(Number(event.target.value))}
              aria-label="Maximum hops"
              className="w-32"
            >
              {HOP_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} hops
                </option>
              ))}
            </Select>
          </div>

          {mode === 'collaboration' ? (
            <label className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
                className="size-3.5 accent-[hsl(var(--primary))]"
              />
              Show every equally short route
            </label>
          ) : null}

          <Button
            className="ml-auto"
            disabled={!canSearch}
            onClick={() => from && to && setSubmitted({ from: from.id, to: to.id })}
          >
            <Search className="size-4" />
            Find path
          </Button>
        </div>
      </div>

      {!submitted ? (
        <EmptyState
          icon={Route}
          title="Pick two entities to connect"
          description="Choose a starting point and a destination, then run the traversal. Try two researchers from different institutions to see how far the collaboration network reaches."
        />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.found ? (
        <div className="space-y-6">
          <Section
            title={
              data.paths.length === 1
                ? `Connected in ${data.paths[0]?.length ?? 0} hops`
                : `${data.paths.length} equally short routes, ${data.paths[0]?.length ?? 0} hops each`
            }
            description="Each hop is a real relationship in the graph, with its properties preserved."
          >
            <div className="space-y-3">
              {data.paths.map((path, index) => (
                <div key={index} className="surface-gradient rounded-lg border border-border p-4">
                  <PathTrail path={path} />
                </div>
              ))}
            </div>
          </Section>

          {data.graph ? (
            <Section title="The connection, drawn">
              <div className="space-y-3">
                <GraphCanvas
                  nodes={data.graph.nodes}
                  edges={data.graph.edges}
                  highlightedElementIds={highlighted}
                  height={420}
                />
                <GraphLegend stats={data.graph.stats} />
              </div>
            </Section>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={Waypoints}
          title="No path found within that many hops"
          description="These two entities are not connected inside the current limit. Widening the hop budget, or routing through papers and institutions, is what usually finds a route."
          action={
            <>
              {maxDepth < MAX_HOPS ? (
                <Button variant="secondary" size="sm" onClick={widenSearch}>
                  <Expand className="size-3.5" />
                  Search {HOP_OPTIONS.find((value) => value > maxDepth)} hops
                </Button>
              ) : null}
              {mode === 'collaboration' ? (
                <Button variant="secondary" size="sm" onClick={() => setMode('any')}>
                  <Shuffle className="size-3.5" />
                  Try any relationship
                </Button>
              ) : null}
            </>
          }
        />
      )}
    </div>
  );
}
