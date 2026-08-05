import { motion } from 'framer-motion';
import { MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn, formatCompact } from '@/lib/utils';
import type { UniversitySummary } from '@/types/api';

export function UniversityCard({
  university,
  index = 0,
  className,
}: {
  university: UniversitySummary;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/universities/${university.id}`}
        className={cn(
          'surface-gradient group flex items-center gap-4 rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-graph-university/45 hover:shadow-raised',
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-graph-university/25 bg-graph-university/15 text-xs font-semibold tabular-nums text-graph-university">
          #{university.ranking}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium transition-colors group-hover:text-graph-university">
            {university.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {university.city}, {university.country}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Badge variant="outline">{university.type}</Badge>
          <span className="flex items-center gap-1 text-2xs tabular-nums text-muted-foreground">
            <Users className="size-3" aria-hidden />
            {formatCompact(university.researcherCount)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
