import { Router } from 'express';

import * as discovery from '../controllers/discovery.controller.js';
import * as entities from '../controllers/entity.controller.js';
import * as graph from '../controllers/graph.controller.js';
import * as health from '../controllers/health.controller.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../utils/response.js';
import {
  analyticsSchema,
  authorListSchema,
  citationChainSchema,
  citationPathSchema,
  citationTreeSchema,
  collaboratorSchema,
  conferenceListSchema,
  crossDomainSchema,
  datasetListSchema,
  expertSchema,
  fundingListSchema,
  graphExpandSchema,
  graphNodeSchema,
  graphSampleSchema,
  graphSubgraphSchema,
  hiddenCollaboratorSchema,
  idParamSchema,
  influentialPathSchema,
  institutionRankingSchema,
  journalListSchema,
  keywordListSchema,
  multiHopSchema,
  paginationSchema,
  paperListSchema,
  projectListSchema,
  rankingSchema,
  recommendationSchema,
  relatedTopicSchema,
  researcherListSchema,
  searchSchema,
  shortestPathSchema,
  similaritySchema,
  topicListSchema,
  topicSimilaritySchema,
  trendingSchema,
  universityListSchema,
} from '../validators/schemas.js';

/**
 * API surface.
 *
 * Routes are grouped by resource and every one of them is preceded by its
 * validation middleware, so the route table doubles as the API's contract: what
 * a caller may send is visible next to where it is handled.
 */
export function createApiRouter(): Router {
  const router = Router();

  const withId = validate(idParamSchema, 'params');

  // --- health ---------------------------------------------------------------
  router.get('/health', health.getLiveness);
  router.get('/health/ready', health.getReadiness);
  router.get('/health/database', health.getDatabaseStatus);

  // --- authors --------------------------------------------------------------
  router.get('/authors', validate(authorListSchema), entities.listAuthors);
  router.get('/authors/:id', withId, entities.getAuthor);
  router.get('/authors/:id/papers', withId, validate(paginationSchema), entities.getAuthorPapers);
  router.get(
    '/authors/:id/collaborators',
    withId,
    validate(collaboratorSchema),
    discovery.getCollaborators,
  );
  router.get(
    '/authors/:id/hidden-collaborators',
    withId,
    validate(hiddenCollaboratorSchema),
    discovery.getHiddenCollaborators,
  );
  router.get(
    '/authors/:id/recommendations',
    withId,
    validate(recommendationSchema),
    discovery.getAuthorRecommendations,
  );

  // --- papers ---------------------------------------------------------------
  router.get('/papers', validate(paperListSchema), entities.listPapers);
  router.get('/papers/:id', withId, entities.getPaper);
  router.get(
    '/papers/:id/similar',
    withId,
    validate(recommendationSchema),
    discovery.getSimilarPapers,
  );
  router.get(
    '/papers/:id/citation-chains',
    withId,
    validate(citationChainSchema),
    graph.getCitationChains,
  );
  router.get('/papers/:id/citation-tree', withId, validate(citationTreeSchema), graph.getCitationTree);
  router.get(
    '/papers/:id/influential-citations',
    withId,
    validate(influentialPathSchema),
    graph.getInfluentialCitationPaths,
  );

  // --- universities ---------------------------------------------------------
  router.get('/universities', validate(universityListSchema), entities.listUniversities);
  router.get('/universities/:id', withId, entities.getUniversity);
  router.get(
    '/universities/:id/similar',
    withId,
    validate(similaritySchema),
    discovery.getSimilarUniversities,
  );

  // --- topics ---------------------------------------------------------------
  router.get('/topics', validate(topicListSchema), entities.listTopics);
  router.get('/topics/fields', entities.listTopicFields);
  router.get('/topics/trending', validate(trendingSchema), discovery.getTrendingTopics);
  router.get('/topics/:id', withId, entities.getTopic);
  router.get('/topics/:id/experts', withId, validate(expertSchema), discovery.getExperts);
  router.get('/topics/:id/related', withId, validate(relatedTopicSchema), discovery.getRelatedTopics);
  router.get(
    '/topics/:id/similar',
    withId,
    validate(topicSimilaritySchema),
    discovery.getSimilarTopics,
  );

  // --- venues ---------------------------------------------------------------
  router.get('/conferences', validate(conferenceListSchema), entities.listConferences);
  router.get('/conferences/:id', withId, entities.getConference);
  router.get('/journals', validate(journalListSchema), entities.listJournals);
  router.get('/journals/:id', withId, entities.getJournal);

  // --- funding, projects, datasets, keywords --------------------------------
  router.get('/funding/agencies', validate(fundingListSchema), entities.listFundingAgencies);
  router.get('/funding/agencies/:id', withId, entities.getFundingAgency);
  router.get(
    '/funding/agencies/:id/similar',
    withId,
    validate(similaritySchema),
    discovery.getSimilarFundingAgencies,
  );
  router.get('/funding/projects', validate(projectListSchema), entities.listProjects);
  router.get('/datasets', validate(datasetListSchema), entities.listDatasets);
  router.get('/keywords', validate(keywordListSchema), entities.listKeywords);
  router.get('/keywords/:id/papers', withId, validate(paginationSchema), graph.papersByKeyword);

  // --- graph ----------------------------------------------------------------
  router.get('/graph', validate(graphSampleSchema), graph.getGraphSample);
  router.get('/graph/sample', validate(graphSampleSchema), graph.getGraphSample);
  router.get('/graph/author/:id', withId, validate(graphNodeSchema), graph.expandGraphNodeById);
  router.get('/graph/paper/:id', withId, validate(graphNodeSchema), graph.expandGraphNodeById);
  router.get('/graph/expand', validate(graphExpandSchema), graph.expandGraphNode);
  router.get('/graph/subgraph', validate(graphSubgraphSchema), graph.getSubgraph);
  router.get('/graph/shortest-path', validate(shortestPathSchema), graph.getShortestPath);
  router.get(
    '/graph/neighbourhood/:id',
    withId,
    validate(multiHopSchema),
    graph.getMultiHopNeighbourhood,
  );

  // --- recommendations (spec-shaped aliases) --------------------------------
  // The canonical routes are nested under the resource they belong to; these
  // give the same handlers a flat, verb-first shape for clients that prefer it.
  router.get(
    '/recommendations/papers/:id',
    withId,
    validate(recommendationSchema),
    discovery.getSimilarPapers,
  );
  router.get(
    '/recommendations/authors/:id',
    withId,
    validate(recommendationSchema),
    discovery.getAuthorRecommendations,
  );

  // --- collaboration --------------------------------------------------------
  router.get('/collaboration/path', validate(shortestPathSchema), graph.getShortestPath);
  // Without an id: the most connected researchers across the whole graph.
  // With one: that researcher's own collaboration neighbourhood.
  router.get(
    '/collaboration/researchers',
    validate(researcherListSchema),
    discovery.getMostCollaborativeResearchers,
  );
  router.get(
    '/collaboration/researchers/:id',
    withId,
    validate(collaboratorSchema),
    discovery.getCollaborators,
  );
  router.get(
    '/collaboration/hidden/:id',
    withId,
    validate(hiddenCollaboratorSchema),
    discovery.getHiddenCollaborators,
  );
  router.get(
    '/collaboration/cross-domain',
    validate(crossDomainSchema),
    discovery.getCrossDomainCollaborations,
  );

  // --- citations ------------------------------------------------------------
  // Same handler as `/collaboration/path`, but `mode` defaults to `citation`
  // so this route traverses CITES rather than COLLABORATED_WITH.
  router.get('/citations/path', validate(citationPathSchema), graph.getShortestPath);
  router.get('/citations/:id', withId, validate(citationChainSchema), graph.getCitationChains);

  // --- discovery ------------------------------------------------------------
  router.get('/discovery/cross-domain', validate(crossDomainSchema), discovery.getCrossDomainCollaborations);

  // --- search ---------------------------------------------------------------
  router.get('/search', validate(searchSchema), graph.globalSearch);

  // --- analytics ------------------------------------------------------------
  router.get('/analytics/dashboard', validate(analyticsSchema), graph.getAnalyticsSummary);
  router.get('/analytics/summary', validate(analyticsSchema), graph.getAnalyticsSummary);
  router.get('/analytics/trending-topics', validate(trendingSchema), discovery.getTrendingTopics);
  router.get('/analytics/popular-authors', validate(recommendationSchema), graph.getPopularAuthors);
  router.get('/analytics/most-cited-papers', validate(rankingSchema), graph.getMostCitedPapers);
  router.get(
    '/analytics/connected-keywords',
    validate(rankingSchema),
    graph.getMostConnectedKeywords,
  );
  router.get('/analytics/funded-areas', validate(rankingSchema), graph.getMostFundedResearchAreas);
  router.get(
    '/analytics/collaborative-institutions',
    validate(institutionRankingSchema),
    graph.getMostCollaborativeInstitutions,
  );
  router.get('/analytics/overview', graph.getGraphOverview);
  router.get('/analytics/totals', graph.getDashboardTotals);

  // --- discoverability ------------------------------------------------------
  router.get('/', (_req, res) => {
    sendSuccess(res, {
      name: 'Research Nexus API',
      version: '1.0.0',
      documentation: 'https://github.com/research-nexus/research-nexus#api-documentation',
      resources: [
        'authors',
        'papers',
        'universities',
        'topics',
        'conferences',
        'journals',
        'funding',
        'datasets',
        'keywords',
        'graph',
        'discovery',
        'search',
        'analytics',
        'health',
      ],
    });
  });

  return router;
}
