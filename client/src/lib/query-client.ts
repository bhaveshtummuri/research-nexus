import { QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiRequestError } from './api';
import { notify } from './notify';

/**
 * Infrastructure failures are announced once, globally.
 *
 * A page whose own query fails already renders an inline `ErrorState`, so
 * toasting every rejection would double up. What inline states cannot convey is
 * that the *backend itself* is unreachable — the same cause behind every panel
 * failing at once — so only that class is toasted, and deduplicated by a fixed
 * id so ten concurrent dashboard queries produce one message rather than ten.
 */
const INFRASTRUCTURE_TITLES: Record<string, string> = {
  NETWORK_ERROR: 'Cannot reach the API',
  DATABASE_UNAVAILABLE: 'Graph database unavailable',
  TIMEOUT: 'The request timed out',
};

const queryCache = new QueryCache({
  onError(error, query) {
    if (!(error instanceof ApiRequestError)) return;
    const title = INFRASTRUCTURE_TITLES[error.code];
    if (!title) return;
    // A background refetch failing while cached data is still on screen is not
    // worth interrupting anyone over.
    if (query.state.data !== undefined) return;

    // A timeout is degraded-but-recoverable; the other two mean nothing will
    // load at all until something outside the browser is fixed.
    const level = error.isTimeout ? notify.warning : notify.error;
    level(title, { id: `connection-${error.code}`, description: error.message });
  },
});

/**
 * Shared query client.
 *
 * The graph is a read-only dataset that changes only when it is re-seeded, so
 * data is treated as fresh for a minute and refetch-on-focus is disabled: a
 * researcher tabbing back to the window should not trigger a burst of
 * multi-hop traversals.
 */
export const queryClient = new QueryClient({
  queryCache,
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry(failureCount, error) {
        // A 404 or a validation error will not become correct on retry; only
        // transient failures are worth attempting again.
        if (error instanceof ApiRequestError && !error.isRetryable) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

/**
 * Query key factory.
 *
 * Centralising keys keeps invalidation predictable and makes it obvious which
 * queries share a cache prefix.
 */
export const queryKeys = {
  health: ['health'] as const,
  totals: ['analytics', 'totals'] as const,
  analytics: (params: unknown) => ['analytics', 'summary', params] as const,
  overview: ['analytics', 'overview'] as const,
  popularAuthors: (params: unknown) => ['analytics', 'popular-authors', params] as const,
  mostCitedPapers: (params: unknown) => ['analytics', 'most-cited-papers', params] as const,
  connectedKeywords: (params: unknown) => ['analytics', 'connected-keywords', params] as const,
  fundedAreas: (params: unknown) => ['analytics', 'funded-areas', params] as const,
  collaborativeInstitutions: (params: unknown) =>
    ['analytics', 'collaborative-institutions', params] as const,

  authors: (params: unknown) => ['authors', params] as const,
  author: (id: string) => ['authors', id] as const,
  authorPapers: (id: string, params: unknown) => ['authors', id, 'papers', params] as const,
  authorCollaborators: (id: string, params: unknown) =>
    ['authors', id, 'collaborators', params] as const,
  authorHidden: (id: string, params: unknown) =>
    ['authors', id, 'hidden-collaborators', params] as const,
  authorRecommendations: (id: string, params: unknown) =>
    ['authors', id, 'recommendations', params] as const,

  papers: (params: unknown) => ['papers', params] as const,
  paper: (id: string) => ['papers', id] as const,
  similarPapers: (id: string, params: unknown) => ['papers', id, 'similar', params] as const,
  citationChains: (id: string, params: unknown) =>
    ['papers', id, 'citation-chains', params] as const,
  citationTree: (id: string, params: unknown) => ['papers', id, 'citation-tree', params] as const,
  influentialCitations: (id: string, params: unknown) =>
    ['papers', id, 'influential-citations', params] as const,

  universities: (params: unknown) => ['universities', params] as const,
  university: (id: string) => ['universities', id] as const,
  similarUniversities: (id: string, params: unknown) =>
    ['universities', id, 'similar', params] as const,

  topics: (params: unknown) => ['topics', params] as const,
  topic: (id: string) => ['topics', id] as const,
  topicFields: ['topics', 'fields'] as const,
  trendingTopics: (params: unknown) => ['topics', 'trending', params] as const,
  topicExperts: (id: string, params: unknown) => ['topics', id, 'experts', params] as const,
  similarTopics: (id: string, params: unknown) => ['topics', id, 'similar', params] as const,

  conferences: (params: unknown) => ['conferences', params] as const,
  conference: (id: string) => ['conferences', id] as const,
  journals: (params: unknown) => ['journals', params] as const,
  journal: (id: string) => ['journals', id] as const,

  fundingAgencies: (params: unknown) => ['funding', 'agencies', params] as const,
  fundingAgency: (id: string) => ['funding', 'agencies', id] as const,
  similarFunders: (id: string, params: unknown) =>
    ['funding', 'agencies', id, 'similar', params] as const,
  projects: (params: unknown) => ['funding', 'projects', params] as const,
  datasets: (params: unknown) => ['datasets', params] as const,

  search: (query: string) => ['search', query] as const,
  graphSample: (params: unknown) => ['graph', 'sample', params] as const,
  graphExpand: (params: unknown) => ['graph', 'expand', params] as const,
  shortestPath: (params: unknown) => ['graph', 'shortest-path', params] as const,
  neighbourhood: (id: string, params: unknown) => ['graph', 'neighbourhood', id, params] as const,
  crossDomain: (params: unknown) => ['discovery', 'cross-domain', params] as const,
  collaborativeResearchers: (params: unknown) =>
    ['collaboration', 'researchers', params] as const,
};
