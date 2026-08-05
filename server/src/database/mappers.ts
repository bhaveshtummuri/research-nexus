import type { Record as Neo4jRecord } from 'neo4j-driver';

import type {
  AuthorSummary,
  CitationChain,
  CitationTreeNode,
  CollaborativeInstitution,
  CollaborativeResearcher,
  CollaboratorSummary,
  ConferenceSummary,
  ConnectedKeyword,
  CrossDomainCollaboration,
  DatasetSummary,
  ExpertSummary,
  FundedResearchArea,
  FundingAgencySummary,
  GraphPath,
  HiddenCollaborator,
  InfluentialCitationPath,
  JournalSummary,
  KeywordRef,
  KeywordSummary,
  MostCitedPaper,
  NodeLabel,
  PaperRef,
  PaperSummary,
  PathEdge,
  PathNode,
  ProjectSummary,
  RecommendationReason,
  RelationshipType,
  ScoredAuthor,
  ScoredPaper,
  TopicRef,
  TopicSimilarity,
  TopicSummary,
  UniversityRef,
  UniversitySummary,
  YearlyCount,
} from '../types/domain.js';

import { serializeValue, toNumber } from './serialize.js';

/**
 * Cypher projections return maps, so the mappers below take a plain object and
 * normalise it. Two things always need attention: Bolt integers must become JS
 * numbers, and optional traversals must collapse `null` into a defined default
 * so the client never has to test for `undefined`.
 */
type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return toNumber(value, fallback);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Reads a projected map from a record column and serializes it in one step. */
export function column(record: Neo4jRecord, key: string): unknown {
  return serializeValue(record.get(key));
}

export function mapUniversityRef(value: unknown): UniversityRef | null {
  const source = row(value);
  if (!source.id) return null;
  return {
    id: str(source.id),
    name: str(source.name),
    country: str(source.country),
  };
}

export function mapTopicRef(value: unknown): TopicRef {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    field: str(source.field),
  };
}

export function mapAuthorSummary(value: unknown): AuthorSummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    title: str(source.title),
    orcid: str(source.orcid),
    hIndex: num(source.hIndex),
    citationCount: num(source.citationCount),
    paperCount: num(source.paperCount),
    primaryField: str(source.primaryField),
    affiliation: mapUniversityRef(source.affiliation),
  };
}

export function mapPaperSummary(value: unknown): PaperSummary {
  const source = row(value);
  const venue = row(source.venue);
  return {
    id: str(source.id),
    title: str(source.title),
    year: num(source.year),
    doi: str(source.doi),
    citationCount: num(source.citationCount),
    referenceCount: num(source.referenceCount),
    authors: list(source.authors).map((entry) => {
      const author = row(entry);
      return { id: str(author.id), name: str(author.name) };
    }),
    venue: venue.id
      ? {
          id: str(venue.id),
          name: str(venue.name),
          kind: venue.kind === 'conference' ? 'conference' : 'journal',
        }
      : null,
    topics: list(source.topics).map(mapTopicRef),
  };
}

export function mapTopicSummary(value: unknown): TopicSummary {
  const source = row(value);
  return {
    ...mapTopicRef(source),
    description: str(source.description),
    emergenceYear: num(source.emergenceYear),
    paperCount: num(source.paperCount),
  };
}

export function mapUniversitySummary(value: unknown): UniversitySummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    country: str(source.country),
    city: str(source.city),
    type: str(source.type),
    foundedYear: num(source.foundedYear),
    ranking: num(source.ranking),
    researcherCount: num(source.researcherCount),
  };
}

export function mapKeywordSummary(value: unknown): KeywordSummary {
  const source = row(value);
  return {
    id: str(source.id),
    term: str(source.term),
    paperCount: num(source.paperCount),
  };
}

export function mapConferenceSummary(value: unknown): ConferenceSummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    acronym: str(source.acronym),
    field: str(source.field),
    tier: str(source.tier),
    foundedYear: num(source.foundedYear),
    paperCount: num(source.paperCount),
  };
}

export function mapJournalSummary(value: unknown): JournalSummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    publisher: str(source.publisher),
    issn: str(source.issn),
    field: str(source.field),
    impactFactor: num(source.impactFactor),
    paperCount: num(source.paperCount),
  };
}

export function mapDatasetSummary(value: unknown): DatasetSummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    domain: str(source.domain),
    license: str(source.license),
    sizeGb: num(source.sizeGb),
    releaseYear: num(source.releaseYear),
    paperCount: num(source.paperCount),
  };
}

export function mapFundingAgencySummary(value: unknown): FundingAgencySummary {
  const source = row(value);
  return {
    id: str(source.id),
    name: str(source.name),
    country: str(source.country),
    type: str(source.type),
    annualBudgetUsd: num(source.annualBudgetUsd),
    projectCount: num(source.projectCount),
    totalAwardedUsd: num(source.totalAwardedUsd),
  };
}

export function mapProjectSummary(value: unknown): ProjectSummary {
  const source = row(value);
  return {
    id: str(source.id),
    title: str(source.title),
    summary: str(source.summary),
    status: str(source.status),
    startYear: num(source.startYear),
    endYear: num(source.endYear),
    budgetUsd: num(source.budgetUsd),
  };
}

export function mapCollaboratorSummary(value: unknown): CollaboratorSummary {
  const source = row(value);
  return {
    ...mapAuthorSummary(source),
    sharedPaperCount: num(source.sharedPaperCount),
    firstCollaborationYear: num(source.firstCollaborationYear),
    lastCollaborationYear: num(source.lastCollaborationYear),
  };
}

export function mapCollaborativeResearcher(value: unknown): CollaborativeResearcher {
  const source = row(value);
  return {
    ...mapAuthorSummary(source),
    partnerCount: num(source.partnerCount),
    institutionCount: num(source.institutionCount),
    jointPapers: num(source.jointPapers),
    score: round(num(source.score), 3),
    topPartners: list(source.topPartners).map((partner) => {
      const entry = row(partner);
      return { id: str(entry.id), name: str(entry.name) };
    }),
  };
}

export function mapExpertSummary(value: unknown): ExpertSummary {
  const source = row(value);
  return {
    ...mapAuthorSummary(source),
    expertiseScore: round(num(source.expertiseScore), 3),
    topicPaperCount: num(source.topicPaperCount),
    topicCitationCount: num(source.topicCitationCount),
    focusRatio: round(num(source.focusRatio), 3),
    collaboratorCount: num(source.collaboratorCount),
    activeProjectCount: num(source.activeProjectCount),
    activeProjects: list(source.activeProjects).map((entry) => {
      const project = row(entry);
      return {
        id: str(project.id),
        title: str(project.title),
        status: str(project.status),
        startYear: num(project.startYear),
        endYear: num(project.endYear),
      };
    }),
  };
}

function mapReason(value: unknown): RecommendationReason {
  const source = row(value);
  return {
    kind: str(source.kind, 'shared-topic') as RecommendationReason['kind'],
    label: str(source.label),
    weight: round(num(source.weight), 3),
  };
}

export function mapScoredPaper(value: unknown): ScoredPaper {
  const source = row(value);
  return {
    ...mapPaperSummary(source),
    score: round(num(source.score), 3),
    reasons: list(source.reasons).map(mapReason),
  };
}

export function mapScoredAuthor(value: unknown): ScoredAuthor {
  const source = row(value);
  return {
    ...mapAuthorSummary(source),
    score: round(num(source.score), 3),
    reasons: list(source.reasons).map(mapReason),
  };
}

export function mapPaperRef(value: unknown): PaperRef {
  const source = row(value);
  return { id: str(source.id), title: str(source.title), year: num(source.year) };
}

export function mapKeywordRef(value: unknown): KeywordRef {
  const source = row(value);
  return { id: str(source.id), term: str(source.term) };
}

export function mapHiddenCollaborator(value: unknown): HiddenCollaborator {
  const source = row(value);
  return {
    ...mapScoredAuthor(source),
    distance: num(source.distance),
    sharedPapers: list(source.sharedPapers).map(mapPaperRef),
    sharedTopics: list(source.sharedTopics).map(mapTopicRef),
    sharedKeywords: list(source.sharedKeywords).map(mapKeywordRef),
    sharedCollaborators: list(source.sharedCollaborators).map((entry) => {
      const author = row(entry);
      return { id: str(author.id), name: str(author.name) };
    }),
  };
}

export function mapCitationTreeNode(value: unknown): CitationTreeNode {
  const source = row(value);
  return {
    id: str(source.id),
    title: str(source.title),
    year: num(source.year),
    citationCount: num(source.citationCount),
    depth: num(source.depth),
    parentId: str(source.parentId),
  };
}

export function mapInfluentialCitationPath(value: unknown): InfluentialCitationPath {
  const source = row(value);
  return { ...mapGraphPath(source), influence: num(source.influence) };
}

export function mapTopicSimilarity(value: unknown): TopicSimilarity {
  const source = row(value);
  return {
    ...mapTopicSummary(source),
    similarity: round(num(source.similarity), 4),
    sharedKeywordCount: num(source.sharedKeywordCount),
    sharedKeywords: list(source.sharedKeywords).map(mapKeywordRef),
    commonPapers: list(source.commonPapers).map(mapPaperRef),
    relatedResearchers: list(source.relatedResearchers).map((entry) => {
      const researcher = row(entry);
      return {
        id: str(researcher.id),
        name: str(researcher.name),
        paperCount: num(researcher.paperCount),
      };
    }),
  };
}

export function mapMostCitedPaper(value: unknown): MostCitedPaper {
  const source = row(value);
  return { ...mapPaperSummary(source), inGraphCitations: num(source.inGraphCitations) };
}

export function mapConnectedKeyword(value: unknown): ConnectedKeyword {
  const source = row(value);
  return {
    ...mapKeywordSummary(source),
    connectedKeywordCount: num(source.connectedKeywordCount),
    sharedPaperCount: num(source.sharedPaperCount),
    topTopics: list(source.topTopics).map(mapTopicRef),
  };
}

export function mapFundedResearchArea(value: unknown): FundedResearchArea {
  const source = row(value);
  return {
    field: str(source.field),
    totalAwardedUsd: num(source.totalAwardedUsd),
    projectCount: num(source.projectCount),
    agencyCount: num(source.agencyCount),
    averageAwardUsd: round(num(source.averageAwardUsd), 2),
    topTopics: list(source.topTopics).map(mapTopicRef),
  };
}

export function mapCollaborativeInstitution(value: unknown): CollaborativeInstitution {
  const source = row(value);
  return {
    ...mapUniversitySummary(source),
    partnerCount: num(source.partnerCount),
    externalCollaboratorCount: num(source.externalCollaboratorCount),
    engagedResearcherCount: num(source.engagedResearcherCount),
    topPartners: list(source.topPartners)
      .map(mapUniversityRef)
      .filter((entry): entry is UniversityRef => entry !== null),
  };
}

export function mapYearlyCount(value: unknown): YearlyCount {
  const source = row(value);
  return { year: num(source.year), count: num(source.count) };
}

export function mapCitationChain(value: unknown): CitationChain {
  const source = row(value);
  const papers = list(source.papers).map(mapPaperSummary);
  return {
    depth: num(source.depth, Math.max(papers.length - 1, 0)),
    papers,
    impact: num(source.impact),
  };
}

export function mapCrossDomainCollaboration(value: unknown): CrossDomainCollaboration {
  const source = row(value);
  return {
    fieldA: str(source.fieldA),
    fieldB: str(source.fieldB),
    paperCount: num(source.paperCount),
    authorCount: num(source.authorCount),
    exemplarPapers: list(source.exemplarPapers).map((entry) => {
      const paper = row(entry);
      return { id: str(paper.id), title: str(paper.title), year: num(paper.year) };
    }),
  };
}

function mapPathNode(value: unknown): PathNode {
  const source = row(value);
  return {
    elementId: str(source.elementId),
    id: str(source.id),
    label: str(source.label, 'Author') as NodeLabel,
    name: str(source.name),
  };
}

function mapPathEdge(value: unknown): PathEdge {
  const source = row(value);
  return {
    elementId: str(source.elementId),
    type: str(source.type, 'COLLABORATED_WITH') as RelationshipType,
    startElementId: str(source.startElementId),
    endElementId: str(source.endElementId),
    properties: row(source.properties),
  };
}

export function mapGraphPath(value: unknown): GraphPath {
  const source = row(value);
  const nodes = list(source.nodes).map(mapPathNode);
  const edges = list(source.edges).map(mapPathEdge);
  return {
    length: num(source.length, edges.length),
    nodes,
    edges,
    narrative: nodes.map((node) => node.name).join(' → '),
  };
}

/** Keeps computed scores readable in JSON without hiding meaningful precision. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
