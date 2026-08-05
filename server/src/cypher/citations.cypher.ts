import { cypher } from '../database/cypher-tag.js';

/**
 * Citation graph traversals.
 *
 * Direction is semantic: outward traces intellectual ancestry, inward traces
 * downstream influence. Cypher cannot parameterise an arrow, so the two
 * directions are two prepared statements - the service selects, never builds.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

/**
 * Walks the citation graph outward from one paper, following `CITES` in a fixed
 * direction so every returned chain is a genuine lineage rather than a mix of
 * citing and cited work.
 *
 * `direction` is expressed as two variants because Cypher cannot parameterise
 * the arrow; the service picks the statement, never builds it.
 */
export const CITATION_CHAINS_FORWARD = cypher`
  MATCH (start:Paper { id: $paperId })
  MATCH path = (start)-[:CITES*1..5]->(cited:Paper)
  WHERE length(path) <= $maxDepth
  WITH path, nodes(path) AS chain
  WITH path, chain,
       reduce(total = 0, paper IN chain | total + coalesce(paper.citationCount, 0)) AS impact
  ORDER BY length(path) DESC, impact DESC
  LIMIT $limit
  RETURN {
    depth: length(path),
    impact: impact,
    papers: [paper IN chain | {
      id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
      citationCount: paper.citationCount, referenceCount: paper.referenceCount,
      authors: [], topics: [], venue: NULL
    }]
  } AS chain
`;

/**
 * The citation tree rooted at one paper, flattened for rendering.
 *
 * A nested structure cannot come back from Cypher directly, so each row instead
 * carries its `depth` and the `parentId` it hangs from — enough for the client
 * to rebuild the tree in one pass, and already the shape a graph renderer wants.
 *
 * `parentId` comes from the *shortest* route to each paper: ordering by path
 * length before `collect` makes `head(collect(path))` the shortest one, so a
 * paper reachable by several routes is attached once, at its shallowest point.
 * Deduplicating this way is what keeps the result a tree rather than a DAG dump.
 */
export const BUILD_CITATION_TREE_FORWARD = cypher`
  MATCH (root:Paper { id: $paperId })
  MATCH path = (root)-[:CITES*1..4]->(cited:Paper)
  WHERE length(path) <= $maxDepth
  WITH cited, path, length(path) AS hops
  ORDER BY hops ASC
  WITH cited, min(hops) AS depth, head(collect(path)) AS shortest
  ORDER BY depth ASC, cited.citationCount DESC
  LIMIT $limit
  RETURN {
    id: cited.id,
    title: cited.title,
    year: cited.year,
    citationCount: cited.citationCount,
    depth: depth,
    parentId: nodes(shortest)[depth - 1].id
  } AS node
  ORDER BY node.depth ASC, node.citationCount DESC
`;

export const BUILD_CITATION_TREE_BACKWARD = cypher`
  MATCH (root:Paper { id: $paperId })
  MATCH path = (root)<-[:CITES*1..4]-(citing:Paper)
  WHERE length(path) <= $maxDepth
  WITH citing, path, length(path) AS hops
  ORDER BY hops ASC
  WITH citing, min(hops) AS depth, head(collect(path)) AS shortest
  ORDER BY depth ASC, citing.citationCount DESC
  LIMIT $limit
  RETURN {
    id: citing.id,
    title: citing.title,
    year: citing.year,
    citationCount: citing.citationCount,
    depth: depth,
    parentId: nodes(shortest)[depth - 1].id
  } AS node
  ORDER BY node.depth ASC, node.citationCount DESC
`;

/**
 * The citation lineage carrying the most accumulated influence.
 *
 * Ranking by summed citations along the route rather than by length answers a
 * different question from `shortestPath`: not "how is this connected" but
 * "which line of descent from this paper mattered most". A four-hop chain
 * through seminal work outranks a two-hop chain through obscure work.
 */
export const FIND_INFLUENTIAL_CITATION_PATH = cypher`
  MATCH (start:Paper { id: $paperId })
  MATCH path = (start)-[:CITES*1..5]->(target:Paper)
  WHERE length(path) <= $maxDepth
  WITH path,
       reduce(total = 0, paper IN nodes(path) | total + coalesce(paper.citationCount, 0)) AS influence
  ORDER BY influence DESC, length(path) ASC
  LIMIT $limit
  RETURN {
    length: length(path),
    influence: influence,
    nodes: [node IN nodes(path) | {
      elementId: elementId(node),
      id: node.id,
      label: head(labels(node)),
      name: coalesce(node.title, node.name, node.id)
    }],
    edges: [rel IN relationships(path) | {
      elementId: elementId(rel),
      type: type(rel),
      startElementId: elementId(startNode(rel)),
      endElementId: elementId(endNode(rel)),
      properties: properties(rel)
    }]
  } AS path
  ORDER BY path.influence DESC
`;

/**
 * Shortest citation route between two papers.
 *
 * Distinct from the collaboration path: this answers "how does this work
 * descend from that one", so the traversal is restricted to `CITES` and left
 * undirected — a lineage that runs forward for two hops and back for one is
 * still a real intellectual link, and forcing a direction would hide it.
 */
export const SHORTEST_CITATION_PATH = cypher`
  MATCH (from:Paper { id: $fromId })
  MATCH (to:Paper { id: $toId })
  MATCH path = shortestPath((from)-[:CITES*1..10]-(to))
  WITH path
  WHERE length(path) <= $maxDepth
  RETURN {
    length: length(path),
    nodes: [node IN nodes(path) | {
      elementId: elementId(node),
      id: node.id,
      label: head(labels(node)),
      name: coalesce(node.name, node.title, node.term, node.id)
    }],
    edges: [rel IN relationships(path) | {
      elementId: elementId(rel),
      type: type(rel),
      startElementId: elementId(startNode(rel)),
      endElementId: elementId(endNode(rel)),
      properties: properties(rel)
    }]
  } AS path
`;

export const CITATION_CHAINS_BACKWARD = cypher`
  MATCH (start:Paper { id: $paperId })
  MATCH path = (start)<-[:CITES*1..5]-(citing:Paper)
  WHERE length(path) <= $maxDepth
  WITH path, nodes(path) AS chain
  WITH path, chain,
       reduce(total = 0, paper IN chain | total + coalesce(paper.citationCount, 0)) AS impact
  ORDER BY length(path) DESC, impact DESC
  LIMIT $limit
  RETURN {
    depth: length(path),
    impact: impact,
    papers: [paper IN chain | {
      id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
      citationCount: paper.citationCount, referenceCount: paper.referenceCount,
      authors: [], topics: [], venue: NULL
    }]
  } AS chain
`;
