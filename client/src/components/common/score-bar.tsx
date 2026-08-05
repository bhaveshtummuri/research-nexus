import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { RecommendationReason } from '@/types/api';

/**
 * Explains a recommendation instead of just asserting one.
 *
 * The server returns the individual signals that produced a score, and each is
 * drawn proportionally so a reader can see whether a match came from shared
 * topics, shared references or co-citation.
 */
export function ScoreBreakdown({
  score,
  reasons,
  className,
}: {
  score: number;
  reasons: RecommendationReason[];
  className?: string;
}) {
  const total = reasons.reduce((sum, reason) => sum + reason.weight, 0) || 1;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Match score
        </span>
        <span className="text-xs font-semibold tabular-nums">{score.toFixed(1)}</span>
      </div>

      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
        {reasons.map((reason, index) => (
          <motion.div
            key={reason.kind}
            initial={{ width: 0 }}
            animate={{ width: `${(reason.weight / total) * 100}%` }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={REASON_COLORS[reason.kind] ?? 'bg-muted-foreground'}
            title={reason.label}
          />
        ))}
      </div>

      <ul className="space-y-1">
        {reasons.map((reason) => (
          <li key={reason.kind} className="flex items-center gap-2 text-2xs text-muted-foreground">
            <span
              className={cn('size-1.5 shrink-0 rounded-full', REASON_COLORS[reason.kind] ?? 'bg-muted-foreground')}
              aria-hidden
            />
            {reason.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const REASON_COLORS: Record<string, string> = {
  'shared-topic': 'bg-graph-topic',
  'shared-keyword': 'bg-graph-keyword',
  'shared-citation': 'bg-graph-paper',
  'co-citation': 'bg-graph-journal',
  'shared-collaborator': 'bg-graph-author',
  'shared-venue': 'bg-graph-conference',
  'shared-dataset': 'bg-graph-dataset',
  'same-institution': 'bg-graph-university',
  'cross-domain': 'bg-graph-funding',
};
