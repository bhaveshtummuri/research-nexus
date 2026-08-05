import { useCallback, useEffect, useState } from 'react';

import type { NodeLabel } from '@/types/api';

export interface SearchHistoryEntry {
  id: string;
  label: NodeLabel;
  title: string;
  subtitle: string;
  href: string;
}

const STORAGE_KEY = 'research-nexus:search-history';
const MAX_ENTRIES = 6;

function read(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Entries persist across deploys, so a stored shape from an older version
    // is filtered out rather than trusted into the render.
    return parsed.filter(
      (entry): entry is SearchHistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SearchHistoryEntry).id === 'string' &&
        typeof (entry as SearchHistoryEntry).href === 'string' &&
        typeof (entry as SearchHistoryEntry).title === 'string',
    );
  } catch {
    // Corrupt JSON or a storage-disabled browser: history is a convenience, so
    // failing to read it must never break search.
    return [];
  }
}

/**
 * Recently opened search results, persisted locally.
 *
 * Stores what the user *opened*, not what they typed: a half-finished query is
 * rarely worth re-running, whereas a paper they looked at yesterday usually is.
 * Re-selecting an entry moves it to the front rather than duplicating it.
 */
export function useSearchHistory() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Private-mode quota errors are not worth surfacing.
    }
  }, [entries]);

  const remember = useCallback((entry: SearchHistoryEntry) => {
    setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, MAX_ENTRIES));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, remember, clear };
}
