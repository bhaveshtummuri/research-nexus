import {
  FIND_COLLABORATORS_WITHIN_HOPS,
  FIND_CROSS_DOMAIN_COLLABORATIONS,
  FIND_EXPERTS_FOR_TOPIC,
  FIND_HIDDEN_COLLABORATORS,
  FIND_RELATED_TOPICS,
  FIND_SIMILAR_FUNDING_AGENCIES,
  FIND_SIMILAR_TOPICS_BY_KEYWORD,
  FIND_SIMILAR_UNIVERSITIES,
  FIND_TRENDING_TOPICS,
  MOST_COLLABORATIVE_RESEARCHERS,
  RECOMMEND_PAPERS_FOR_AUTHOR,
  RECOMMEND_SIMILAR_PAPERS,
} from '../cypher/index.js';
import {
  column,
  mapCollaborativeResearcher,
  mapCrossDomainCollaboration,
  mapExpertSummary,
  mapFundingAgencySummary,
  mapHiddenCollaborator,
  mapScoredPaper,
  mapTopicRef,
  mapTopicSimilarity,
  mapTopicSummary,
  mapUniversitySummary,
  round,
} from '../database/mappers.js';
import { runRead } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  CollaborativeResearcher,
  CrossDomainCollaboration,
  ExpertSummary,
  FundingSimilarity,
  HiddenCollaborator,
  ScoredPaper,
  TopicDetail,
  TopicSimilarity,
  TrendingTopic,
  UniversitySimilarity,
} from '../types/domain.js';
import type { Pagination } from '../utils/pagination.js';

/**
 * Discovery services.
 *
 * The scoring weights live here rather than inside the Cypher so they can be
 * tuned - and explained - without touching a query. Each weight is passed as a
 * driver parameter, so changing one never invalidates the cached query plan.
 */

export const SIMILARITY_WEIGHTS = Object.freeze({
  /** A shared topic is the strongest single signal of subject overlap. */
  topic: 3,
  /** Keywords are finer-grained but noisier, so they carry less weight. */
  keyword: 1.5,
  /** Co-citation: the community already treats the two papers as related. */
  coCitation: 2.5,
  /** Bibliographic coupling: they build on the same prior work. */
  coupling: 2,
  /** A paper written by someone you publish with is worth surfacing. */
  collaborator: 2,
  /** Mutual collaborators, used when ranking hidden collaborators. */
  bridge: 1.5,
  /** Co-authorship is the strongest evidence of a working relationship. */
  sharedPaper: 4,
  /** Inverse hop distance, so a direct collaborator outranks a distant one. */
  proximity: 5,
});

/**
 * Reach beats volume: an extra institution in a researcher's network counts for
 * more than an extra co-author inside one they already work with.
 */
export const COLLABORATION_WEIGHTS = Object.freeze({
  partner: 1,
  institution: 2.5,
});

export const EXPERTISE_WEIGHTS = Object.freeze({
  paper: 2,
  /** Citations are logged before weighting so one famous paper cannot dominate. */
  citation: 3,
  focus: 8,
  hIndex: 0.4,
});

// ---------------------------------------------------------------------------
// Collaboration discovery
// ---------------------------------------------------------------------------

export async function findCollaboratorsWithinHops(
  authorId: string,
  maxDepth: number,
  pagination: Pagination,
): Promise<HiddenCollaborator[]> {
  return runRead(
    FIND_COLLABORATORS_WITHIN_HOPS,
    {
      authorId,
      maxDepth,
      proximityWeight: SIMILARITY_WEIGHTS.proximity,
      paperWeight: SIMILARITY_WEIGHTS.sharedPaper,
      topicWeight: SIMILARITY_WEIGHTS.topic,
      keywordWeight: SIMILARITY_WEIGHTS.keyword,
      ...pagination,
    },
    (record) => mapHiddenCollaborator(column(record, 'collaborator')),
  );
}

/**
 * Candidates qualify on *either* threshold, not both: two researchers sharing a
 * dozen keywords but no formal topic are exactly the pairing this query exists
 * to surface, and an AND would discard them.
 */
export async function findHiddenCollaborators(
  authorId: string,
  options: { minSharedTopics: number; minSharedKeywords: number },
  pagination: Pagination,
): Promise<HiddenCollaborator[]> {
  return runRead(
    FIND_HIDDEN_COLLABORATORS,
    {
      authorId,
      minSharedTopics: options.minSharedTopics,
      minSharedKeywords: options.minSharedKeywords,
      bridgeWeight: SIMILARITY_WEIGHTS.bridge,
      topicWeight: SIMILARITY_WEIGHTS.topic,
      keywordWeight: SIMILARITY_WEIGHTS.keyword,
      ...pagination,
    },
    (record) => mapHiddenCollaborator(column(record, 'collaborator')),
  );
}

/**
 * Researchers ranked by collaboration reach across the whole graph.
 *
 * Unlike the other collaboration queries this one takes no anchor author — it
 * answers "who connects this research community" rather than "who is near this
 * person", which is what makes it useful as a landing view.
 */
export async function findMostCollaborativeResearchers(
  options: { minPartners: number; field?: string | undefined },
  pagination: Pagination,
): Promise<CollaborativeResearcher[]> {
  return runRead(
    MOST_COLLABORATIVE_RESEARCHERS,
    {
      minPartners: options.minPartners,
      field: options.field ?? null,
      partnerWeight: COLLABORATION_WEIGHTS.partner,
      institutionWeight: COLLABORATION_WEIGHTS.institution,
      ...pagination,
    },
    (record) => mapCollaborativeResearcher(column(record, 'researcher')),
  );
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export async function recommendSimilarPapers(
  paperId: string,
  limit: number,
): Promise<ScoredPaper[]> {
  return runRead(
    RECOMMEND_SIMILAR_PAPERS,
    {
      paperId,
      limit,
      topicWeight: SIMILARITY_WEIGHTS.topic,
      keywordWeight: SIMILARITY_WEIGHTS.keyword,
      coCitationWeight: SIMILARITY_WEIGHTS.coCitation,
      couplingWeight: SIMILARITY_WEIGHTS.coupling,
    },
    (record) => mapScoredPaper(column(record, 'paper')),
  );
}

export async function recommendPapersForAuthor(
  authorId: string,
  limit: number,
): Promise<ScoredPaper[]> {
  return runRead(
    RECOMMEND_PAPERS_FOR_AUTHOR,
    {
      authorId,
      limit,
      topicWeight: SIMILARITY_WEIGHTS.topic,
      collaboratorWeight: SIMILARITY_WEIGHTS.collaborator,
      couplingWeight: SIMILARITY_WEIGHTS.coupling,
    },
    (record) => mapScoredPaper(column(record, 'paper')),
  );
}

// ---------------------------------------------------------------------------
// Expertise
// ---------------------------------------------------------------------------

export async function findExperts(
  topicId: string,
  minPapers: number,
  pagination: Pagination,
): Promise<ExpertSummary[]> {
  return runRead(
    FIND_EXPERTS_FOR_TOPIC,
    {
      topicId,
      minPapers,
      paperWeight: EXPERTISE_WEIGHTS.paper,
      citationWeight: EXPERTISE_WEIGHTS.citation,
      focusWeight: EXPERTISE_WEIGHTS.focus,
      hIndexWeight: EXPERTISE_WEIGHTS.hIndex,
      ...pagination,
    },
    (record) => mapExpertSummary(column(record, 'expert')),
  );
}

// ---------------------------------------------------------------------------
// Topic relationships
// ---------------------------------------------------------------------------

export async function findRelatedTopics(
  topicId: string,
  limit: number,
): Promise<TopicDetail['relatedTopics']> {
  return runRead(FIND_RELATED_TOPICS, { topicId, limit }, (record) => {
    const source = column(record, 'related') as Record<string, unknown>;
    return {
      ...mapTopicRef(source),
      strength: round(toNumber(source.strength), 3),
      connectionKind: source.connectionKind === 'direct' ? 'direct' : 'inferred',
    };
  });
}

/**
 * Topics similar by shared keyword vocabulary.
 *
 * Complements `findRelatedTopics`, which requires co-occurrence on a paper.
 * This one reaches topics that share no publication at all.
 */
export async function findSimilarTopicsByKeyword(
  topicId: string,
  options: { limit: number; minSharedKeywords: number },
): Promise<TopicSimilarity[]> {
  return runRead(
    FIND_SIMILAR_TOPICS_BY_KEYWORD,
    { topicId, limit: options.limit, minSharedKeywords: options.minSharedKeywords },
    (record) => mapTopicSimilarity(column(record, 'topic')),
  );
}

export async function findTrendingTopics(options: {
  limit: number;
  windowYears: number;
  minRecentPapers: number;
}): Promise<TrendingTopic[]> {
  const currentYear = new Date().getFullYear();
  // The comparison window ends at the newest publication year in the dataset,
  // so the trend stays meaningful even when the graph is not refreshed daily.
  const recentFromYear = currentYear - options.windowYears;
  const priorFromYear = recentFromYear - options.windowYears;

  return runRead(
    FIND_TRENDING_TOPICS,
    {
      limit: options.limit,
      minRecentPapers: options.minRecentPapers,
      recentFromYear,
      priorFromYear,
    },
    (record) => {
      const source = column(record, 'topic') as Record<string, unknown>;
      return {
        ...mapTopicSummary(source),
        recentPaperCount: toNumber(source.recentPaperCount),
        priorPaperCount: toNumber(source.priorPaperCount),
        growthRate: round(toNumber(source.growthRate), 2),
        momentum: round(toNumber(source.momentum), 3),
        topAuthors: Array.isArray(source.topAuthors)
          ? source.topAuthors.map((entry) => {
              const author = entry as Record<string, unknown>;
              return { id: String(author.id ?? ''), name: String(author.name ?? '') };
            })
          : [],
      } satisfies TrendingTopic;
    },
  );
}

// ---------------------------------------------------------------------------
// Institutional and funding similarity
// ---------------------------------------------------------------------------

export async function findSimilarUniversities(
  universityId: string,
  options: { limit: number; minSharedTopics: number },
): Promise<UniversitySimilarity[]> {
  return runRead(FIND_SIMILAR_UNIVERSITIES, { universityId, ...options }, (record) => {
    const source = column(record, 'row') as Record<string, unknown>;
    return {
      university: mapUniversitySummary(source.university),
      sharedTopicCount: toNumber(source.sharedTopicCount),
      similarity: round(toNumber(source.similarity), 3),
      sharedTopics: Array.isArray(source.sharedTopics)
        ? source.sharedTopics.map(mapTopicRef)
        : [],
    } satisfies UniversitySimilarity;
  });
}

export async function findSimilarFundingAgencies(
  agencyId: string,
  options: { limit: number; minSharedTopics: number },
): Promise<FundingSimilarity[]> {
  return runRead(FIND_SIMILAR_FUNDING_AGENCIES, { agencyId, ...options }, (record) => {
    const source = column(record, 'row') as Record<string, unknown>;
    return {
      agency: mapFundingAgencySummary(source.agency),
      sharedTopicCount: toNumber(source.sharedTopicCount),
      similarity: round(toNumber(source.similarity), 3),
      sharedTopics: Array.isArray(source.sharedTopics)
        ? source.sharedTopics.map(mapTopicRef)
        : [],
      combinedAwardUsd: toNumber(source.combinedAwardUsd),
    } satisfies FundingSimilarity;
  });
}

// ---------------------------------------------------------------------------
// Cross-domain research
// ---------------------------------------------------------------------------

export async function findCrossDomainCollaborations(options: {
  limit: number;
  minPapers: number;
  field?: string | undefined;
}): Promise<CrossDomainCollaboration[]> {
  return runRead(
    FIND_CROSS_DOMAIN_COLLABORATIONS,
    { limit: options.limit, minPapers: options.minPapers, field: options.field ?? null },
    (record) => mapCrossDomainCollaboration(column(record, 'row')),
  );
}
