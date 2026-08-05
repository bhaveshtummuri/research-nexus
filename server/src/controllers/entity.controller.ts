import { validatedParams, validatedQuery } from '../middleware/validate.js';
import * as discovery from '../services/discovery.service.js';
import {
  authorService,
  fundingService,
  paperService,
  topicService,
  universityService,
  venueService,
} from '../services/index.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolvePagination } from '../utils/pagination.js';
import { listMeta, sendSuccess } from '../utils/response.js';
import type {
  AuthorListQuery,
  ConferenceListQuery,
  DatasetListQuery,
  FundingListQuery,
  JournalListQuery,
  KeywordListQuery,
  PaperListQuery,
  ProjectListQuery,
  TopicListQuery,
  UniversityListQuery,
} from '../validators/schemas.js';

/**
 * Entity controllers.
 *
 * Each handler does three things and stops: read the already-validated input,
 * call a service, send the envelope. No branching on database state and no
 * query construction, which is what keeps the HTTP layer thin enough to read in
 * one sitting.
 */

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export const listAuthors = asyncHandler(async (req, res) => {
  const query = validatedQuery<AuthorListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await authorService.listAuthors(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getAuthor = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendSuccess(res, await authorService.getAuthor(id));
});

export const getAuthorPapers = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  const pagination = resolvePagination(validatedQuery(req));
  const items = await authorService.listAuthorPapers(id, pagination);
  sendSuccess(res, items, listMeta(items, pagination));
});

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

export const listPapers = asyncHandler(async (req, res) => {
  const query = validatedQuery<PaperListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await paperService.listPapers(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getPaper = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendSuccess(res, await paperService.getPaper(id));
});

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

export const listUniversities = asyncHandler(async (req, res) => {
  const query = validatedQuery<UniversityListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await universityService.listUniversities(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getUniversity = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendSuccess(res, await universityService.getUniversity(id));
});

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export const listTopics = asyncHandler(async (req, res) => {
  const query = validatedQuery<TopicListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await topicService.listTopics(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const listTopicFields = asyncHandler(async (_req, res) => {
  sendSuccess(res, await topicService.listTopicFields());
});

/**
 * Topic detail composes three independent traversals: the topic's own document,
 * its related topics, and the experts working on it. Issuing them together
 * keeps the page a single request without forcing one enormous query.
 */
export const getTopic = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);

  const [base, relatedTopics, topExperts] = await Promise.all([
    topicService.getTopicBase(id),
    discovery.findRelatedTopics(id, 12),
    discovery.findExperts(id, 1, { offset: 0, limit: 8 }),
  ]);

  sendSuccess(res, { ...base, relatedTopics, topExperts });
});

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export const listConferences = asyncHandler(async (req, res) => {
  const query = validatedQuery<ConferenceListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await venueService.listConferences(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getConference = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendSuccess(res, await venueService.getConference(id));
});

export const listJournals = asyncHandler(async (req, res) => {
  const query = validatedQuery<JournalListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await venueService.listJournals(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getJournal = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendSuccess(res, await venueService.getJournal(id));
});

// ---------------------------------------------------------------------------
// Funding, projects, datasets, keywords
// ---------------------------------------------------------------------------

export const listFundingAgencies = asyncHandler(async (req, res) => {
  const query = validatedQuery<FundingListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await fundingService.listFundingAgencies(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const getFundingAgency = asyncHandler(async (req, res) => {
  const { id } = validatedParams<{ id: string }>(req);

  const [base, similar] = await Promise.all([
    fundingService.getFundingAgencyBase(id),
    discovery.findSimilarFundingAgencies(id, { limit: 6, minSharedTopics: 1 }),
  ]);

  sendSuccess(res, {
    ...base,
    partnerAgencies: similar.map((entry) => ({
      ...entry.agency,
      sharedTopicCount: entry.sharedTopicCount,
    })),
  });
});

export const listProjects = asyncHandler(async (req, res) => {
  const query = validatedQuery<ProjectListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await fundingService.listProjects(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const listDatasets = asyncHandler(async (req, res) => {
  const query = validatedQuery<DatasetListQuery>(req);
  const pagination = resolvePagination(query);
  const { items, total } = await fundingService.listDatasets(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination, total));
});

export const listKeywords = asyncHandler(async (req, res) => {
  const query = validatedQuery<KeywordListQuery>(req);
  const pagination = resolvePagination(query);
  const items = await fundingService.listKeywords(query, pagination);
  sendSuccess(res, items, listMeta(items, pagination));
});
