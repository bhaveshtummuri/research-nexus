/**
 * Domain types returned by the HTTP API.
 *
 * These are the contract between server and client: the frontend re-declares
 * the same shapes in `client/src/types/api.ts`. Nothing here leaks CognoDB
 * internals - element ids appear only in the graph-visualisation payloads,
 * where the renderer genuinely needs them.
 */

// ---------------------------------------------------------------------------
// Node labels and relationship types
// ---------------------------------------------------------------------------

export const NODE_LABELS = [
  'Author',
  'Paper',
  'University',
  'ResearchTopic',
  'Keyword',
  'Conference',
  'Journal',
  'Dataset',
  'FundingAgency',
  'Project',
] as const;

export type NodeLabel = (typeof NODE_LABELS)[number];

export const RELATIONSHIP_TYPES = [
  'AUTHORED',
  'CITES',
  'AFFILIATED_WITH',
  'HAS_TOPIC',
  'HAS_KEYWORD',
  'PUBLISHED_IN',
  'PRESENTED_AT',
  'USES_DATASET',
  'FUNDS',
  'COLLABORATED_WITH',
  'RELATED_TO',
  'INCLUDES',
  'PARTNERS_WITH',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// ---------------------------------------------------------------------------
// Entity summaries - the compact form used in lists and related-entity blocks
// ---------------------------------------------------------------------------

export interface AuthorSummary {
  id: string;
  name: string;
  title: string;
  orcid: string;
  hIndex: number;
  citationCount: number;
  paperCount: number;
  primaryField: string;
  affiliation: UniversityRef | null;
}

export interface UniversityRef {
  id: string;
  name: string;
  country: string;
}

export interface UniversitySummary {
  id: string;
  name: string;
  country: string;
  city: string;
  type: string;
  foundedYear: number;
  ranking: number;
  researcherCount: number;
}

export interface VenueRef {
  id: string;
  name: string;
  kind: 'journal' | 'conference';
}

export interface PaperSummary {
  id: string;
  title: string;
  year: number;
  doi: string;
  citationCount: number;
  referenceCount: number;
  authors: Array<Pick<AuthorSummary, 'id' | 'name'>>;
  venue: VenueRef | null;
  topics: TopicRef[];
}

export interface TopicRef {
  id: string;
  name: string;
  field: string;
}

export interface TopicSummary extends TopicRef {
  description: string;
  emergenceYear: number;
  paperCount: number;
}

export interface KeywordSummary {
  id: string;
  term: string;
  paperCount: number;
}

export interface ConferenceSummary {
  id: string;
  name: string;
  acronym: string;
  field: string;
  tier: string;
  foundedYear: number;
  paperCount: number;
}

export interface JournalSummary {
  id: string;
  name: string;
  publisher: string;
  issn: string;
  field: string;
  impactFactor: number;
  paperCount: number;
}

export interface DatasetSummary {
  id: string;
  name: string;
  domain: string;
  license: string;
  sizeGb: number;
  releaseYear: number;
  paperCount: number;
}

export interface FundingAgencySummary {
  id: string;
  name: string;
  country: string;
  type: string;
  annualBudgetUsd: number;
  projectCount: number;
  totalAwardedUsd: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  summary: string;
  status: string;
  startYear: number;
  endYear: number;
  budgetUsd: number;
}

// ---------------------------------------------------------------------------
// Detail views - a summary plus the neighbourhood the page renders
// ---------------------------------------------------------------------------

export interface AuthorDetail extends AuthorSummary {
  email: string;
  researchStatement: string;
  careerStartYear: number;
  topics: Array<TopicRef & { paperCount: number }>;
  recentPapers: PaperSummary[];
  frequentCollaborators: CollaboratorSummary[];
  projects: ProjectSummary[];
  venues: VenueRef[];
}

export interface CollaboratorSummary extends AuthorSummary {
  sharedPaperCount: number;
  firstCollaborationYear: number;
  lastCollaborationYear: number;
}

export interface PaperDetail extends PaperSummary {
  abstract: string;
  url: string;
  keywords: KeywordSummary[];
  datasets: DatasetSummary[];
  project: ProjectSummary | null;
  citedBy: PaperSummary[];
  references: PaperSummary[];
}

export interface TopicDetail extends TopicSummary {
  relatedTopics: Array<TopicRef & { strength: number; connectionKind: 'direct' | 'inferred' }>;
  topPapers: PaperSummary[];
  topExperts: ExpertSummary[];
  universities: Array<UniversitySummary & { paperCount: number }>;
  yearlyOutput: YearlyCount[];
}

export interface UniversityDetail extends UniversitySummary {
  website: string;
  topAuthors: AuthorSummary[];
  topTopics: Array<TopicRef & { paperCount: number }>;
  partners: Array<UniversityRef & { since: number; focus: string }>;
  paperCount: number;
  totalCitations: number;
}

export interface ConferenceDetail extends ConferenceSummary {
  location: string;
  website: string;
  topics: TopicRef[];
  topPapers: PaperSummary[];
  topAuthors: AuthorSummary[];
  yearlyOutput: YearlyCount[];
}

export interface JournalDetail extends JournalSummary {
  website: string;
  topics: TopicRef[];
  topPapers: PaperSummary[];
  topAuthors: AuthorSummary[];
}

export interface FundingAgencyDetail extends FundingAgencySummary {
  website: string;
  projects: Array<ProjectSummary & { awardedUsd: number; grantNumber: string }>;
  topTopics: Array<TopicRef & { paperCount: number }>;
  partnerAgencies: Array<FundingAgencySummary & { sharedTopicCount: number }>;
}

// ---------------------------------------------------------------------------
// Graph-native result shapes
// ---------------------------------------------------------------------------

export interface ExpertSummary extends AuthorSummary {
  /** Composite score blending output, impact and topic focus. */
  expertiseScore: number;
  topicPaperCount: number;
  topicCitationCount: number;
  /** Share of the author's output devoted to the queried topic, 0-1. */
  focusRatio: number;
  /** Distinct co-authors across all of the expert's work, not just this topic. */
  collaboratorCount: number;
  activeProjectCount: number;
  activeProjects: Array<Pick<ProjectSummary, 'id' | 'title' | 'status' | 'startYear' | 'endYear'>>;
}

/**
 * An author ranked by how widely they collaborate rather than by output.
 *
 * `institutionCount` is what separates a broad network from a busy one: it
 * counts the distinct institutions a researcher's co-authors belong to.
 */
export interface CollaborativeResearcher extends AuthorSummary {
  partnerCount: number;
  institutionCount: number;
  jointPapers: number;
  score: number;
  topPartners: Array<{ id: string; name: string }>;
}

export interface ScoredPaper extends PaperSummary {
  score: number;
  reasons: RecommendationReason[];
}

export interface ScoredAuthor extends AuthorSummary {
  score: number;
  reasons: RecommendationReason[];
}

export interface RecommendationReason {
  kind:
    | 'shared-topic'
    | 'shared-keyword'
    | 'shared-citation'
    | 'co-citation'
    | 'shared-collaborator'
    | 'shared-venue'
    | 'shared-dataset'
    | 'same-institution'
    | 'cross-domain';
  label: string;
  weight: number;
}

export interface PaperRef {
  id: string;
  title: string;
  year: number;
}

export interface KeywordRef {
  id: string;
  term: string;
}

export interface HiddenCollaborator extends ScoredAuthor {
  /** Shortest number of COLLABORATED_WITH hops separating the two authors. */
  distance: number;
  /** Co-authored work. Always empty for hidden collaborators, by definition. */
  sharedPapers: PaperRef[];
  sharedTopics: TopicRef[];
  sharedKeywords: KeywordRef[];
  sharedCollaborators: Array<Pick<AuthorSummary, 'id' | 'name'>>;
}

/** A node in the flattened citation tree; `parentId` rebuilds the hierarchy. */
export interface CitationTreeNode {
  id: string;
  title: string;
  year: number;
  citationCount: number;
  depth: number;
  parentId: string;
}

export interface InfluentialCitationPath extends GraphPath {
  /** Citations accumulated across every paper on the route. */
  influence: number;
}

export interface TopicSimilarity extends TopicSummary {
  /** Jaccard overlap of the two topics' keyword sets, 0-1. */
  similarity: number;
  sharedKeywordCount: number;
  sharedKeywords: KeywordRef[];
  commonPapers: PaperRef[];
  relatedResearchers: Array<{ id: string; name: string; paperCount: number }>;
}

export interface MostCitedPaper extends PaperSummary {
  /** Incoming CITES edges counted by traversal, not read from the node. */
  inGraphCitations: number;
}

export interface ConnectedKeyword extends KeywordSummary {
  connectedKeywordCount: number;
  sharedPaperCount: number;
  topTopics: TopicRef[];
}

export interface FundedResearchArea {
  field: string;
  totalAwardedUsd: number;
  projectCount: number;
  agencyCount: number;
  averageAwardUsd: number;
  topTopics: TopicRef[];
}

export interface CollaborativeInstitution extends UniversitySummary {
  /** Distinct peer institutions reached through co-authorship. */
  partnerCount: number;
  externalCollaboratorCount: number;
  engagedResearcherCount: number;
  topPartners: UniversityRef[];
}

export interface PathNode {
  elementId: string;
  id: string;
  label: NodeLabel;
  name: string;
}

export interface PathEdge {
  elementId: string;
  type: RelationshipType;
  startElementId: string;
  endElementId: string;
  properties: Record<string, unknown>;
}

export interface GraphPath {
  length: number;
  nodes: PathNode[];
  edges: PathEdge[];
  /** Human-readable rendering, e.g. "Ada Lovelace → Paper → Alan Turing". */
  narrative: string;
}

export interface CitationChain {
  depth: number;
  papers: PaperSummary[];
  /** Total citations accumulated along the chain, used for ranking. */
  impact: number;
}

export interface GraphNodeView {
  /** CognoDB element id - the identity the renderer deduplicates on. */
  elementId: string;
  id: string;
  label: NodeLabel;
  name: string;
  /** Secondary line rendered under the label in the inspector. */
  caption: string;
  degree: number;
  properties: Record<string, unknown>;
}

export interface GraphEdgeView {
  elementId: string;
  type: RelationshipType;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

export interface GraphView {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    truncated: boolean;
    labelCounts: Array<{ label: NodeLabel; count: number }>;
    relationshipCounts: Array<{ type: RelationshipType; count: number }>;
  };
}

// ---------------------------------------------------------------------------
// Search and analytics
// ---------------------------------------------------------------------------

export interface SearchHit {
  id: string;
  label: NodeLabel;
  title: string;
  subtitle: string;
  score: number;
  /** Route the client navigates to when the hit is selected. */
  href: string;
}

export interface SearchResults {
  query: string;
  totalHits: number;
  groups: Array<{ label: NodeLabel; hits: SearchHit[] }>;
}

export interface YearlyCount {
  year: number;
  count: number;
}

export interface TrendingTopic extends TopicSummary {
  recentPaperCount: number;
  priorPaperCount: number;
  /** Recent output divided by prior output; > 1 means accelerating. */
  growthRate: number;
  momentum: number;
  topAuthors: Array<Pick<AuthorSummary, 'id' | 'name'>>;
}

export interface GraphOverview {
  nodes: Array<{ label: NodeLabel; count: number }>;
  relationships: Array<{ type: RelationshipType; count: number }>;
  totals: { nodeCount: number; relationshipCount: number; density: number };
}

export interface AnalyticsSummary {
  overview: GraphOverview;
  publicationsByYear: YearlyCount[];
  topTopics: TopicSummary[];
  topAuthors: AuthorSummary[];
  topUniversities: Array<UniversitySummary & { paperCount: number; citationCount: number }>;
  topVenues: Array<VenueRef & { paperCount: number; citationCount: number }>;
  collaborationStats: {
    averageAuthorsPerPaper: number;
    averageCollaboratorsPerAuthor: number;
    crossInstitutionShare: number;
    internationalShare: number;
  };
}

export interface CrossDomainCollaboration {
  fieldA: string;
  fieldB: string;
  paperCount: number;
  authorCount: number;
  exemplarPapers: Array<Pick<PaperSummary, 'id' | 'title' | 'year'>>;
}

export interface UniversitySimilarity {
  university: UniversitySummary;
  sharedTopicCount: number;
  similarity: number;
  sharedTopics: TopicRef[];
}

export interface FundingSimilarity {
  agency: FundingAgencySummary;
  sharedTopicCount: number;
  similarity: number;
  sharedTopics: TopicRef[];
  combinedAwardUsd: number;
}
