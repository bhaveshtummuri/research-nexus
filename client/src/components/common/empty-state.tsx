import type { LucideIcon } from 'lucide-react';
import {
  FileQuestion,
  GitBranch,
  Lightbulb,
  Network,
  RotateCcw,
  SearchX,
  Users,
  Waypoints,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Empty states.
 *
 * An empty result is a fact about the data, not a failure — and the difference
 * matters, because the recovery is different. "No results" with a way forward
 * reads as a dead end resolved; the same message alone reads as broken.
 *
 * Every state therefore answers three questions: what is empty, why it might be,
 * and what to do next. The `action` is the third of those and is what most
 * empty states in the wild are missing.
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Renders inside a bordered panel. Off for use inside an existing card. */
  bordered?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = SearchX,
  action,
  bordered = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        bordered && 'rounded-lg border border-dashed border-border bg-surface-muted/40',
        className,
      )}
    >
      <div className="rounded-full border border-border bg-surface p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap justify-center gap-2 pt-1">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/**
 * The recurring empty states, each with its own next action.
 *
 * These exist so the same condition is worded the same way everywhere it can
 * occur — "no collaboration path" appears on three surfaces and previously said
 * three different things.
 */

/** A filter or query matched nothing. The fix is nearly always the filter. */
export function NoResults({
  query,
  onClear,
  entity = 'results',
  className,
}: {
  query?: string;
  onClear?: () => void;
  entity?: string;
  className?: string;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={query ? `No ${entity} match “${truncateQuery(query)}”` : `No ${entity} found`}
      description={
        query
          ? 'Check the spelling, or try a broader term — search matches names and titles, not full text.'
          : 'The current filters exclude everything in the dataset. Widening one usually brings results back.'
      }
      action={
        onClear ? (
          <Button variant="secondary" size="sm" onClick={onClear}>
            <RotateCcw className="size-3.5" />
            Clear filters
          </Button>
        ) : null
      }
      {...(className ? { className } : {})}
    />
  );
}

/** Two researchers with no connecting route through the graph. */
export function NoPathFound({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Waypoints}
      title="No path connects these two"
      description="They sit in separate components of the graph, or the route between them is longer than the hop limit. Raising the maximum depth is the first thing to try."
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link to="/graph">
            <Network className="size-3.5" />
            Explore the graph instead
          </Link>
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}

/** A paper that neither cites nor is cited. */
export function NoCitations({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={GitBranch}
      title="No citation network"
      description="This paper has no citation edges in either direction, so there is no chain to trace. Recently added papers often look like this until the citing works are seeded."
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link to="/papers">
            <FileQuestion className="size-3.5" />
            Browse other papers
          </Link>
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}

/** Recommendations that came back empty for a chosen researcher. */
export function NoRecommendations({
  onWiden,
  className,
}: {
  onWiden?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Lightbulb}
      title="Nothing to recommend yet"
      description="Recommendations come from shared topics and second-degree collaborators. A researcher with few papers has too little signal for the scoring to work with."
      action={
        onWiden ? (
          <Button variant="secondary" size="sm" onClick={onWiden}>
            <Users className="size-3.5" />
            Widen the search
          </Button>
        ) : null
      }
      {...(className ? { className } : {})}
    />
  );
}

/** The graph explorer before anything has been loaded into it. */
export function NoGraphData({
  onLoad,
  className,
}: {
  onLoad?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Network}
      title="Nothing loaded into the canvas"
      description="Pick a starting entity, or load a sample of the graph and expand outward from whatever looks interesting."
      action={
        onLoad ? (
          <Button size="sm" onClick={onLoad}>
            <Network className="size-3.5" />
            Load a sample
          </Button>
        ) : null
      }
      {...(className ? { className } : {})}
    />
  );
}

/** Prompt shown before the user has supplied the input a page needs. */
export function AwaitingSelection({
  title,
  description,
  icon = Users,
  className,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      {...(className ? { className } : {})}
    />
  );
}

function truncateQuery(query: string): string {
  return query.length > 32 ? `${query.slice(0, 32)}…` : query;
}
