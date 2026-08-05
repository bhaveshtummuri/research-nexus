import { Loader2 } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn, range } from '@/lib/utils';

/**
 * Loading placeholders.
 *
 * Each one mirrors the footprint of the content it stands in for. That is the
 * whole point: a skeleton whose shape does not match causes a layout jump on
 * arrival, which is more jarring than the spinner it replaced. Every skeleton
 * here is `aria-hidden` with a single live-region announcement instead — a
 * screen reader gains nothing from twelve grey rectangles.
 */

/** Announces loading once, for assistive tech, while the shapes stay hidden. */
function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Row placeholders sized to match the list items they stand in for. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading results" className={className}>
      <div className="space-y-2">
        {range(rows).map((row) => (
          <div
            key={row}
            className="surface-gradient flex items-center gap-4 rounded-lg border border-border p-4"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-3 w-16 sm:block" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function CardGridSkeleton({ cards = 4, className }: { cards?: number; className?: string }) {
  return (
    <LoadingRegion label="Loading statistics" className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {range(cards).map((card) => (
          <div key={card} className="surface-gradient space-y-3 rounded-lg border border-border p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Matches the `Table` primitive, down to the border and header tint. */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <LoadingRegion label="Loading table" className={className}>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-4 border-b border-border bg-surface-muted/60 px-4 py-2.5">
          {range(columns).map((column) => (
            <Skeleton key={column} className={cn('h-3', column === 0 ? 'flex-1' : 'w-16')} />
          ))}
        </div>
        <div className="divide-y divide-border">
          {range(rows).map((row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3">
              {range(columns).map((column) => (
                <Skeleton
                  key={column}
                  className={cn('h-3.5', column === 0 ? 'flex-1' : 'w-16')}
                  // A uniform grid reads as a rendering artefact; varying the
                  // first column suggests real rows of differing length.
                  style={column === 0 ? { maxWidth: `${60 + ((row * 37) % 35)}%` } : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Profile / detail page: header, stat row, two-column body. */
export function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading page">
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {range(4).map((card) => (
            <div key={card} className="surface-gradient space-y-3 rounded-lg border border-border p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            {range(4).map((row) => (
              <div
                key={row}
                className="surface-gradient flex items-center gap-4 rounded-lg border border-border p-4"
              >
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
          <div className="surface-gradient space-y-3 rounded-lg border border-border p-5">
            {range(5).map((row) => (
              <Skeleton key={row} className="h-3.5 w-full" />
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Index page: title, filter bar, then a list. */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading page">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 flex-1 basis-64" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-2">
          {range(rows).map((row) => (
            <div
              key={row}
              className="surface-gradient flex items-center gap-4 rounded-lg border border-border p-4"
            >
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="hidden h-3 w-16 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion label="Loading chart">
      <Skeleton className={cn('h-64 w-full', className)} />
    </LoadingRegion>
  );
}

/**
 * Graph canvas placeholder.
 *
 * Deliberately not a grey rectangle: scattered dots joined by faint lines read
 * as "a graph is coming", which sets the right expectation for a surface whose
 * first paint can take a second on a deep traversal.
 */
export function GraphSkeleton({ className }: { className?: string }) {
  // Fixed coordinates rather than random ones, so the placeholder does not
  // reshuffle on every re-render while the query is still in flight.
  const points = [
    [50, 42],
    [28, 24],
    [72, 26],
    [22, 66],
    [78, 68],
    [40, 78],
    [62, 14],
    [14, 44],
    [88, 46],
  ] as const;
  const links: Array<readonly [number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 7],
    [2, 6],
    [3, 5],
    [4, 8],
  ];

  return (
    <LoadingRegion label="Loading graph" className={cn('h-full w-full', className)}>
      <div className="relative h-full min-h-[24rem] w-full overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid-backdrop absolute inset-0" />
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {links.map(([from, to]) => {
            const a = points[from];
            const b = points[to];
            if (!a || !b) return null;
            return (
              <line
                key={`${from}-${to}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="hsl(var(--border))"
                strokeWidth={0.4}
              />
            );
          })}
        </svg>
        {points.map(([x, y], index) => (
          <span
            key={`${x}-${y}`}
            className="node-pulse absolute rounded-full bg-muted"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: index === 0 ? 22 : 13,
              height: index === 0 ? 22 : 13,
              // Staggered so the nodes breathe in sequence rather than in unison.
              animationDelay: `${index * 0.12}s`,
            }}
          />
        ))}
      </div>
    </LoadingRegion>
  );
}

/**
 * Inline progress for data arriving on top of data already on screen.
 *
 * Used where replacing the view with a skeleton would be a regression — a
 * paginated list keeps its current page visible while the next one loads, and
 * this is the only signal that anything is happening.
 */
export function InlineLoading({
  label = 'Loading more…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/**
 * Dims content that is being replaced, without removing it.
 *
 * Refetching a filtered list should not blank the page — the previous results
 * stay legible and go slightly transparent, which communicates "updating"
 * instead of "starting over". Pointer events are cut so nothing is clicked as it
 * changes underneath.
 */
export function RefreshingOverlay({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'transition-opacity duration-200',
        active && 'pointer-events-none opacity-55',
        className,
      )}
      aria-busy={active}
    >
      {children}
    </div>
  );
}
