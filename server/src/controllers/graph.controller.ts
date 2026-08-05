import { validatedParams, validatedQuery } from '../middleware/validate.js';
import * as analytics from '../services/analytics.service.js';
import * as graph from '../services/graph.service.js';
import * as paths from '../services/path.service.js';
import * as search from '../services/search.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePagination } from '../utils/pagination.js';
import { listMeta, sendSuccess } from '../utils/response.js';
import type {
  AnalyticsQuery,
  CitationChainQuery,
  CitationTreeQuery,
  GraphExpandQuery,
  GraphNodeQuery,
  InfluentialPathQuery,
  InstitutionRankingQuery,
  MultiHopQuery,
  RankingQuery,
  SearchQuery,
  ShortestPathQuery,
} from '../validators/schemas.js';

// ---------------------------------------------------------------------------
// Graph visualisation
// ---------------------------------------------------------------------------

export const getGraphSample = asyncHandler(async (req, res) => {
  const { limit } = validatedQuery<{ limit: number }>(req);
  sendSuccess(res, await graph.sampleGraph(limit));
});

export const expandGraphNode = asyncHandler(async (req, res) => {
  const query = validatedQuery<GraphExpandQuery>(req);
  sendSuccess(
    res,
    await graph.expandNeighbourhood({
      startId: query.id,
      depth: query.depth,
      limit: query.limit,
      relationshipTypes: query.types,
    }),
  );
});

/**
 * Neighbourhood expansion where the entity id is a path parameter.
 *
 * Backs `/graph/author/:id` and `/graph/paper/:id`. The traversal is identical
 * regardless of label — the label only shapes what comes back — so one handler
 * serves both routes.
 */
export const expandGraphNodeById = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<GraphNodeQuery>(req);

  sendSuccess(
    res,
    await graph.expandNeighbourhood({
      startId: id,
      depth: query.depth,
      limit: query.limit,
      relationshipTypes: query.types,
    }),
  );
});

export const getSubgraph = asyncHandler(async (req, res) => {
  const { ids } = validatedQuery<{ ids: string[] }>(req);
  sendSuccess(res, await graph.subgraphForIds(ids));
});

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Returns the discovered route together with a renderable subgraph.
 *
 * The client needs both: the ordered path to narrate the connection, and a node
 * and edge set to draw it. Building the subgraph here means the visualiser can
 * render a result without a second round trip.
 */
export const getShortestPath = asyncHandler(async (req, res) => {
  const query = validatedQuery<ShortestPathQuery>(req);

  const result = await paths.findShortestPath({
    fromId: query.from,
    toId: query.to,
    mode: query.mode,
    maxDepth: query.maxDepth,
    all: query.all,
  });

  const nodeIds = [...new Set(result.paths.flatMap((path) => path.nodes.map((node) => node.id)))];
  const subgraph = nodeIds.length > 0 ? await graph.subgraphForIds(nodeIds) : null;

  sendSuccess(
    res,
    { ...result, graph: subgraph },
    { mode: query.mode, maxDepth: query.maxDepth, pathCount: result.paths.length },
  );
});

export const getCitationChains = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<CitationChainQuery>(req);

  const items = await paths.findCitationChains({ paperId: id, ...query });
  sendSuccess(res, items, { count: items.length, direction: query.direction, depth: query.depth });
});

/**
 * The citation tree, flattened.
 *
 * `roots` names the nodes whose parent is the requested paper, so a client can
 * start rendering without first scanning the list to find the top level.
 */
export const getCitationTree = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<CitationTreeQuery>(req);

  const nodes = await paths.findCitationTree({ paperId: id, ...query });
  const maxDepth = nodes.reduce((deepest, node) => Math.max(deepest, node.depth), 0);

  sendSuccess(res, nodes, {
    count: nodes.length,
    rootId: id,
    direction: query.direction,
    maxDepth,
    roots: nodes.filter((node) => node.parentId === id).map((node) => node.id),
  });
});

export const getInfluentialCitationPaths = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<InfluentialPathQuery>(req);

  const items = await paths.findInfluentialCitationPaths({ paperId: id, ...query });
  sendSuccess(res, items, { count: items.length, ranking: 'accumulated-citations' });
});

export const getMultiHopNeighbourhood = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<MultiHopQuery>(req);

  const items = await paths.findMultiHopNeighbourhood({ startId: id, ...query });
  sendSuccess(res, items, { count: items.length, depth: query.depth });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const globalSearch = asyncHandler(async (req, res) => {
  const { q, perLabel } = validatedQuery<SearchQuery>(req);
  sendSuccess(res, await search.search(q, perLabel));
});

export const papersByKeyword = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const pagination = resolvePagination(validatedQuery(req));

  const items = await search.findPapersByKeyword(id, pagination);
  sendSuccess(res, items, listMeta(items, pagination));
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const query = validatedQuery<AnalyticsQuery>(req);
  sendSuccess(res, await analytics.getAnalyticsSummary(query));
});

export const getPopularAuthors = asyncHandler(async (req, res) => {
  const { limit } = validatedQuery<{ limit: number }>(req);
  const items = await analytics.getPopularAuthors(limit);
  sendSuccess(res, items, { count: items.length, ranking: 'citations-then-h-index' });
});

export const getMostCitedPapers = asyncHandler(async (req, res) => {
  const query = validatedQuery<RankingQuery>(req);
  const items = await analytics.getMostCitedPapers(query);
  sendSuccess(res, items, { count: items.length, ranking: 'incoming-cites-edges' });
});

export const getMostConnectedKeywords = asyncHandler(async (req, res) => {
  const { limit } = validatedQuery<RankingQuery>(req);
  const items = await analytics.getMostConnectedKeywords(limit);
  sendSuccess(res, items, { count: items.length, ranking: 'keyword-co-occurrence-degree' });
});

export const getMostFundedResearchAreas = asyncHandler(async (req, res) => {
  const query = validatedQuery<RankingQuery>(req);
  const items = await analytics.getMostFundedResearchAreas(query);
  sendSuccess(res, items, { count: items.length, ranking: 'total-awarded-usd' });
});

export const getMostCollaborativeInstitutions = asyncHandler(async (req, res) => {
  const query = validatedQuery<InstitutionRankingQuery>(req);
  const items = await analytics.getMostCollaborativeInstitutions(query);
  sendSuccess(res, items, { count: items.length, ranking: 'distinct-partner-institutions' });
});

export const getGraphOverview = asyncHandler(async (_req, res) => {
  sendSuccess(res, await analytics.getGraphOverview());
});

export const getDashboardTotals = asyncHandler(async (_req, res) => {
  sendSuccess(res, await analytics.getDashboardTotals());
});
