import { cypher } from '../database/cypher-tag.js';

/**
 * Analytics queries.
 *
 * Everything here is computed from the live graph. There is no pre-aggregated
 * reporting table, because in a property graph the aggregate is just a
 * traversal with a `count()` on the end - the same statement that would need a
 * nightly batch job and a star schema in a relational warehouse.
 */

export const NODE_LABEL_COUNTS = cypher`
  MATCH (node)
  WITH head(labels(node)) AS label, count(node) AS total
  ORDER BY total DESC
  RETURN { label: label, count: total } AS row
`;

export const RELATIONSHIP_TYPE_COUNTS = cypher`
  MATCH ()-[rel]->()
  WITH type(rel) AS type, count(rel) AS total
  ORDER BY total DESC
  RETURN { type: type, count: total } AS row
`;

export const PUBLICATIONS_BY_YEAR = cypher`
  MATCH (paper:Paper)
  WHERE ($fromYear IS NULL OR paper.year >= $fromYear)
  WITH paper.year AS year, count(paper) AS total
  ORDER BY year ASC
  RETURN { year: year, count: total } AS row
`;

export const TOP_TOPICS = cypher`
  MATCH (topic:ResearchTopic)
  WITH topic
  ORDER BY topic.paperCount DESC, topic.name ASC
  LIMIT $limit
  RETURN {
    id: topic.id, name: topic.name, field: topic.field,
    description: topic.description, emergenceYear: topic.emergenceYear,
    paperCount: topic.paperCount
  } AS topic
`;

export const TOP_AUTHORS = cypher`
  MATCH (author:Author)
  WITH author
  ORDER BY author.citationCount DESC, author.hIndex DESC
  LIMIT $limit
  OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH author, head(collect(university)) AS home
  RETURN {
    id: author.id, name: author.name, title: author.title, orcid: author.orcid,
    hIndex: author.hIndex, citationCount: author.citationCount,
    paperCount: author.paperCount, primaryField: author.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END
  } AS author
`;

/**
 * Institutional output measured by traversal rather than by a stored counter:
 * university → researchers → papers, deduplicated because co-authors at the
 * same institution would otherwise count a paper twice.
 */
export const TOP_UNIVERSITIES = cypher`
  MATCH (university:University)<-[:AFFILIATED_WITH]-(:Author)-[:AUTHORED]->(paper:Paper)
  WITH university,
       count(DISTINCT paper) AS paperCount,
       sum(coalesce(paper.citationCount, 0)) AS citationCount
  ORDER BY citationCount DESC, paperCount DESC
  LIMIT $limit
  RETURN {
    id: university.id, name: university.name, country: university.country,
    city: university.city, type: university.type, foundedYear: university.foundedYear,
    ranking: university.ranking, researcherCount: university.researcherCount,
    paperCount: paperCount, citationCount: citationCount
  } AS university
`;

export const TOP_VENUES = cypher`
  MATCH (paper:Paper)-[:PRESENTED_AT]->(conference:Conference)
  WITH conference AS venue, 'conference' AS kind, conference.acronym AS name,
       count(paper) AS paperCount, sum(coalesce(paper.citationCount, 0)) AS citationCount
  RETURN { id: venue.id, name: name, kind: kind,
           paperCount: paperCount, citationCount: citationCount } AS venue
  ORDER BY citationCount DESC
  LIMIT $limit

  UNION ALL

  MATCH (paper:Paper)-[:PUBLISHED_IN]->(journal:Journal)
  WITH journal AS venue, 'journal' AS kind, journal.name AS name,
       count(paper) AS paperCount, sum(coalesce(paper.citationCount, 0)) AS citationCount
  RETURN { id: venue.id, name: name, kind: kind,
           paperCount: paperCount, citationCount: citationCount } AS venue
  ORDER BY citationCount DESC
  LIMIT $limit
`;

/**
 * Collaboration health in one query.
 *
 * Each metric is a small traversal, and they are combined at the end. The
 * cross-institution and international shares in particular have no cheap
 * relational equivalent: both require grouping a paper's authors by their
 * affiliations before the comparison can even be expressed.
 */
export const COLLABORATION_STATS = cypher`
  MATCH (paper:Paper)
  OPTIONAL MATCH (author:Author)-[:AUTHORED]->(paper)
  WITH paper, count(author) AS authorCount
  WITH avg(toFloat(authorCount)) AS averageAuthorsPerPaper

  MATCH (author:Author)
  OPTIONAL MATCH (author)-[:COLLABORATED_WITH]-(peer:Author)
  WITH averageAuthorsPerPaper, author, count(DISTINCT peer) AS peerCount
  WITH averageAuthorsPerPaper, avg(toFloat(peerCount)) AS averageCollaboratorsPerAuthor

  MATCH (paper:Paper)<-[:AUTHORED]-(:Author)-[:AFFILIATED_WITH]->(university:University)
  WITH averageAuthorsPerPaper, averageCollaboratorsPerAuthor, paper,
       count(DISTINCT university) AS institutionCount,
       count(DISTINCT university.country) AS countryCount
  WITH averageAuthorsPerPaper, averageCollaboratorsPerAuthor,
       count(paper) AS measuredPapers,
       sum(CASE WHEN institutionCount > 1 THEN 1 ELSE 0 END) AS crossInstitutionPapers,
       sum(CASE WHEN countryCount > 1 THEN 1 ELSE 0 END) AS internationalPapers

  RETURN {
    averageAuthorsPerPaper: coalesce(averageAuthorsPerPaper, 0.0),
    averageCollaboratorsPerAuthor: coalesce(averageCollaboratorsPerAuthor, 0.0),
    crossInstitutionShare: CASE WHEN measuredPapers = 0 THEN 0.0
                                ELSE toFloat(crossInstitutionPapers) / toFloat(measuredPapers) END,
    internationalShare: CASE WHEN measuredPapers = 0 THEN 0.0
                             ELSE toFloat(internationalPapers) / toFloat(measuredPapers) END
  } AS stats
`;

/** Headline counters for the dashboard hero row. */
export const DASHBOARD_TOTALS = cypher`
  MATCH (author:Author)
  WITH count(author) AS authorCount
  MATCH (paper:Paper)
  WITH authorCount, count(paper) AS paperCount, sum(coalesce(paper.citationCount, 0)) AS citationCount
  MATCH (topic:ResearchTopic)
  WITH authorCount, paperCount, citationCount, count(topic) AS topicCount
  MATCH (university:University)
  WITH authorCount, paperCount, citationCount, topicCount, count(university) AS universityCount
  MATCH (project:Project)
  WITH authorCount, paperCount, citationCount, topicCount, universityCount,
       count(project) AS projectCount, sum(coalesce(project.budgetUsd, 0)) AS fundedUsd
  RETURN {
    authorCount: authorCount,
    paperCount: paperCount,
    citationCount: citationCount,
    topicCount: topicCount,
    universityCount: universityCount,
    projectCount: projectCount,
    fundedUsd: fundedUsd
  } AS totals
`;

/**
 * Most cited papers, counted by traversal rather than read from a column.
 *
 * `citationCount` is stored on the node, but counting incoming `CITES` edges is
 * the honest number: it reflects the graph as it actually is, and it is what
 * makes a stale or drifting counter visible instead of silently authoritative.
 * Both are returned so the two can be compared.
 */
export const MOST_CITED_PAPERS = cypher`
  MATCH (paper:Paper)<-[:CITES]-(citing:Paper)
  WHERE ($fromYear IS NULL OR paper.year >= $fromYear)
  WITH paper, count(DISTINCT citing) AS inGraphCitations
  ORDER BY inGraphCitations DESC, paper.year DESC
  LIMIT $limit

  OPTIONAL MATCH (author:Author)-[authorship:AUTHORED]->(paper)
  WITH paper, inGraphCitations, author, authorship
  ORDER BY inGraphCitations DESC, authorship.position ASC
  WITH paper, inGraphCitations,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL][0..5] AS authors

  OPTIONAL MATCH (paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH paper, inGraphCitations, authors,
       [entry IN collect(DISTINCT
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  RETURN {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    doi: paper.doi,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount,
    inGraphCitations: inGraphCitations,
    authors: authors,
    topics: topics,
    venue: NULL
  } AS paper
  ORDER BY paper.inGraphCitations DESC
`;

/**
 * Keywords ranked by how many *other* keywords they co-occur with.
 *
 * Degree in the co-occurrence graph, not paper count: a term used on a thousand
 * papers that all sit in one niche is less connective than one appearing across
 * many distinct vocabularies. This is the query that identifies the terms
 * holding the research vocabulary together, and it has no non-graph equivalent
 * short of a self-join over every paper's keyword set.
 */
export const MOST_CONNECTED_KEYWORDS = cypher`
  MATCH (keyword:Keyword)<-[:HAS_KEYWORD]-(paper:Paper)-[:HAS_KEYWORD]->(peer:Keyword)
  WHERE peer.id <> keyword.id
  WITH keyword,
       count(DISTINCT peer) AS connectedKeywordCount,
       count(DISTINCT paper) AS sharedPaperCount
  ORDER BY connectedKeywordCount DESC, sharedPaperCount DESC
  LIMIT $limit

  OPTIONAL MATCH (keyword)<-[:HAS_KEYWORD]-(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH keyword, connectedKeywordCount, sharedPaperCount, topic, count(*) AS topicWeight
  ORDER BY connectedKeywordCount DESC, topicWeight DESC
  WITH keyword, connectedKeywordCount, sharedPaperCount,
       [entry IN collect(
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL][0..5] AS topTopics

  RETURN {
    id: keyword.id,
    term: keyword.term,
    paperCount: keyword.paperCount,
    connectedKeywordCount: connectedKeywordCount,
    sharedPaperCount: sharedPaperCount,
    topTopics: topTopics
  } AS keyword
  ORDER BY keyword.connectedKeywordCount DESC
`;

/**
 * Research fields ranked by the funding flowing into them.
 *
 * The money is three hops from the field: Agency→FUNDS→Project→HAS_TOPIC→Topic,
 * with the field on the topic. No column anywhere in the model holds "funding
 * per field" — it exists only as a traversal, which is precisely the point.
 */
export const MOST_FUNDED_RESEARCH_AREAS = cypher`
  MATCH (agency:FundingAgency)-[grant:FUNDS]->(project:Project)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WHERE ($fromYear IS NULL OR project.startYear >= $fromYear)
  WITH topic.field AS field,
       sum(coalesce(grant.amountUsd, 0)) AS totalAwardedUsd,
       count(DISTINCT project) AS projectCount,
       count(DISTINCT agency) AS agencyCount,
       collect(DISTINCT topic) AS fieldTopics
  ORDER BY totalAwardedUsd DESC
  LIMIT $limit

  RETURN {
    field: field,
    totalAwardedUsd: totalAwardedUsd,
    projectCount: projectCount,
    agencyCount: agencyCount,
    averageAwardUsd: CASE WHEN projectCount = 0 THEN 0
                          ELSE toFloat(totalAwardedUsd) / toFloat(projectCount) END,
    topTopics: [topic IN fieldTopics[0..5] |
                 { id: topic.id, name: topic.name, field: topic.field }]
  } AS row
  ORDER BY row.totalAwardedUsd DESC
`;

/**
 * Institutions ranked by how much of their work crosses institutional lines.
 *
 * `partnerCount` counts distinct peer institutions reached through co-authorship
 * — not papers published, which measures size rather than openness. A mid-sized
 * university collaborating with forty others outranks a large one publishing
 * mostly with itself.
 */
export const MOST_COLLABORATIVE_INSTITUTIONS = cypher`
  MATCH (university:University)<-[:AFFILIATED_WITH]-(author:Author)
        -[:COLLABORATED_WITH]-(peer:Author)-[:AFFILIATED_WITH]->(partner:University)
  WHERE partner.id <> university.id
    AND ($country IS NULL OR university.country = $country)
  WITH university,
       count(DISTINCT partner) AS partnerCount,
       count(DISTINCT peer) AS externalCollaboratorCount,
       count(DISTINCT author) AS engagedResearcherCount,
       collect(DISTINCT partner)[0..5] AS partners
  ORDER BY partnerCount DESC, externalCollaboratorCount DESC
  LIMIT $limit

  RETURN {
    id: university.id,
    name: university.name,
    country: university.country,
    city: university.city,
    type: university.type,
    foundedYear: university.foundedYear,
    ranking: university.ranking,
    researcherCount: university.researcherCount,
    partnerCount: partnerCount,
    externalCollaboratorCount: externalCollaboratorCount,
    engagedResearcherCount: engagedResearcherCount,
    topPartners: [partner IN partners |
                   { id: partner.id, name: partner.name, country: partner.country }]
  } AS university
  ORDER BY university.partnerCount DESC
`;

/**
 * Trivial statement used by the readiness probe.
 *
 * Verifies the engine actually executes Cypher, not merely that a socket is
 * open — a driver can hold a live connection to an instance that rejects work.
 */
export const HEALTH_PROBE = cypher`
  RETURN 1 AS ok
`;
