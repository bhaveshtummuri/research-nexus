/**
 * Row shapes written to CognoDB.
 *
 * Every node type carries `searchText`: a lowercased concatenation of its
 * human-readable fields. Global search matches against that single indexed
 * property, which keeps the search query pure OpenCypher instead of depending
 * on a vendor-specific full-text engine.
 */

export interface AuthorRow {
  id: string;
  name: string;
  title: string;
  email: string;
  orcid: string;
  primaryField: string;
  careerStartYear: number;
  researchStatement: string;
  hIndex: number;
  citationCount: number;
  paperCount: number;
  searchText: string;
}

export interface PaperRow {
  id: string;
  title: string;
  abstract: string;
  year: number;
  doi: string;
  url: string;
  citationCount: number;
  referenceCount: number;
  searchText: string;
}

export interface UniversityRow {
  id: string;
  name: string;
  country: string;
  city: string;
  type: string;
  foundedYear: number;
  ranking: number;
  website: string;
  researcherCount: number;
  searchText: string;
}

export interface TopicRow {
  id: string;
  name: string;
  field: string;
  description: string;
  emergenceYear: number;
  paperCount: number;
  searchText: string;
}

export interface KeywordRow {
  id: string;
  term: string;
  paperCount: number;
  searchText: string;
}

export interface ConferenceRow {
  id: string;
  name: string;
  acronym: string;
  field: string;
  tier: string;
  foundedYear: number;
  location: string;
  website: string;
  paperCount: number;
  searchText: string;
}

export interface JournalRow {
  id: string;
  name: string;
  publisher: string;
  issn: string;
  field: string;
  impactFactor: number;
  website: string;
  paperCount: number;
  searchText: string;
}

export interface DatasetRow {
  id: string;
  name: string;
  domain: string;
  license: string;
  sizeGb: number;
  releaseYear: number;
  url: string;
  paperCount: number;
  searchText: string;
}

export interface FundingAgencyRow {
  id: string;
  name: string;
  country: string;
  type: string;
  annualBudgetUsd: number;
  website: string;
  searchText: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  summary: string;
  status: string;
  startYear: number;
  endYear: number;
  budgetUsd: number;
  searchText: string;
}

/** Generic edge row: `from`/`to` hold business ids, never internal element ids. */
export interface EdgeRow<TProps extends Record<string, unknown> = Record<string, never>> {
  from: string;
  to: string;
  props: TProps;
}

export type AuthoredEdge = EdgeRow<{ position: number; isCorresponding: boolean }>;
export type CitesEdge = EdgeRow<{ year: number }>;
export type AffiliatedEdge = EdgeRow<{ since: number; role: string; isPrimary: boolean }>;
export type HasTopicEdge = EdgeRow<{ relevance: number }>;
export type HasKeywordEdge = EdgeRow<Record<string, never>>;
export type PublishedInEdge = EdgeRow<{ year: number; volume: number; issue: number }>;
export type PresentedAtEdge = EdgeRow<{ year: number; track: string }>;
export type UsesDatasetEdge = EdgeRow<{ usageType: string }>;
export type FundedByEdge = EdgeRow<{ amountUsd: number; grantNumber: string; startYear: number }>;
export type RelatedTopicEdge = EdgeRow<{ strength: number }>;
export type RelatedKeywordEdge = EdgeRow<{ strength: number; kind: string }>;
export type PaperProjectEdge = EdgeRow<Record<string, never>>;
export type AuthorProjectEdge = EdgeRow<{ role: string }>;
export type PartnersWithEdge = EdgeRow<{ since: number; focus: string }>;

export interface GeneratedGraph {
  authors: AuthorRow[];
  papers: PaperRow[];
  universities: UniversityRow[];
  topics: TopicRow[];
  keywords: KeywordRow[];
  conferences: ConferenceRow[];
  journals: JournalRow[];
  datasets: DatasetRow[];
  fundingAgencies: FundingAgencyRow[];
  projects: ProjectRow[];

  authored: AuthoredEdge[];
  cites: CitesEdge[];
  affiliatedWith: AffiliatedEdge[];
  paperTopics: HasTopicEdge[];
  venueTopics: { conferences: HasTopicEdge[]; journals: HasTopicEdge[] };
  projectTopics: HasTopicEdge[];
  datasetTopics: HasTopicEdge[];
  paperKeywords: HasKeywordEdge[];
  publishedIn: PublishedInEdge[];
  presentedAt: PresentedAtEdge[];
  usesDataset: UsesDatasetEdge[];
  fundedBy: FundedByEdge[];
  relatedTopics: RelatedTopicEdge[];
  relatedKeywords: RelatedKeywordEdge[];
  paperProjects: PaperProjectEdge[];
  partnersWith: PartnersWithEdge[];
}

/** Cross-references the generator keeps while wiring the graph together. */
export interface GraphIndex {
  /** Topic ids attached to each paper, used to derive keyword and venue links. */
  paperTopicIds: Map<string, string[]>;
  /** Author ids per paper, in authorship order. */
  paperAuthorIds: Map<string, string[]>;
  /** Primary university per author. */
  authorUniversityId: Map<string, string>;
  /** Field each author mostly publishes in. */
  authorField: Map<string, string>;
  /** Papers grouped by publication year, ascending. */
  papersByYear: Map<number, string[]>;
}
