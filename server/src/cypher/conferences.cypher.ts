import { cypher } from '../database/cypher-tag.js';

/**
 * Conference venue queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_CONFERENCES = cypher`
  MATCH (conference:Conference)
  WHERE ($search IS NULL OR conference.searchText CONTAINS $search)
    AND ($field IS NULL OR conference.field = $field)
    AND ($tier IS NULL OR conference.tier = $tier)
  WITH conference
  ORDER BY
    CASE $sort WHEN 'founded' THEN conference.foundedYear
               ELSE conference.paperCount END DESC,
    conference.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: conference.id,
    name: conference.name,
    acronym: conference.acronym,
    field: conference.field,
    tier: conference.tier,
    foundedYear: conference.foundedYear,
    paperCount: conference.paperCount
  } AS conference
`;

export const COUNT_CONFERENCES = cypher`
  MATCH (conference:Conference)
  WHERE ($search IS NULL OR conference.searchText CONTAINS $search)
    AND ($field IS NULL OR conference.field = $field)
    AND ($tier IS NULL OR conference.tier = $tier)
  RETURN count(conference) AS total
`;

export const GET_CONFERENCE_DETAIL = cypher`
  MATCH (conference:Conference { id: $id })

  OPTIONAL MATCH (conference)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH conference, [entry IN collect(
         CASE WHEN topic IS NULL THEN NULL
              ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  OPTIONAL MATCH (paper:Paper)-[:PRESENTED_AT]->(conference)
  WITH conference, topics, paper
  ORDER BY paper.citationCount DESC
  WITH conference, topics,
       [entry IN collect(
          CASE WHEN paper IS NULL THEN NULL ELSE {
            id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
            citationCount: paper.citationCount, referenceCount: paper.referenceCount,
            authors: [], topics: [], venue: NULL
          } END
       ) WHERE entry IS NOT NULL][0..10] AS topPapers,
       [entry IN collect(paper) WHERE entry IS NOT NULL] AS allPapers

  UNWIND (CASE WHEN size(allPapers) = 0 THEN [NULL] ELSE allPapers END) AS venuePaper
  WITH conference, topics, topPapers, venuePaper.year AS year, count(venuePaper) AS yearCount
  ORDER BY year ASC
  WITH conference, topics, topPapers,
       [entry IN collect(
          CASE WHEN year IS NULL THEN NULL ELSE { year: year, count: yearCount } END
       ) WHERE entry IS NOT NULL] AS yearlyOutput

  OPTIONAL MATCH (author:Author)-[:AUTHORED]->(:Paper)-[:PRESENTED_AT]->(conference)
  WITH conference, topics, topPapers, yearlyOutput, author, count(*) AS venuePapers
  ORDER BY venuePapers DESC, author.hIndex DESC
  WITH conference, topics, topPapers, yearlyOutput,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE {
            id: author.id, name: author.name, title: author.title, orcid: author.orcid,
            hIndex: author.hIndex, citationCount: author.citationCount,
            paperCount: author.paperCount, primaryField: author.primaryField, affiliation: NULL
          } END
       ) WHERE entry IS NOT NULL][0..10] AS topAuthors

  RETURN {
    id: conference.id,
    name: conference.name,
    acronym: conference.acronym,
    field: conference.field,
    tier: conference.tier,
    foundedYear: conference.foundedYear,
    paperCount: conference.paperCount,
    location: conference.location,
    website: conference.website,
    topics: topics,
    topPapers: topPapers,
    topAuthors: topAuthors,
    yearlyOutput: yearlyOutput
  } AS conference
`;
