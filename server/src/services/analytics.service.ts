import {
  COLLABORATION_STATS,
  DASHBOARD_TOTALS,
  MOST_CITED_PAPERS,
  MOST_COLLABORATIVE_INSTITUTIONS,
  MOST_CONNECTED_KEYWORDS,
  MOST_FUNDED_RESEARCH_AREAS,
  NODE_LABEL_COUNTS,
  PUBLICATIONS_BY_YEAR,
  RELATIONSHIP_TYPE_COUNTS,
  TOP_AUTHORS,
  TOP_TOPICS,
  TOP_UNIVERSITIES,
  TOP_VENUES,
} from '../cypher/index.js';
import {
  column,
  mapAuthorSummary,
  mapCollaborativeInstitution,
  mapConnectedKeyword,
  mapFundedResearchArea,
  mapMostCitedPaper,
  mapTopicSummary,
  mapUniversitySummary,
  mapYearlyCount,
  round,
} from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  AnalyticsSummary,
  AuthorSummary,
  CollaborativeInstitution,
  ConnectedKeyword,
  FundedResearchArea,
  GraphOverview,
  MostCitedPaper,
  NodeLabel,
  RelationshipType,
  YearlyCount,
} from '../types/domain.js';

export interface DashboardTotals {
  authorCount: number;
  paperCount: number;
  citationCount: number;
  topicCount: number;
  universityCount: number;
  projectCount: number;
  fundedUsd: number;
}

export async function getDashboardTotals(): Promise<DashboardTotals> {
  const totals = await runReadOne(DASHBOARD_TOTALS, {}, (record) => {
    const source = column(record, 'totals') as Record<string, unknown>;
    return {
      authorCount: toNumber(source.authorCount),
      paperCount: toNumber(source.paperCount),
      citationCount: toNumber(source.citationCount),
      topicCount: toNumber(source.topicCount),
      universityCount: toNumber(source.universityCount),
      projectCount: toNumber(source.projectCount),
      fundedUsd: toNumber(source.fundedUsd),
    };
  });

  return (
    totals ?? {
      authorCount: 0,
      paperCount: 0,
      citationCount: 0,
      topicCount: 0,
      universityCount: 0,
      projectCount: 0,
      fundedUsd: 0,
    }
  );
}

/**
 * Node and relationship census.
 *
 * `density` is the ratio of relationships to nodes - a single number that makes
 * the point of the whole project concrete: this dataset carries roughly ten
 * relationships for every entity, and those relationships are the data.
 */
export async function getGraphOverview(): Promise<GraphOverview> {
  const [nodes, relationships] = await Promise.all([
    runRead(NODE_LABEL_COUNTS, {}, (record) => {
      const source = column(record, 'row') as Record<string, unknown>;
      return { label: String(source.label ?? '') as NodeLabel, count: toNumber(source.count) };
    }),
    runRead(RELATIONSHIP_TYPE_COUNTS, {}, (record) => {
      const source = column(record, 'row') as Record<string, unknown>;
      return { type: String(source.type ?? '') as RelationshipType, count: toNumber(source.count) };
    }),
  ]);

  const nodeCount = nodes.reduce((total, entry) => total + entry.count, 0);
  const relationshipCount = relationships.reduce((total, entry) => total + entry.count, 0);

  return {
    nodes,
    relationships,
    totals: {
      nodeCount,
      relationshipCount,
      density: nodeCount === 0 ? 0 : round(relationshipCount / nodeCount, 2),
    },
  };
}

/**
 * Authors ranked by citation impact.
 *
 * Deliberately not the generic author list with a sort applied: this is the
 * dashboard's leaderboard, so it shares the exact ranking the analytics summary
 * reports and cannot drift from it.
 */
export async function getPopularAuthors(limit: number): Promise<AuthorSummary[]> {
  return runRead(TOP_AUTHORS, { limit }, (record) => mapAuthorSummary(column(record, 'author')));
}

/**
 * Papers ranked by incoming citations counted in the graph.
 *
 * Deliberately not `LIST_PAPERS?sort=citations`: that reads the stored counter,
 * this counts edges. The two are returned side by side so drift is visible.
 */
export async function getMostCitedPapers(options: {
  limit: number;
  fromYear?: number | undefined;
}): Promise<MostCitedPaper[]> {
  return runRead(
    MOST_CITED_PAPERS,
    { limit: options.limit, fromYear: options.fromYear ?? null },
    (record) => mapMostCitedPaper(column(record, 'paper')),
  );
}

/** Keywords ranked by co-occurrence degree, not by raw paper count. */
export async function getMostConnectedKeywords(limit: number): Promise<ConnectedKeyword[]> {
  return runRead(MOST_CONNECTED_KEYWORDS, { limit }, (record) =>
    mapConnectedKeyword(column(record, 'keyword')),
  );
}

/** Research fields ranked by the grant money reaching them through projects. */
export async function getMostFundedResearchAreas(options: {
  limit: number;
  fromYear?: number | undefined;
}): Promise<FundedResearchArea[]> {
  return runRead(
    MOST_FUNDED_RESEARCH_AREAS,
    { limit: options.limit, fromYear: options.fromYear ?? null },
    (record) => mapFundedResearchArea(column(record, 'row')),
  );
}

/** Institutions ranked by how many peer institutions they co-publish with. */
export async function getMostCollaborativeInstitutions(options: {
  limit: number;
  country?: string | undefined;
}): Promise<CollaborativeInstitution[]> {
  return runRead(
    MOST_COLLABORATIVE_INSTITUTIONS,
    { limit: options.limit, country: options.country ?? null },
    (record) => mapCollaborativeInstitution(column(record, 'university')),
  );
}

export async function getPublicationsByYear(fromYear?: number): Promise<YearlyCount[]> {
  return runRead(PUBLICATIONS_BY_YEAR, { fromYear: fromYear ?? null }, (record) =>
    mapYearlyCount(column(record, 'row')),
  );
}

/**
 * The full analytics payload.
 *
 * Seven independent traversals are issued concurrently. Each is cheap on its
 * own, and running them in parallel keeps the dashboard's time-to-first-render
 * bounded by the slowest query rather than by their sum.
 */
export async function getAnalyticsSummary(options: {
  fromYear?: number | undefined;
  limit: number;
}): Promise<AnalyticsSummary> {
  const { fromYear, limit } = options;

  const [
    overview,
    publicationsByYear,
    topTopics,
    topAuthors,
    topUniversities,
    topVenues,
    collaborationStats,
  ] = await Promise.all([
    getGraphOverview(),
    getPublicationsByYear(fromYear),
    runRead(TOP_TOPICS, { limit }, (record) => mapTopicSummary(column(record, 'topic'))),
    runRead(TOP_AUTHORS, { limit }, (record) => mapAuthorSummary(column(record, 'author'))),
    runRead(TOP_UNIVERSITIES, { limit }, (record) => {
      const source = column(record, 'university') as Record<string, unknown>;
      return {
        ...mapUniversitySummary(source),
        paperCount: toNumber(source.paperCount),
        citationCount: toNumber(source.citationCount),
      };
    }),
    runRead(TOP_VENUES, { limit }, (record) => {
      const source = column(record, 'venue') as Record<string, unknown>;
      return {
        id: String(source.id ?? ''),
        name: String(source.name ?? ''),
        kind: source.kind === 'journal' ? ('journal' as const) : ('conference' as const),
        paperCount: toNumber(source.paperCount),
        citationCount: toNumber(source.citationCount),
      };
    }),
    runReadOne(COLLABORATION_STATS, {}, (record) => {
      const source = column(record, 'stats') as Record<string, unknown>;
      return {
        averageAuthorsPerPaper: round(toNumber(source.averageAuthorsPerPaper), 2),
        averageCollaboratorsPerAuthor: round(toNumber(source.averageCollaboratorsPerAuthor), 2),
        crossInstitutionShare: round(toNumber(source.crossInstitutionShare), 3),
        internationalShare: round(toNumber(source.internationalShare), 3),
      };
    }),
  ]);

  return {
    overview,
    publicationsByYear,
    topTopics,
    topAuthors,
    topUniversities,
    topVenues: topVenues
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, limit),
    collaborationStats: collaborationStats ?? {
      averageAuthorsPerPaper: 0,
      averageCollaboratorsPerAuthor: 0,
      crossInstitutionShare: 0,
      internationalShare: 0,
    },
  };
}
