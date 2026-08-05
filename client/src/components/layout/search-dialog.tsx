import { AlertTriangle, Clock, CornerDownLeft, Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EntityBadge } from '@/components/common/entity-badge';
import { Highlight } from '@/components/common/highlight';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useSearch } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchHistory } from '@/hooks/use-search-history';
import { cn, pluralise } from '@/lib/utils';
import type { SearchHit } from '@/types/api';

/**
 * Shown when the field is empty and there is no history yet.
 *
 * A blank palette on first open teaches nothing about what is searchable. These
 * are seeded terms that exist in the dataset, so the first search a new user
 * runs returns something rather than nothing.
 */
const SUGGESTED_QUERIES = [
  'machine learning',
  'graph neural networks',
  'climate',
  'genomics',
  'quantum',
  'robotics',
] as const;

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Command-palette search across every node label.
 *
 * One API call covers all ten labels because the search query unions them
 * server-side, so the palette stays responsive without issuing a request per
 * entity type.
 */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 220);
  const { data, isFetching, isError, error } = useSearch(debouncedQuery, open);
  const { entries: history, remember, clear } = useSearchHistory();

  const isBrowsingHistory = debouncedQuery.trim().length < 2 && history.length > 0;

  // A flat list mirrors what keyboard navigation moves through, while the
  // grouped structure is what gets rendered.
  const flatHits = useMemo<SearchHit[]>(
    () => data?.groups.flatMap((group) => group.hits) ?? [],
    [data],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const select = (hit: SearchHit | undefined) => {
    if (!hit) return;
    remember({
      id: hit.id,
      label: hit.label,
      title: hit.title,
      subtitle: hit.subtitle,
      href: hit.href,
    });
    onOpenChange(false);
    navigate(hit.href);
  };

  // Arrow keys move through whichever list is on screen — results when
  // searching, history when the field is empty.
  const navigable: SearchHit[] = isBrowsingHistory
    ? history.map((entry) => ({ ...entry, score: 0 }))
    : flatHits;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(navigable.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(navigable[activeIndex]);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let cursor = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showClose={false}>
        <DialogTitle className="sr-only">Search Research Nexus</DialogTitle>
        <DialogDescription className="sr-only">
          Search authors, papers, topics, institutions, venues and funders.
        </DialogDescription>

        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search authors, papers, topics, institutions…"
            aria-label="Search"
            // Marks this as a combobox driving the listbox below, so a screen
            // reader announces the active option as the arrow keys move.
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            aria-autocomplete="list"
            {...(navigable.length > 0 ? { 'aria-activedescendant': `search-option-${activeIndex}` } : {})}
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
        </div>

        {/* Result counts are visual-only above; this is what a screen reader
            hears, and only once the query has settled. */}
        <p className="sr-only" role="status" aria-live="polite">
          {isFetching
            ? 'Searching'
            : debouncedQuery.trim().length < 2
              ? ''
              : `${flatHits.length} ${pluralise(flatHits.length, 'result')} for ${debouncedQuery}`}
        </p>

        <div
          ref={listRef}
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(60vh,28rem)] overflow-y-auto p-2"
        >
          {isError ? (
            <div className="px-3 py-8 text-center">
              <AlertTriangle className="mx-auto mb-2 size-5 text-destructive" aria-hidden />
              <p className="text-xs font-medium">Search is unavailable</p>
              <p className="mt-1 text-2xs text-muted-foreground">
                {error instanceof Error ? error.message : 'The API did not respond.'}
              </p>
            </div>
          ) : isBrowsingHistory ? (
            <div className="mb-2">
              <div className="flex items-center justify-between px-3 py-1.5">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </p>
                <button
                  type="button"
                  onClick={clear}
                  className="text-2xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              {history.map((entry, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    id={`search-option-${index}`}
                    aria-selected={isActive}
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select({ ...entry, score: 0 })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <EntityBadge label={entry.label} showDot={false} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{entry.title}</span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : debouncedQuery.trim().length < 2 ? (
            <div className="px-1 py-2">
              <p className="flex items-center gap-1.5 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3" aria-hidden />
                Try searching for
              </p>
              <div className="flex flex-wrap gap-1.5 px-3 pt-1">
                {SUGGESTED_QUERIES.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuery(suggestion)}
                    className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="px-3 pt-4 text-2xs text-muted-foreground">
                Search matches names and titles across all ten entity types. Two characters minimum.
              </p>
            </div>
          ) : flatHits.length === 0 && !isFetching ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs font-medium">No matches for “{debouncedQuery}”</p>
              <p className="mx-auto mt-1 max-w-xs text-2xs leading-relaxed text-muted-foreground">
                Search looks at names and titles, not full text. A shorter or more general term
                usually finds it.
              </p>
            </div>
          ) : (
            data?.groups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.hits.map((hit) => {
                  cursor += 1;
                  const index = cursor;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={`${hit.label}-${hit.id}`}
                      type="button"
                      role="option"
                      id={`search-option-${index}`}
                      aria-selected={isActive}
                      data-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(hit)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        isActive ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <EntityBadge label={hit.label} showDot={false} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          <Highlight text={hit.title} query={debouncedQuery} />
                        </span>
                        <span className="block truncate text-2xs text-muted-foreground">
                          <Highlight text={hit.subtitle} query={debouncedQuery} />
                        </span>
                      </span>
                      {isActive ? (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-2xs text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-surface-muted px-1">↑</kbd>{' '}
            <kbd className="rounded border border-border bg-surface-muted px-1">↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-surface-muted px-1">↵</kbd> open
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-border bg-surface-muted px-1">esc</kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
