import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}

/** Search field plus a slot for per-page filter controls. */
export function FilterBar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  children,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          aria-label={placeholder}
        />
        {search ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onSearchChange('')}
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
