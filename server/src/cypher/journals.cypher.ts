import { cypher } from '../database/cypher-tag.js';

/**
 * Journal venue queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_JOURNALS = cypher`
  MATCH (journal:Journal)
  WHERE ($search IS NULL OR journal.searchText CONTAINS $search)
    AND ($field IS NULL OR journal.field = $field)
    AND ($minImpactFactor IS NULL OR journal.impactFactor >= $minImpactFactor)
  WITH journal
  ORDER BY
    CASE $sort WHEN 'papers' THEN toFloat(journal.paperCount)
               ELSE journal.impactFactor END DESC,
    journal.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: journal.id,
    name: journal.name,
    publisher: journal.publisher,
    issn: journal.issn,
    field: journal.field,
    impactFactor: journal.impactFactor,
    paperCount: journal.paperCount
  } AS journal
`;

export const COUNT_JOURNALS = cypher`
  MATCH (journal:Journal)
  WHERE ($search IS NULL OR journal.searchText CONTAINS $search)
    AND ($field IS NULL OR journal.field = $field)
    AND ($minImpactFactor IS NULL OR journal.impactFactor >= $minImpactFactor)
  RETURN count(journal) AS total
`;

export const GET_JOURNAL_DETAIL = cypher`
  MATCH (journal:Journal { id: $id })

  OPTIONAL MATCH (journal)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH journal, [entry IN collect(
         CASE WHEN topic IS NULL THEN NULL
              ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  OPTIONAL MATCH (paper:Paper)-[:PUBLISHED_IN]->(journal)
  WITH journal, topics, paper
  ORDER BY paper.citationCount DESC
  WITH journal, topics,
       [entry IN collect(
          CASE WHEN paper IS NULL THEN NULL ELSE {
            id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
            citationCount: paper.citationCount, referenceCount: paper.referenceCount,
            authors: [], topics: [], venue: NULL
          } END
       ) WHERE entry IS NOT NULL][0..10] AS topPapers

  OPTIONAL MATCH (author:Author)-[:AUTHORED]->(:Paper)-[:PUBLISHED_IN]->(journal)
  WITH journal, topics, topPapers, author, count(*) AS venuePapers
  ORDER BY venuePapers DESC, author.hIndex DESC
  WITH journal, topics, topPapers,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE {
            id: author.id, name: author.name, title: author.title, orcid: author.orcid,
            hIndex: author.hIndex, citationCount: author.citationCount,
            paperCount: author.paperCount, primaryField: author.primaryField, affiliation: NULL
          } END
       ) WHERE entry IS NOT NULL][0..10] AS topAuthors

  RETURN {
    id: journal.id,
    name: journal.name,
    publisher: journal.publisher,
    issn: journal.issn,
    field: journal.field,
    impactFactor: journal.impactFactor,
    paperCount: journal.paperCount,
    website: journal.website,
    topics: topics,
    topPapers: topPapers,
    topAuthors: topAuthors
  } AS journal
`;
