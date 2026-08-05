import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
  index?: number;
}

/**
 * A single headline figure. The staggered entrance is driven by `index` so a row
 * of tiles animates in sequence rather than all at once.
 */
export function StatCard({ label, value, hint, icon: Icon, accent, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="surface-gradient group relative overflow-hidden rounded-lg border border-border p-4 shadow-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <Icon
            className={cn('size-4 shrink-0 text-muted-foreground transition-colors', accent)}
            aria-hidden
          />
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </motion.div>
  );
}
