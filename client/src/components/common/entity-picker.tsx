import { Check, Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { EntityBadge } from '@/components/common/entity-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import type { NodeLabel, SearchHit } from '@/types/api';

export interface PickedEntity {
  id: string;
  label: NodeLabel;
  title: string;
  subtitle: string;
}

interface EntityPickerProps {
  value: PickedEntity | null;
  onChange: (entity: PickedEntity | null) => void;
  /** Restricts results to these labels, e.g. only authors for a path search. */
  labels?: NodeLabel[];
  placeholder?: string;
  label: string;
  className?: string;
}

/**
 * Type-ahead entity selector built on the global search endpoint.
 *
 * The path finder, collaboration explorer and citation explorer all need "pick
 * an entity" input, so it is one component rather than three variations.
 */
export function EntityPicker({
  value,
  onChange,
  labels,
  placeholder = 'Search…',
  label,
  className,
}: EntityPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 220);
  const { data, isFetching } = useSearch(debouncedQuery, open);

  const hits = (data?.groups ?? [])
    .filter((group) => !labels || labels.includes(group.label))
    .flatMap((group) => group.hits)
    .slice(0, 8);

  // Clicking outside dismisses the dropdown without stealing focus management
  // from the input itself.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const select = (hit: SearchHit) => {
    onChange({ id: hit.id, label: hit.label, title: hit.title, subtitle: hit.subtitle });
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative space-y-1.5', className)}>
      <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>

      {value ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5">
          <EntityBadge label={value.label} showDot={false} />
          <span className="min-w-0 flex-1 truncate text-sm">{value.title}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-9"
          />
          {isFetching ? (
            <Loader2
              className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
      )}

      {open && !value && debouncedQuery.trim().length >= 2 ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-raised shadow-overlay">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {isFetching ? 'Searching…' : 'No matches'}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto p-1">
              {hits.map((hit) => (
                <li key={`${hit.label}-${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => select(hit)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                  >
                    <EntityBadge label={hit.label} showDot={false} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{hit.title}</span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    </span>
                    <Check className="size-3.5 shrink-0 opacity-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
