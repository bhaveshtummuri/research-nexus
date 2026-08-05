import { motion } from 'framer-motion';
import { Building2, FileText, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn, formatCompact, initials } from '@/lib/utils';
import type { AuthorSummary } from '@/types/api';

interface AuthorCardProps {
  author: AuthorSummary;
  index?: number;
  /** Extra content rendered under the metrics row, e.g. a score breakdown. */
  footer?: React.ReactNode;
  className?: string;
}

export function AuthorCard({ author, index = 0, footer, className }: AuthorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/authors/${author.id}`}
        className={cn(
          'surface-gradient group block rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-primary/40 hover:shadow-raised',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full border border-graph-author/25 bg-graph-author/15 text-xs font-semibold text-graph-author"
            aria-hidden
          >
            {initials(author.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
              {author.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{author.title}</p>

            {author.affiliation ? (
              <p className="mt-1 flex items-center gap-1 truncate text-2xs text-muted-foreground">
                <Building2 className="size-3 shrink-0" aria-hidden />
                {author.affiliation.name}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums leading-none">{author.hIndex}</p>
            <p className="mt-1 text-2xs text-muted-foreground">h-index</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="size-3" aria-hidden />
            {formatCompact(author.paperCount)} papers
          </span>
          <span className="flex items-center gap-1">
            <Quote className="size-3" aria-hidden />
            {formatCompact(author.citationCount)} citations
          </span>
          {author.primaryField ? (
            <span className="ml-auto hidden truncate sm:inline">{author.primaryField}</span>
          ) : null}
        </div>

        {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
      </Link>
    </motion.div>
  );
}
