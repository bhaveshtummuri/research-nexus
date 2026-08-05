import { motion } from 'framer-motion';
import { Quote, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn, formatAuthorList, formatCompact } from '@/lib/utils';
import type { PaperSummary } from '@/types/api';

interface PaperCardProps {
  paper: PaperSummary;
  index?: number;
  footer?: ReactNode;
  className?: string;
}

export function PaperCard({ paper, index = 0, footer, className }: PaperCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/papers/${paper.id}`}
        className={cn(
          'surface-gradient group block rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-primary/40 hover:shadow-raised',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-pretty text-sm font-medium leading-snug transition-colors group-hover:text-primary">
            {paper.title}
          </h3>
          <span className="shrink-0 rounded-md border border-border bg-surface-muted px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground">
            {paper.year}
          </span>
        </div>

        {paper.authors.length > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Users className="size-3 shrink-0" aria-hidden />
            {formatAuthorList(paper.authors)}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {paper.topics.slice(0, 3).map((topic) => (
            <Badge key={topic.id} variant="outline" className="max-w-[12rem] truncate">
              {topic.name}
            </Badge>
          ))}
          {paper.venue ? (
            <Badge variant="primary" className="max-w-[12rem] truncate">
              {paper.venue.name}
            </Badge>
          ) : null}
          <span className="ml-auto flex items-center gap-1 text-2xs tabular-nums text-muted-foreground">
            <Quote className="size-3" aria-hidden />
            {formatCompact(paper.citationCount)}
          </span>
        </div>

        {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
      </Link>
    </motion.div>
  );
}
