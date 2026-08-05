import { z } from 'zod';

import { config } from '../config/index.js';
import { NODE_LABELS, RELATIONSHIP_TYPES } from '../types/domain.js';

/**
 * Request schemas.
 *
 * Query strings arrive as strings, so numeric fields use `z.coerce`. Every
 * parsed value is bounded here rather than in the service: by the time a
 * handler runs, `limit`, `depth` and year ranges are already inside the limits
 * the graph queries were designed for.
 */

const positiveInt = z.coerce.number().int().min(0);

export const paginationSchema = z.object({
  offset: positiveInt.max(100_000).optional(),
  limit: z.coerce.number().int().min(1).max(config.limits.maxPageSize).optional(),
});

export const idParamSchema = z.object({
  id: z
    .string()
    .min(1, 'An entity id is required')
    .max(64)
    .regex(/^[a-z0-9-]+$/i, 'Entity ids contain letters, digits and hyphens only'),
});

export const authorListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  minHIndex: positiveInt.max(500).optional(),
  sort: z.enum(['hIndex', 'citations', 'papers']).optional().default('hIndex'),
});

export const paperListSchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  fromYear: z.coerce.number().int().min(1900).max(2100).optional(),
  toYear: z.coerce.number().int().min(1900).max(2100).optional(),
  minCitations: positiveInt.max(1_000_000).optional(),
  sort: z.enum(['citations', 'year', 'references']).optional().default('citations'),
});

export const universityListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  sort: z.enum(['ranking', 'researchers', 'name']).optional().default('ranking'),
});

export const topicListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  field: z.string().trim().max(80).optional(),
  sort: z.enum(['papers', 'recent']).optional().default('papers'),
});

export const conferenceListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  field: z.string().trim().max(80).optional(),
  tier: z.enum(['A*', 'A', 'B']).optional(),
  sort: z.enum(['papers', 'founded']).optional().default('papers'),
});

export const journalListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  field: z.string().trim().max(80).optional(),
  minImpactFactor: z.coerce.number().min(0).max(500).optional(),
  sort: z.enum(['impact', 'papers']).optional().default('impact'),
});

export const fundingListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  type: z
    .enum(['Government', 'Supranational', 'Private Foundation', 'Industry Consortium'])
    .optional(),
  sort: z.enum(['awarded', 'budget', 'projects']).optional().default('awarded'),
});

export const projectListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['Active', 'Completed', 'Planned']).optional(),
  sort: z.enum(['budget', 'start']).optional().default('budget'),
});

export const datasetListSchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  domain: z.string().trim().max(80).optional(),
  sort: z.enum(['papers', 'size', 'recent']).optional().default('papers'),
});

export const keywordListSchema = paginationSchema.extend({
  search: z.string().trim().max(80).optional(),
});

export const searchSchema = z.object({
  q: z.string().trim().min(2, 'Enter at least two characters').max(120),
  perLabel: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const depthSchema = z.object({
  depth: z.coerce.number().int().min(1).max(config.limits.maxTraversalDepth).optional(),
});

export const collaboratorSchema = paginationSchema.extend({
  depth: z.coerce.number().int().min(1).max(config.limits.maxTraversalDepth).optional().default(2),
});

export const hiddenCollaboratorSchema = paginationSchema.extend({
  minSharedTopics: positiveInt.max(20).optional().default(1),
  minSharedKeywords: positiveInt.max(50).optional().default(2),
});

export const topicSimilaritySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  minSharedKeywords: z.coerce.number().int().min(1).max(50).optional().default(2),
});

export const citationTreeSchema = z.object({
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
  depth: z.coerce.number().int().min(1).max(4).optional().default(3),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const influentialPathSchema = z.object({
  depth: z.coerce.number().int().min(1).max(5).optional().default(4),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export const rankingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  fromYear: z.coerce.number().int().min(1900).max(2100).optional(),
});

export const institutionRankingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  country: z.string().trim().max(80).optional(),
});

export const expertSchema = paginationSchema.extend({
  minPapers: z.coerce.number().int().min(1).max(50).optional().default(1),
});

export const recommendationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const relatedTopicSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

export const similaritySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  minSharedTopics: z.coerce.number().int().min(1).max(50).optional().default(2),
});

export const crossDomainSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
  minPapers: z.coerce.number().int().min(1).max(100).optional().default(2),
  field: z.string().trim().max(80).optional(),
});

export const trendingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  windowYears: z.coerce.number().int().min(1).max(10).optional().default(3),
  minRecentPapers: z.coerce.number().int().min(1).max(100).optional().default(3),
});

export const shortestPathSchema = z.object({
  from: idParamSchema.shape.id,
  to: idParamSchema.shape.id,
  mode: z.enum(['collaboration', 'citation', 'any']).optional().default('collaboration'),
  maxDepth: z.coerce.number().int().min(1).max(8).optional().default(6),
  all: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
});

/**
 * `/citations/path` is the same traversal with a different default: a caller
 * asking a citation endpoint for a path means citation edges unless they say
 * otherwise, and defaulting to collaboration there would silently answer a
 * different question.
 */
export const citationPathSchema = shortestPathSchema.extend({
  mode: z.enum(['collaboration', 'citation', 'any']).optional().default('citation'),
});

export const researcherListSchema = paginationSchema.extend({
  minPartners: z.coerce.number().int().min(1).max(500).optional().default(2),
  field: z.string().trim().max(80).optional(),
});

export const citationChainSchema = z.object({
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
  depth: z.coerce.number().int().min(1).max(5).optional().default(3),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
});

export const multiHopSchema = z.object({
  depth: z.coerce.number().int().min(1).max(config.limits.maxTraversalDepth).optional().default(2),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  labels: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry): entry is (typeof NODE_LABELS)[number] =>
              (NODE_LABELS as readonly string[]).includes(entry),
            )
        : undefined,
    ),
});

export const graphExpandSchema = z.object({
  id: idParamSchema.shape.id,
  depth: z.coerce.number().int().min(1).max(3).optional().default(1),
  limit: z.coerce.number().int().min(5).max(config.limits.maxGraphNodes).optional().default(80),
  types: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((entry) => entry.trim().toUpperCase())
            .filter((entry): entry is (typeof RELATIONSHIP_TYPES)[number] =>
              (RELATIONSHIP_TYPES as readonly string[]).includes(entry),
            )
        : undefined,
    ),
});

/** Expansion around an entity whose id comes from the path, not the query. */
export const graphNodeSchema = z.object({
  depth: z.coerce.number().int().min(1).max(3).optional().default(1),
  limit: z.coerce.number().int().min(5).max(config.limits.maxGraphNodes).optional().default(80),
  types: graphExpandSchema.shape.types,
});

export const graphSampleSchema = z.object({
  limit: z.coerce.number().int().min(10).max(config.limits.maxGraphNodes).optional().default(80),
});

export const graphSubgraphSchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, config.limits.maxGraphNodes),
    ),
});

export const analyticsSchema = z.object({
  fromYear: z.coerce.number().int().min(1900).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(8),
});

export type AuthorListQuery = z.infer<typeof authorListSchema>;
export type PaperListQuery = z.infer<typeof paperListSchema>;
export type UniversityListQuery = z.infer<typeof universityListSchema>;
export type TopicListQuery = z.infer<typeof topicListSchema>;
export type ConferenceListQuery = z.infer<typeof conferenceListSchema>;
export type JournalListQuery = z.infer<typeof journalListSchema>;
export type FundingListQuery = z.infer<typeof fundingListSchema>;
export type ProjectListQuery = z.infer<typeof projectListSchema>;
export type DatasetListQuery = z.infer<typeof datasetListSchema>;
export type KeywordListQuery = z.infer<typeof keywordListSchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
export type ShortestPathQuery = z.infer<typeof shortestPathSchema>;
export type CitationPathQuery = z.infer<typeof citationPathSchema>;
export type ResearcherListQuery = z.infer<typeof researcherListSchema>;
export type HiddenCollaboratorQuery = z.infer<typeof hiddenCollaboratorSchema>;
export type TopicSimilarityQuery = z.infer<typeof topicSimilaritySchema>;
export type CitationTreeQuery = z.infer<typeof citationTreeSchema>;
export type InfluentialPathQuery = z.infer<typeof influentialPathSchema>;
export type RankingQuery = z.infer<typeof rankingSchema>;
export type InstitutionRankingQuery = z.infer<typeof institutionRankingSchema>;
export type CitationChainQuery = z.infer<typeof citationChainSchema>;
export type MultiHopQuery = z.infer<typeof multiHopSchema>;
export type GraphExpandQuery = z.infer<typeof graphExpandSchema>;
export type TrendingQuery = z.infer<typeof trendingSchema>;
export type CrossDomainQuery = z.infer<typeof crossDomainSchema>;
export type SimilarityQuery = z.infer<typeof similaritySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsSchema>;

export type GraphNodeQuery = z.infer<typeof graphNodeSchema>;
