import { validatedParams, validatedQuery } from '../middleware/validate.js';
import * as discovery from '../services/discovery.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePagination } from '../utils/pagination.js';
import { listMeta, sendSuccess } from '../utils/response.js';
import type {
  CrossDomainQuery,
  HiddenCollaboratorQuery,
  ResearcherListQuery,
  SimilarityQuery,
  TopicSimilarityQuery,
  TrendingQuery,
} from '../validators/schemas.js';

/**
 * Discovery controllers.
 *
 * Every endpoint here returns ranked results with the weights that produced
 * them echoed in `meta`, so a reviewer can see exactly why an item scored where
 * it did rather than having to trust the number.
 */

export const getCollaborators = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<{ depth: number; offset?: number; limit?: number }>(req);
  const pagination = resolvePagination(query);

  const items = await discovery.findCollaboratorsWithinHops(id, query.depth, pagination);
  sendSuccess(res, items, { ...listMeta(items, pagination), depth: query.depth });
});

export const getHiddenCollaborators = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<HiddenCollaboratorQuery>(req);
  const pagination = resolvePagination(query);

  const items = await discovery.findHiddenCollaborators(
    id,
    { minSharedTopics: query.minSharedTopics, minSharedKeywords: query.minSharedKeywords },
    pagination,
  );

  sendSuccess(res, items, {
    ...listMeta(items, pagination),
    minSharedTopics: query.minSharedTopics,
    minSharedKeywords: query.minSharedKeywords,
    weights: discovery.SIMILARITY_WEIGHTS,
  });
});

export const getSimilarTopics = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<TopicSimilarityQuery>(req);

  const items = await discovery.findSimilarTopicsByKeyword(id, query);
  sendSuccess(res, items, {
    count: items.length,
    metric: 'jaccard-keyword-overlap',
    minSharedKeywords: query.minSharedKeywords,
  });
});

export const getMostCollaborativeResearchers = asyncHandler(async (req, res) => {
  const query = validatedQuery<ResearcherListQuery>(req);
  const pagination = resolvePagination(query);

  const items = await discovery.findMostCollaborativeResearchers(
    { minPartners: query.minPartners, field: query.field },
    pagination,
  );

  sendSuccess(res, items, {
    ...listMeta(items, pagination),
    minPartners: query.minPartners,
    weights: discovery.COLLABORATION_WEIGHTS,
  });
});

export const getSimilarPapers = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const { limit } = validatedQuery<{ limit: number }>(req);

  const items = await discovery.recommendSimilarPapers(id, limit);
  sendSuccess(res, items, { count: items.length, weights: discovery.SIMILARITY_WEIGHTS });
});

export const getAuthorRecommendations = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const { limit } = validatedQuery<{ limit: number }>(req);

  const items = await discovery.recommendPapersForAuthor(id, limit);
  sendSuccess(res, items, { count: items.length, weights: discovery.SIMILARITY_WEIGHTS });
});

export const getExperts = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<{ minPapers: number; offset?: number; limit?: number }>(req);
  const pagination = resolvePagination(query);

  const items = await discovery.findExperts(id, query.minPapers, pagination);
  sendSuccess(res, items, {
    ...listMeta(items, pagination),
    weights: discovery.EXPERTISE_WEIGHTS,
  });
});

export const getRelatedTopics = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const { limit } = validatedQuery<{ limit: number }>(req);

  const items = await discovery.findRelatedTopics(id, limit);
  sendSuccess(res, items, { count: items.length });
});

export const getTrendingTopics = asyncHandler(async (req, res) => {
  const query = validatedQuery<TrendingQuery>(req);
  const items = await discovery.findTrendingTopics(query);
  sendSuccess(res, items, { count: items.length, windowYears: query.windowYears });
});

export const getSimilarUniversities = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<SimilarityQuery>(req);

  const items = await discovery.findSimilarUniversities(id, query);
  sendSuccess(res, items, { count: items.length, metric: 'jaccard-topic-overlap' });
});

export const getSimilarFundingAgencies = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const query = validatedQuery<SimilarityQuery>(req);

  const items = await discovery.findSimilarFundingAgencies(id, query);
  sendSuccess(res, items, { count: items.length, metric: 'jaccard-topic-overlap' });
});

export const getCrossDomainCollaborations = asyncHandler(async (req, res) => {
  const query = validatedQuery<CrossDomainQuery>(req);
  const items = await discovery.findCrossDomainCollaborations(query);
  sendSuccess(res, items, { count: items.length });
});
