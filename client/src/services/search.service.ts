import { request } from '@/lib/api';
import type { SearchResults } from '@/types/api';

/**
 * Global search across all ten node labels.
 *
 * One round trip: the server unions the label branches, so the command palette
 * stays responsive without issuing a request per entity type.
 */
export function search(query: string, signal?: AbortSignal): Promise<SearchResults> {
  return request<SearchResults>('/search', {
    params: { q: query },
    ...(signal ? { signal } : {}),
  });
}
