import { cn, LABEL_STYLES } from '@/lib/utils';
import type { GraphView, NodeLabel } from '@/types/api';

/**
 * Legend driven by what is actually on screen.
 *
 * Showing all ten labels regardless of the current subgraph would make the
 * legend noise; deriving it from `stats.labelCounts` keeps it a description of
 * the view rather than a static key.
 */
export function GraphLegend({
  stats,
  className,
}: {
  stats: GraphView['stats'];
  className?: string;
}) {
  if (stats.labelCounts.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {stats.labelCounts.map(({ label, count }) => (
        <span key={label} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', LABEL_STYLES[label as NodeLabel]?.dot)} aria-hidden />
          {LABEL_STYLES[label as NodeLabel]?.name ?? label}
          <span className="tabular-nums opacity-70">{count}</span>
        </span>
      ))}
    </div>
  );
}
