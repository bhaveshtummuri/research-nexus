import { cypher } from '../database/cypher-tag.js';

/**
 * Keyword vocabulary and keyword-scoped paper lookup.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_KEYWORDS = cypher`
  MATCH (keyword:Keyword)
  WHERE ($search IS NULL OR keyword.searchText CONTAINS $search)
  WITH keyword
  ORDER BY keyword.paperCount DESC, keyword.term ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: keyword.id,
    term: keyword.term,
    paperCount: keyword.paperCount
  } AS keyword
`;

/**
 * Papers carrying a given keyword. Backs the "search by keyword" affordance in
 * the paper explorer, where the keyword is an entity rather than a substring.
 */
export const SEARCH_PAPERS_BY_KEYWORD = cypher`
  MATCH (keyword:Keyword { id: $keywordId })<-[:HAS_KEYWORD]-(paper:Paper)
  WITH paper
  ORDER BY paper.citationCount DESC, paper.year DESC
  SKIP $offset LIMIT $limit

  OPTIONAL MATCH (author:Author)-[authorship:AUTHORED]->(paper)
  WITH paper, author, authorship
  ORDER BY authorship.position ASC
  WITH paper, [entry IN collect(
         CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL] AS authors

  OPTIONAL MATCH (paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH paper, authors, [entry IN collect(
         CASE WHEN topic IS NULL THEN NULL
              ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  RETURN {
    id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
    citationCount: paper.citationCount, referenceCount: paper.referenceCount,
    authors: authors, topics: topics, venue: NULL
  } AS paper
`;
