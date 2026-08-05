import { cypher } from '../database/cypher-tag.js';

/**
 * Global search across every node label in one round trip.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

/**
 * Global search.
 *
 * Every searchable node carries a lowercased `searchText` property written at
 * seed time and backed by a range index. Matching a single indexed property with
 * `CONTAINS` keeps the query pure OpenCypher - no vendor-specific full-text
 * engine required - while still letting the planner use the index.
 *
 * The branches are combined with `UNION ALL` so one round trip serves the whole
 * command palette. Ranking prefers prefix matches, then popularity, so typing
 * "gra" surfaces "Graph Neural Networks" ahead of a paper that merely mentions
 * the word.
 */
export const SEARCH_ALL = cypher`
  MATCH (node:Author)
  WHERE node.searchText CONTAINS $query
  RETURN 'Author' AS label, node.id AS id, node.name AS title,
         node.title + ' · ' + coalesce(node.primaryField, '') AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.citationCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Paper)
  WHERE node.searchText CONTAINS $query
  RETURN 'Paper' AS label, node.id AS id, node.title AS title,
         toString(node.year) + ' · ' + toString(coalesce(node.citationCount, 0)) + ' citations' AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.citationCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:ResearchTopic)
  WHERE node.searchText CONTAINS $query
  RETURN 'ResearchTopic' AS label, node.id AS id, node.name AS title,
         node.field + ' · ' + toString(coalesce(node.paperCount, 0)) + ' papers' AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.paperCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:University)
  WHERE node.searchText CONTAINS $query
  RETURN 'University' AS label, node.id AS id, node.name AS title,
         node.city + ', ' + node.country AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.researcherCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Conference)
  WHERE node.searchText CONTAINS $query
  RETURN 'Conference' AS label, node.id AS id, node.name AS title,
         node.acronym + ' · tier ' + node.tier AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.paperCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Journal)
  WHERE node.searchText CONTAINS $query
  RETURN 'Journal' AS label, node.id AS id, node.name AS title,
         node.publisher + ' · IF ' + toString(node.impactFactor) AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + node.impactFactor / 100.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Project)
  WHERE node.searchText CONTAINS $query
  RETURN 'Project' AS label, node.id AS id, node.title AS title,
         node.status + ' · ' + toString(node.startYear) + '-' + toString(node.endYear) AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END) AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:FundingAgency)
  WHERE node.searchText CONTAINS $query
  RETURN 'FundingAgency' AS label, node.id AS id, node.name AS title,
         node.type + ' · ' + node.country AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END) AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Dataset)
  WHERE node.searchText CONTAINS $query
  RETURN 'Dataset' AS label, node.id AS id, node.name AS title,
         node.domain + ' · ' + node.license AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.paperCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel

  UNION ALL

  MATCH (node:Keyword)
  WHERE node.searchText CONTAINS $query
  RETURN 'Keyword' AS label, node.id AS id, node.term AS title,
         toString(coalesce(node.paperCount, 0)) + ' papers' AS subtitle,
         (CASE WHEN node.searchText STARTS WITH $query THEN 2.0 ELSE 1.0 END)
           + log(toFloat(coalesce(node.paperCount, 0)) + 1) / 10.0 AS score
  ORDER BY score DESC LIMIT $perLabel
`;
