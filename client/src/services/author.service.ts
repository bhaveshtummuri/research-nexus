import type { QueryValue } from '@/lib/api';
import { request, requestList } from '@/lib/api';
import type {
  AuthorDetail,
  AuthorSummary,
  HiddenCollaborator,
  Paged,
  PaperSummary,
  ScoredPaper,
} from '@/types/api';

type Params = Record<string, QueryValue>;

export function list(params: Params, signal?: AbortSignal): Promise<Paged<AuthorSummary>> {
  return requestList<AuthorSummary>('/authors', { params, ...(signal ? { signal } : {}) });
}

export function getById(id: string, signal?: AbortSignal): Promise<AuthorDetail> {
  return request<AuthorDetail>(`/authors/${id}`, signal ? { signal } : {});
}

export function listPapers(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<PaperSummary>> {
  return requestList<PaperSummary>(`/authors/${id}/papers`, {
    params,
    ...(signal ? { signal } : {}),
  });
}

/** Researchers reachable within `depth` collaboration hops, nearest first. */
export function listCollaborators(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<HiddenCollaborator>> {
  return requestList<HiddenCollaborator>(`/authors/${id}/collaborators`, {
    params,
    ...(signal ? { signal } : {}),
  });
}

/** Two hops away, shared topics, never co-authored - the introduction to make. */
export function listHiddenCollaborators(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<HiddenCollaborator>> {
  return requestList<HiddenCollaborator>(`/authors/${id}/hidden-collaborators`, {
    params,
    ...(signal ? { signal } : {}),
  });
}

export function listRecommendations(
  id: string,
  params: Params,
  signal?: AbortSignal,
): Promise<Paged<ScoredPaper>> {
  return requestList<ScoredPaper>(`/authors/${id}/recommendations`, {
    params,
    ...(signal ? { signal } : {}),
  });
}
