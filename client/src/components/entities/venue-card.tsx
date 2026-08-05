import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn, formatCompact } from '@/lib/utils';
import type { ConferenceSummary, JournalSummary } from '@/types/api';

export function ConferenceCard({
  conference,
  index = 0,
}: {
  conference: ConferenceSummary;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/conferences/${conference.id}`}
        className={cn(
          'surface-gradient group flex h-full flex-col rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-graph-conference/45 hover:shadow-raised',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-md border border-graph-conference/25 bg-graph-conference/15 px-2 py-0.5 text-xs font-semibold text-graph-conference">
            {conference.acronym}
          </span>
          <Badge variant={conference.tier === 'A*' ? 'primary' : 'outline'}>{conference.tier}</Badge>
        </div>
        <h3 className="mt-3 flex-1 text-pretty text-sm font-medium leading-snug transition-colors group-hover:text-graph-conference">
          {conference.name}
        </h3>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-2xs text-muted-foreground">
          <span className="truncate">{conference.field}</span>
          <span className="shrink-0">{formatCompact(conference.paperCount)} papers</span>
        </div>
      </Link>
    </motion.div>
  );
}

export function JournalCard({ journal, index = 0 }: { journal: JournalSummary; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/journals/${journal.id}`}
        className={cn(
          'surface-gradient group flex items-center gap-4 rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-graph-journal/45 hover:shadow-raised',
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-graph-journal/25 bg-graph-journal/15 text-xs font-semibold tabular-nums text-graph-journal">
          {journal.impactFactor.toFixed(1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium transition-colors group-hover:text-graph-journal">
            {journal.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{journal.publisher}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs tabular-nums">{formatCompact(journal.paperCount)}</p>
          <p className="text-2xs text-muted-foreground">papers</p>
        </div>
      </Link>
    </motion.div>
  );
}
