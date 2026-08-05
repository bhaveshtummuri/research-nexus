import { cypher } from '../database/cypher-tag.js';

/**
 * Research project queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_PROJECTS = cypher`
  MATCH (project:Project)
  WHERE ($search IS NULL OR project.searchText CONTAINS $search)
    AND ($status IS NULL OR project.status = $status)
  WITH project
  ORDER BY
    CASE $sort WHEN 'start' THEN toFloat(project.startYear)
               ELSE toFloat(project.budgetUsd) END DESC,
    project.title ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: project.id,
    title: project.title,
    summary: project.summary,
    status: project.status,
    startYear: project.startYear,
    endYear: project.endYear,
    budgetUsd: project.budgetUsd
  } AS project
`;

export const COUNT_PROJECTS = cypher`
  MATCH (project:Project)
  WHERE ($search IS NULL OR project.searchText CONTAINS $search)
    AND ($status IS NULL OR project.status = $status)
  RETURN count(project) AS total
`;
