// ---------------------------------------------------------------------------
// Research Nexus - uniqueness constraints
//
// Constraints do two jobs here, and the second is the one people forget:
//
//   1. INTEGRITY. They guarantee the seed is idempotent - re-running it MERGEs
//      onto the same nodes instead of duplicating them - and they stop
//      near-duplicate nodes from fragmenting traversals. Without
//      `Keyword.term IS UNIQUE`, "graph neural network" and "graph neural
//      networks" become separate nodes and every similarity query silently
//      misses the match.
//
//   2. PERFORMANCE. Every uniqueness constraint is index-backed, so each
//      `MATCH (n:Label {id: $id})` in the API - the anchor of essentially every
//      query - is a single index seek rather than a label scan.
//
// Two kinds of key are constrained: the synthetic `id` every node carries, and
// the natural keys that are unique in the real world (DOI, ORCID, ISSN, names).
//
// Run with:  npm run db:schema
// ---------------------------------------------------------------------------

// --- Primary identifiers ---------------------------------------------------

CREATE CONSTRAINT author_id_unique IF NOT EXISTS
FOR (n:Author) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT paper_id_unique IF NOT EXISTS
FOR (n:Paper) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT university_id_unique IF NOT EXISTS
FOR (n:University) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT topic_id_unique IF NOT EXISTS
FOR (n:ResearchTopic) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT keyword_id_unique IF NOT EXISTS
FOR (n:Keyword) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT conference_id_unique IF NOT EXISTS
FOR (n:Conference) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT journal_id_unique IF NOT EXISTS
FOR (n:Journal) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT dataset_id_unique IF NOT EXISTS
FOR (n:Dataset) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT project_id_unique IF NOT EXISTS
FOR (n:Project) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT funding_agency_id_unique IF NOT EXISTS
FOR (n:FundingAgency) REQUIRE n.id IS UNIQUE;

// --- Natural keys: globally unique by definition ---------------------------

// A researcher has exactly one ORCID, and one institutional e-mail. Both are
// how an external system would identify the same person.
CREATE CONSTRAINT author_orcid_unique IF NOT EXISTS
FOR (n:Author) REQUIRE n.orcid IS UNIQUE;

CREATE CONSTRAINT author_email_unique IF NOT EXISTS
FOR (n:Author) REQUIRE n.email IS UNIQUE;

// A DOI resolves to exactly one publication.
CREATE CONSTRAINT paper_doi_unique IF NOT EXISTS
FOR (n:Paper) REQUIRE n.doi IS UNIQUE;

// Institution names are the merge key when ingesting from multiple sources.
CREATE CONSTRAINT university_name_unique IF NOT EXISTS
FOR (n:University) REQUIRE n.name IS UNIQUE;

// Topic and keyword names are the vocabulary. Duplicates here fragment the
// semantic layer, which is what every similarity traversal depends on.
CREATE CONSTRAINT topic_name_unique IF NOT EXISTS
FOR (n:ResearchTopic) REQUIRE n.name IS UNIQUE;

CREATE CONSTRAINT keyword_term_unique IF NOT EXISTS
FOR (n:Keyword) REQUIRE n.term IS UNIQUE;

// The acronym is how a conference is actually referred to and cited.
CREATE CONSTRAINT conference_acronym_unique IF NOT EXISTS
FOR (n:Conference) REQUIRE n.acronym IS UNIQUE;

// ISSN is the international serial identifier for a journal.
CREATE CONSTRAINT journal_issn_unique IF NOT EXISTS
FOR (n:Journal) REQUIRE n.issn IS UNIQUE;

CREATE CONSTRAINT dataset_name_unique IF NOT EXISTS
FOR (n:Dataset) REQUIRE n.name IS UNIQUE;

CREATE CONSTRAINT funding_agency_name_unique IF NOT EXISTS
FOR (n:FundingAgency) REQUIRE n.name IS UNIQUE;

// ---------------------------------------------------------------------------
// A note on existence constraints
//
// Property-existence and node-key constraints are an Enterprise feature in
// Neo4j and are not guaranteed across OpenCypher engines. Required-field
// enforcement therefore lives in two places that are always available:
//
//   * the seed pipeline, which is strongly typed and cannot emit a row missing
//     a required property; and
//   * `database/validation/*.cypher`, which detects violations after the fact.
//
// If your CognoDB deployment supports them, the equivalents would be:
//
//   CREATE CONSTRAINT author_name_exists IF NOT EXISTS
//   FOR (n:Author) REQUIRE n.name IS NOT NULL;
// ---------------------------------------------------------------------------
