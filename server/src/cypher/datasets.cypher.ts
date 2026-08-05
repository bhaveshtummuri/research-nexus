import { cypher } from '../database/cypher-tag.js';

/**
 * Dataset queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_DATASETS = cypher`
  MATCH (dataset:Dataset)
  WHERE ($search IS NULL OR dataset.searchText CONTAINS $search)
    AND ($domain IS NULL OR dataset.domain = $domain)
  WITH dataset
  ORDER BY
    CASE $sort WHEN 'size' THEN toFloat(dataset.sizeGb)
               WHEN 'recent' THEN toFloat(dataset.releaseYear)
               ELSE toFloat(dataset.paperCount) END DESC,
    dataset.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: dataset.id,
    name: dataset.name,
    domain: dataset.domain,
    license: dataset.license,
    sizeGb: dataset.sizeGb,
    releaseYear: dataset.releaseYear,
    paperCount: dataset.paperCount
  } AS dataset
`;

export const COUNT_DATASETS = cypher`
  MATCH (dataset:Dataset)
  WHERE ($search IS NULL OR dataset.searchText CONTAINS $search)
    AND ($domain IS NULL OR dataset.domain = $domain)
  RETURN count(dataset) AS total
`;
