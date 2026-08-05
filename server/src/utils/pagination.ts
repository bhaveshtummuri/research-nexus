import { config } from '../config/index.js';

export interface Pagination {
  offset: number;
  limit: number;
}

/**
 * Clamps caller-supplied paging into the configured bounds.
 *
 * The clamp is applied server-side rather than trusted from the request, so a
 * `limit=100000` can never turn a bounded traversal into a full graph scan.
 */
export function resolvePagination(input: { offset?: number; limit?: number }): Pagination {
  const limit = Math.min(
    Math.max(input.limit ?? config.limits.defaultPageSize, 1),
    config.limits.maxPageSize,
  );
  const offset = Math.max(input.offset ?? 0, 0);
  return { offset, limit };
}

/** Clamps a traversal depth to the configured maximum. */
export function resolveDepth(depth: number | undefined, fallback = 2): number {
  return Math.min(Math.max(depth ?? fallback, 1), config.limits.maxTraversalDepth);
}

/** Clamps a graph node budget to the configured maximum. */
export function resolveGraphLimit(limit: number | undefined, fallback = 120): number {
  return Math.min(Math.max(limit ?? fallback, 5), config.limits.maxGraphNodes);
}

/**
 * Normalises a free-text filter for the `searchText CONTAINS` predicate.
 * Returns `null` when the term is empty so the query's `$search IS NULL` branch
 * short-circuits the comparison entirely.
 */
export function normaliseSearchTerm(term: string | undefined): string | null {
  const trimmed = term?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
