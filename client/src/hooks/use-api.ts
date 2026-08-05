import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { request, requestList, requestWithMeta, type QueryValue } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import type {
  AnalyticsSummary,
  AuthorDetail,
  AuthorSummary,
  CitationChain,
  CitationTreeMeta,
  CitationTreeNode,
  CollaborativeInstitution,
  CollaborativeResearcher,
  ConferenceDetail,
  ConferenceSummary,
  ConnectedKeyword,
  CrossDomainCollaboration,
  DashboardTotals,
  DatabaseStatus,
  DatasetSummary,
  ExpertSummary,
  FundingAgencyDetail,
  FundingAgencySummary,
  FundedResearchArea,
  FundingSimilarity,
  GraphOverview,
  GraphView,
  HiddenCollaborator,
  InfluentialCitationPath,
  JournalDetail,
  JournalSummary,
  MostCitedPaper,
  NeighbourResult,
  Paged,
  PaperDetail,
  PaperSummary,
  ProjectSummary,
  ScoredPaper,
  SearchResults,
  ShortestPathResponse,
  TopicDetail,
  TopicFieldSummary,
  TopicSimilarity,
  TopicSummary,
  TrendingTopic,
  UniversityDetail,
  UniversitySimilarity,
  UniversitySummary,
} from '@/types/api';

type Params = Record<string, QueryValue>;

/**
 * Data-access hooks.
 *
 * Every endpoint gets exactly one hook so components never call `fetch`
 * directly and cache keys stay consistent across pages. List hooks use
 * `keepPreviousData`, which keeps the previous page on screen while the next
 * one loads instead of flashing an empty table on every filter change.
 */

function listQuery<T>(key: readonly unknown[], path: string, params: Params) {
  return {
    queryKey: key,
    queryFn: ({ signal }: { signal: AbortSignal }) => requestList<T>(path, { params, signal }),
    placeholderData: keepPreviousData,
  };
}

function detailQuery<T>(key: readonly unknown[], path: string, enabled = true) {
  return {
    queryKey: key,
    queryFn: ({ signal }: { signal: AbortSignal }) => request<T>(path, { signal }),
    enabled,
  };
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------

/**
 * Cached connection status, polled for the header status indicator.
 *
 * `/health/database` reports the last known state without issuing a fresh
 * probe, so polling it is cheap. Retries are disabled: when the API is down the
 * point is to *show* that, not to spend three attempts hiding it.
 */
export function useDatabaseStatus(): UseQueryResult<DatabaseStatus> {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => request<DatabaseStatus>('/health/database', { signal }),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Dashboard and analytics
// ---------------------------------------------------------------------------

export function useDashboardTotals(): UseQueryResult<DashboardTotals> {
  return useQuery(detailQuery<DashboardTotals>(queryKeys.totals, '/analytics/totals'));
}

export function useAnalyticsSummary(params: Params = {}): UseQueryResult<AnalyticsSummary> {
  return useQuery({
    queryKey: queryKeys.analytics(params),
    queryFn: ({ signal }) => request<AnalyticsSummary>('/analytics/summary', { params, signal }),
  });
}

export function useGraphOverview(): UseQueryResult<GraphOverview> {
  return useQuery(detailQuery<GraphOverview>(queryKeys.overview, '/analytics/overview'));
}

/**
 * The four graph-native rankings.
 *
 * Each measures something a row store cannot reach without a self-join per hop:
 * citations counted from edges, keyword co-occurrence degree, funding traced
 * three hops to a field, and institutional partner breadth.
 */
export function usePopularAuthors(params: Params = {}): UseQueryResult<Paged<AuthorSummary>> {
  return useQuery(
    listQuery<AuthorSummary>(queryKeys.popularAuthors(params), '/analytics/popular-authors', params),
  );
}

export function useMostCitedPapers(params: Params = {}): UseQueryResult<Paged<MostCitedPaper>> {
  return useQuery(
    listQuery<MostCitedPaper>(
      queryKeys.mostCitedPapers(params),
      '/analytics/most-cited-papers',
      params,
    ),
  );
}

export function useConnectedKeywords(params: Params = {}): UseQueryResult<Paged<ConnectedKeyword>> {
  return useQuery(
    listQuery<ConnectedKeyword>(
      queryKeys.connectedKeywords(params),
      '/analytics/connected-keywords',
      params,
    ),
  );
}

export function useFundedResearchAreas(
  params: Params = {},
): UseQueryResult<Paged<FundedResearchArea>> {
  return useQuery(
    listQuery<FundedResearchArea>(queryKeys.fundedAreas(params), '/analytics/funded-areas', params),
  );
}

export function useCollaborativeInstitutions(
  params: Params = {},
): UseQueryResult<Paged<CollaborativeInstitution>> {
  return useQuery(
    listQuery<CollaborativeInstitution>(
      queryKeys.collaborativeInstitutions(params),
      '/analytics/collaborative-institutions',
      params,
    ),
  );
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export function useAuthors(params: Params): UseQueryResult<Paged<AuthorSummary>> {
  return useQuery(listQuery<AuthorSummary>(queryKeys.authors(params), '/authors', params));
}

export function useAuthor(id: string | undefined): UseQueryResult<AuthorDetail> {
  return useQuery(detailQuery<AuthorDetail>(queryKeys.author(id ?? ''), `/authors/${id}`, Boolean(id)));
}

export function useAuthorPapers(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<PaperSummary>> {
  return useQuery({
    ...listQuery<PaperSummary>(queryKeys.authorPapers(id ?? '', params), `/authors/${id}/papers`, params),
    enabled: Boolean(id),
  });
}

export function useAuthorCollaborators(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<HiddenCollaborator>> {
  return useQuery({
    ...listQuery<HiddenCollaborator>(
      queryKeys.authorCollaborators(id ?? '', params),
      `/authors/${id}/collaborators`,
      params,
    ),
    enabled: Boolean(id),
  });
}

export function useHiddenCollaborators(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<HiddenCollaborator>> {
  return useQuery({
    ...listQuery<HiddenCollaborator>(
      queryKeys.authorHidden(id ?? '', params),
      `/authors/${id}/hidden-collaborators`,
      params,
    ),
    enabled: Boolean(id),
  });
}

export function useAuthorRecommendations(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<ScoredPaper>> {
  return useQuery({
    ...listQuery<ScoredPaper>(
      queryKeys.authorRecommendations(id ?? '', params),
      `/authors/${id}/recommendations`,
      params,
    ),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

export function usePapers(params: Params): UseQueryResult<Paged<PaperSummary>> {
  return useQuery(listQuery<PaperSummary>(queryKeys.papers(params), '/papers', params));
}

export function usePaper(id: string | undefined): UseQueryResult<PaperDetail> {
  return useQuery(detailQuery<PaperDetail>(queryKeys.paper(id ?? ''), `/papers/${id}`, Boolean(id)));
}

export function useSimilarPapers(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<ScoredPaper>> {
  return useQuery({
    ...listQuery<ScoredPaper>(queryKeys.similarPapers(id ?? '', params), `/papers/${id}/similar`, params),
    enabled: Boolean(id),
  });
}

export function useCitationChains(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<CitationChain>> {
  return useQuery({
    ...listQuery<CitationChain>(
      queryKeys.citationChains(id ?? '', params),
      `/papers/${id}/citation-chains`,
      params,
    ),
    enabled: Boolean(id),
  });
}

/**
 * The citation tree.
 *
 * `meta` carries `roots` and `maxDepth`, so the shape is typed explicitly here
 * rather than through the generic `Paged` helper — the tree cannot be rebuilt
 * without knowing which nodes hang off the requested paper.
 */
export function useCitationTree(
  id: string | undefined,
  params: Params,
): UseQueryResult<{ items: CitationTreeNode[]; meta: CitationTreeMeta }> {
  return useQuery({
    queryKey: queryKeys.citationTree(id ?? '', params),
    async queryFn({ signal }) {
      const { data, meta } = await requestWithMeta<CitationTreeNode[]>(
        `/papers/${id}/citation-tree`,
        { params, signal },
      );
      return { items: data, meta: meta as unknown as CitationTreeMeta };
    },
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

export function useInfluentialCitations(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<InfluentialCitationPath>> {
  return useQuery({
    ...listQuery<InfluentialCitationPath>(
      queryKeys.influentialCitations(id ?? '', params),
      `/papers/${id}/influential-citations`,
      params,
    ),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

export function useUniversities(params: Params): UseQueryResult<Paged<UniversitySummary>> {
  return useQuery(
    listQuery<UniversitySummary>(queryKeys.universities(params), '/universities', params),
  );
}

export function useUniversity(id: string | undefined): UseQueryResult<UniversityDetail> {
  return useQuery(
    detailQuery<UniversityDetail>(queryKeys.university(id ?? ''), `/universities/${id}`, Boolean(id)),
  );
}

export function useSimilarUniversities(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<UniversitySimilarity>> {
  return useQuery({
    ...listQuery<UniversitySimilarity>(
      queryKeys.similarUniversities(id ?? '', params),
      `/universities/${id}/similar`,
      params,
    ),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export function useTopics(params: Params): UseQueryResult<Paged<TopicSummary>> {
  return useQuery(listQuery<TopicSummary>(queryKeys.topics(params), '/topics', params));
}

export function useTopic(id: string | undefined): UseQueryResult<TopicDetail> {
  return useQuery(detailQuery<TopicDetail>(queryKeys.topic(id ?? ''), `/topics/${id}`, Boolean(id)));
}

export function useTopicFields(): UseQueryResult<TopicFieldSummary[]> {
  return useQuery(detailQuery<TopicFieldSummary[]>(queryKeys.topicFields, '/topics/fields'));
}

export function useTrendingTopics(params: Params): UseQueryResult<Paged<TrendingTopic>> {
  return useQuery(
    listQuery<TrendingTopic>(queryKeys.trendingTopics(params), '/topics/trending', params),
  );
}

export function useTopicExperts(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<ExpertSummary>> {
  return useQuery({
    ...listQuery<ExpertSummary>(queryKeys.topicExperts(id ?? '', params), `/topics/${id}/experts`, params),
    enabled: Boolean(id),
  });
}

/**
 * Topics similar by shared keyword vocabulary.
 *
 * Distinct from the related-topics list on the topic detail payload: that one
 * needs two topics to co-occur on a paper, this one reaches topics that share
 * no publication at all but draw on the same terms.
 */
export function useSimilarTopics(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<TopicSimilarity>> {
  return useQuery({
    ...listQuery<TopicSimilarity>(
      queryKeys.similarTopics(id ?? '', params),
      `/topics/${id}/similar`,
      params,
    ),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export function useConferences(params: Params): UseQueryResult<Paged<ConferenceSummary>> {
  return useQuery(
    listQuery<ConferenceSummary>(queryKeys.conferences(params), '/conferences', params),
  );
}

export function useConference(id: string | undefined): UseQueryResult<ConferenceDetail> {
  return useQuery(
    detailQuery<ConferenceDetail>(queryKeys.conference(id ?? ''), `/conferences/${id}`, Boolean(id)),
  );
}

export function useJournals(params: Params): UseQueryResult<Paged<JournalSummary>> {
  return useQuery(listQuery<JournalSummary>(queryKeys.journals(params), '/journals', params));
}

export function useJournal(id: string | undefined): UseQueryResult<JournalDetail> {
  return useQuery(
    detailQuery<JournalDetail>(queryKeys.journal(id ?? ''), `/journals/${id}`, Boolean(id)),
  );
}

// ---------------------------------------------------------------------------
// Funding and datasets
// ---------------------------------------------------------------------------

export function useFundingAgencies(params: Params): UseQueryResult<Paged<FundingAgencySummary>> {
  return useQuery(
    listQuery<FundingAgencySummary>(queryKeys.fundingAgencies(params), '/funding/agencies', params),
  );
}

export function useFundingAgency(id: string | undefined): UseQueryResult<FundingAgencyDetail> {
  return useQuery(
    detailQuery<FundingAgencyDetail>(
      queryKeys.fundingAgency(id ?? ''),
      `/funding/agencies/${id}`,
      Boolean(id),
    ),
  );
}

export function useSimilarFunders(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<FundingSimilarity>> {
  return useQuery({
    ...listQuery<FundingSimilarity>(
      queryKeys.similarFunders(id ?? '', params),
      `/funding/agencies/${id}/similar`,
      params,
    ),
    enabled: Boolean(id),
  });
}

export function useProjects(params: Params): UseQueryResult<Paged<ProjectSummary>> {
  return useQuery(listQuery<ProjectSummary>(queryKeys.projects(params), '/funding/projects', params));
}

export function useDatasets(params: Params): UseQueryResult<Paged<DatasetSummary>> {
  return useQuery(listQuery<DatasetSummary>(queryKeys.datasets(params), '/datasets', params));
}

// ---------------------------------------------------------------------------
// Search, graph and discovery
// ---------------------------------------------------------------------------

export function useSearch(query: string, enabled = true): UseQueryResult<SearchResults> {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: ({ signal }) => request<SearchResults>('/search', { params: { q: query }, signal }),
    // Two characters is the server-side minimum; querying below it would only
    // produce a validation error.
    enabled: enabled && query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useGraphSample(params: Params): UseQueryResult<GraphView> {
  return useQuery({
    queryKey: queryKeys.graphSample(params),
    queryFn: ({ signal }) => request<GraphView>('/graph/sample', { params, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useGraphExpansion(params: Params, enabled = true): UseQueryResult<GraphView> {
  return useQuery({
    queryKey: queryKeys.graphExpand(params),
    queryFn: ({ signal }) => request<GraphView>('/graph/expand', { params, signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useShortestPath(params: Params, enabled: boolean): UseQueryResult<ShortestPathResponse> {
  return useQuery({
    queryKey: queryKeys.shortestPath(params),
    queryFn: ({ signal }) => request<ShortestPathResponse>('/graph/shortest-path', { params, signal }),
    enabled,
  });
}

export function useNeighbourhood(
  id: string | undefined,
  params: Params,
): UseQueryResult<Paged<NeighbourResult>> {
  return useQuery({
    ...listQuery<NeighbourResult>(
      queryKeys.neighbourhood(id ?? '', params),
      `/graph/neighbourhood/${id}`,
      params,
    ),
    enabled: Boolean(id),
  });
}

/** Researchers ranked by collaboration reach across the whole graph. */
export function useCollaborativeResearchers(
  params: Params,
): UseQueryResult<Paged<CollaborativeResearcher>> {
  return useQuery(
    listQuery<CollaborativeResearcher>(
      queryKeys.collaborativeResearchers(params),
      '/collaboration/researchers',
      params,
    ),
  );
}

export function useCrossDomainCollaborations(
  params: Params,
): UseQueryResult<Paged<CrossDomainCollaboration>> {
  return useQuery(
    listQuery<CrossDomainCollaboration>(
      queryKeys.crossDomain(params),
      '/discovery/cross-domain',
      params,
    ),
  );
}
