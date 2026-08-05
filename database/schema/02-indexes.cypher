// ---------------------------------------------------------------------------
// Research Nexus - secondary indexes
//
// The `id` and natural-key lookups are already covered by the constraints in
// `01-constraints.cypher`, each of which is index-backed. The indexes below
// serve the three remaining access patterns of the API:
//
//   * substring search  - the global command palette
//   * ranking / sorting - h-index, citations, impact factor, rankings
//   * range filtering   - publication years, project years, fields, countries
//
// A note on search. Every searchable node carries `searchText`: a lowercased
// concatenation of its human-readable fields, written at seed time. Matching a
// single indexed property with `CONTAINS` keeps the query pure OpenCypher and
// portable across engines. A native full-text index is available as an optional
// accelerator - see `03-fulltext-optional.cypher` - but nothing depends on it.
// ---------------------------------------------------------------------------

// --- Global search: one indexed property per label -------------------------

CREATE INDEX author_search_text IF NOT EXISTS
FOR (n:Author) ON (n.searchText);

CREATE INDEX paper_search_text IF NOT EXISTS
FOR (n:Paper) ON (n.searchText);

CREATE INDEX university_search_text IF NOT EXISTS
FOR (n:University) ON (n.searchText);

CREATE INDEX topic_search_text IF NOT EXISTS
FOR (n:ResearchTopic) ON (n.searchText);

CREATE INDEX keyword_search_text IF NOT EXISTS
FOR (n:Keyword) ON (n.searchText);

CREATE INDEX conference_search_text IF NOT EXISTS
FOR (n:Conference) ON (n.searchText);

CREATE INDEX journal_search_text IF NOT EXISTS
FOR (n:Journal) ON (n.searchText);

CREATE INDEX dataset_search_text IF NOT EXISTS
FOR (n:Dataset) ON (n.searchText);

CREATE INDEX project_search_text IF NOT EXISTS
FOR (n:Project) ON (n.searchText);

CREATE INDEX funding_agency_search_text IF NOT EXISTS
FOR (n:FundingAgency) ON (n.searchText);

// --- Display-name lookups --------------------------------------------------
// Exact-name resolution during ingestion and deep-linking. The uniqueness
// constraints already index name/term for several labels; these cover the
// remainder, where the display name is not itself a constraint.

CREATE INDEX author_name IF NOT EXISTS
FOR (n:Author) ON (n.name);

CREATE INDEX paper_title IF NOT EXISTS
FOR (n:Paper) ON (n.title);

CREATE INDEX conference_name IF NOT EXISTS
FOR (n:Conference) ON (n.name);

CREATE INDEX journal_name IF NOT EXISTS
FOR (n:Journal) ON (n.name);

CREATE INDEX project_title IF NOT EXISTS
FOR (n:Project) ON (n.title);

// --- Ranking and sorting ---------------------------------------------------
// Every "top N" list in the product resolves through one of these.

CREATE INDEX author_h_index IF NOT EXISTS
FOR (n:Author) ON (n.hIndex);

CREATE INDEX author_citation_count IF NOT EXISTS
FOR (n:Author) ON (n.citationCount);

CREATE INDEX author_paper_count IF NOT EXISTS
FOR (n:Author) ON (n.paperCount);

CREATE INDEX paper_citation_count IF NOT EXISTS
FOR (n:Paper) ON (n.citationCount);

CREATE INDEX university_ranking IF NOT EXISTS
FOR (n:University) ON (n.ranking);

CREATE INDEX university_researcher_count IF NOT EXISTS
FOR (n:University) ON (n.researcherCount);

CREATE INDEX journal_impact_factor IF NOT EXISTS
FOR (n:Journal) ON (n.impactFactor);

CREATE INDEX topic_paper_count IF NOT EXISTS
FOR (n:ResearchTopic) ON (n.paperCount);

CREATE INDEX keyword_paper_count IF NOT EXISTS
FOR (n:Keyword) ON (n.paperCount);

CREATE INDEX conference_paper_count IF NOT EXISTS
FOR (n:Conference) ON (n.paperCount);

CREATE INDEX dataset_paper_count IF NOT EXISTS
FOR (n:Dataset) ON (n.paperCount);

CREATE INDEX project_budget IF NOT EXISTS
FOR (n:Project) ON (n.budgetUsd);

CREATE INDEX funding_agency_budget IF NOT EXISTS
FOR (n:FundingAgency) ON (n.annualBudgetUsd);

// --- Range and facet filtering ---------------------------------------------

CREATE INDEX paper_year IF NOT EXISTS
FOR (n:Paper) ON (n.year);

CREATE INDEX project_start_year IF NOT EXISTS
FOR (n:Project) ON (n.startYear);

CREATE INDEX project_status IF NOT EXISTS
FOR (n:Project) ON (n.status);

CREATE INDEX topic_field IF NOT EXISTS
FOR (n:ResearchTopic) ON (n.field);

CREATE INDEX topic_emergence_year IF NOT EXISTS
FOR (n:ResearchTopic) ON (n.emergenceYear);

CREATE INDEX author_primary_field IF NOT EXISTS
FOR (n:Author) ON (n.primaryField);

CREATE INDEX university_country IF NOT EXISTS
FOR (n:University) ON (n.country);

CREATE INDEX university_type IF NOT EXISTS
FOR (n:University) ON (n.type);

CREATE INDEX conference_field IF NOT EXISTS
FOR (n:Conference) ON (n.field);

CREATE INDEX conference_tier IF NOT EXISTS
FOR (n:Conference) ON (n.tier);

CREATE INDEX journal_field IF NOT EXISTS
FOR (n:Journal) ON (n.field);

CREATE INDEX dataset_domain IF NOT EXISTS
FOR (n:Dataset) ON (n.domain);

CREATE INDEX funding_agency_country IF NOT EXISTS
FOR (n:FundingAgency) ON (n.country);

CREATE INDEX funding_agency_type IF NOT EXISTS
FOR (n:FundingAgency) ON (n.type);

// --- Composite indexes for the hottest compound filters --------------------
// Property order matters: the equality/range predicate that narrows most
// aggressively comes first, so the index can be used as a prefix.

// "Highly cited papers since 2020" - the single most common filter in the API.
CREATE INDEX paper_year_citations IF NOT EXISTS
FOR (n:Paper) ON (n.year, n.citationCount);

// "Busiest topics within a field" - backs the topic explorer's facet.
CREATE INDEX topic_field_paper_count IF NOT EXISTS
FOR (n:ResearchTopic) ON (n.field, n.paperCount);

// "Top-tier venues in a field" - backs the conference explorer.
CREATE INDEX conference_field_tier IF NOT EXISTS
FOR (n:Conference) ON (n.field, n.tier);

// "Active projects by start year" - backs the funding explorer.
CREATE INDEX project_status_start_year IF NOT EXISTS
FOR (n:Project) ON (n.status, n.startYear);
