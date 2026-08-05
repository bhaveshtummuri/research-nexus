import type { QueryValue } from '@/lib/api';
import { request, requestList } from '@/lib/api';
import type { CitationChain, Paged, PaperDetail, PaperSummary, ScoredPaper } from '@/types/api';

type Params = Record<string, QueryValue>;

export function list(params: Params, signal?: AbortSignal): Promise<Paged<PaperSummary>> {
  return requestList<PaperSummary>('/papers', { params, ...(signal ? { signal } : {}) });
}

export function getById(id: string, signal?: AbortSignal): Promise<PaperDetail> {
  return request<PaperDetail>(`/papers/${id}`, signal ? { signal } : {});
}

/** Similarity blended from shared topics, keywords, co-citation and coupling. */
export function listSimilar(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<ScoredPaper>> {
  return requestList<ScoredPaper>(`/papers/${id}/similar`, {
    params,
    ...(signal ? { signal } : {}),
  });
}

/** `forward` traces ancestry; `backward` traces downstream influence. */
export function listCitationChains(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<CitationChain>> {
  return requestList<CitationChain>(`/papers/${id}/citation-chains`, {
    params,
    ...(signal ? { signal } : {}),
  });
}
