// ---------------------------------------------------------------------------
// Research Nexus - OPTIONAL full-text acceleration
//
// The application never requires these indexes. Global search runs on the
// portable `searchText` + CONTAINS strategy defined in `02-indexes.cypher`,
// which works on any OpenCypher engine.
//
// If your CognoDB deployment exposes Neo4j-compatible full-text indexes, apply
// this file to get relevance-scored search over abstracts and descriptions:
//
//   npm run db:schema -- --with-fulltext
//
// The schema runner tolerates failures in this file, so applying it against an
// engine without full-text support is a no-op rather than an error.
// ---------------------------------------------------------------------------

CREATE FULLTEXT INDEX author_fulltext IF NOT EXISTS
FOR (n:Author) ON EACH [n.name, n.title, n.researchStatement];

CREATE FULLTEXT INDEX paper_fulltext IF NOT EXISTS
FOR (n:Paper) ON EACH [n.title, n.abstract];

CREATE FULLTEXT INDEX topic_fulltext IF NOT EXISTS
FOR (n:ResearchTopic) ON EACH [n.name, n.description];

CREATE FULLTEXT INDEX project_fulltext IF NOT EXISTS
FOR (n:Project) ON EACH [n.title, n.summary];
