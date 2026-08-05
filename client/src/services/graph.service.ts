import type { QueryValue } from '@/lib/api';
import { request } from '@/lib/api';
import type { GraphView, ShortestPathResponse } from '@/types/api';

type Params = Record<string, QueryValue>;

/** The explorer's opening view: the most connected entities across the graph. */
export function sample(params: Params, signal?: AbortSignal): Promise<GraphView> {
  return request<GraphView>('/graph/sample', { params, ...(signal ? { signal } : {}) });
}

/** Bounded neighbourhood expansion around one entity. */
export function expand(params: Params, signal?: AbortSignal): Promise<GraphView> {
  return request<GraphView>('/graph/expand', { params, ...(signal ? { signal } : {}) });
}

/**
 * Shortest path between two entities.
 *
 * Returns the ordered path *and* a renderable subgraph, so the visualiser can
 * draw a result without a second round trip.
 */
export function shortestPath(
  params: Params,
  signal?: AbortSignal,
): Promise<ShortestPathResponse> {
  return request<ShortestPathResponse>('/graph/shortest-path', {
    params,
    ...(signal ? { signal } : {}),
  });
}
