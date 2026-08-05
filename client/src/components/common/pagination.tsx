import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, formatNumber } from '@/lib/utils';
import type { ResponseMeta } from '@/types/api';

interface PaginationProps {
  meta: ResponseMeta | undefined;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Offset pagination.
 *
 * Total counts come from a companion `count(...)` query, but not every endpoint
 * computes one, so the control degrades gracefully to next/previous when
 * `total` is absent.
 */
export function Pagination({ meta, page, pageSize, onPageChange, className }: PaginationProps) {
  const total = meta?.total;
  const count = meta?.count ?? 0;
  const hasMore = meta?.hasMore ?? count === pageSize;
  const from = page * pageSize + (count > 0 ? 1 : 0);
  const to = page * pageSize + count;
  const lastPage = total ? Math.max(Math.ceil(total / pageSize) - 1, 0) : undefined;

  if (page === 0 && !hasMore && count === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-xs text-muted-foreground">
        {count === 0
          ? 'No results'
          : total !== undefined
            ? `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`
            : `${formatNumber(from)}–${formatNumber(to)}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {lastPage !== undefined ? `Page ${page + 1} of ${lastPage + 1}` : `Page ${page + 1}`}
        </span>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
