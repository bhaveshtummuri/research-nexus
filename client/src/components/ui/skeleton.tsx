import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Shimmering placeholder that matches the footprint of the content it replaces. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'skeleton-shimmer relative overflow-hidden rounded-md bg-surface-muted',
        className,
      )}
      {...props}
    />
  );
}
