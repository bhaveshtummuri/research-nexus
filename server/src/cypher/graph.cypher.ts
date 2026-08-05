import { cypher } from '../database/cypher-tag.js';

/**
 * Queries that return subgraphs for the interactive visualisation.
 *
 * The renderer needs three things: a deduplicated node set, the relationships
 * between exactly those nodes, and a degree per node so hubs can be drawn
 * larger. All three are produced server-side, because sending a raw path list
 * and deduplicating in the browser wastes bandwidth and frame time.
 */

/**
 * Expands the neighbourhood around a single entity.
 *
 * The variable-length pattern is bounded structurally at three hops and further
 * narrowed by `$maxDepth`. `$limit` caps the node count so a hub node - a
 * prolific author, a popular topic - can never return a subgraph large enough to
 * stall the client.
 */
export const EXPAND_NEIGHBOURHOOD = cypher`
  MATCH (start) WHERE start.id = $startId
  MATCH path = (start)-[*1..3]-(reached)
  WHERE length(path) <= $maxDepth
    AND ($relationshipTypes IS NULL OR
         all(rel IN relationships(path) WHERE type(rel) IN $relationshipTypes))
  WITH start, reached, min(length(path)) AS distance
  ORDER BY distance ASC, coalesce(reached.citationCount, reached.paperCount, 0) DESC
  LIMIT $limit
  WITH start, collect(reached) AS reachedNodes
  WITH [start] + reachedNodes AS allNodes
  UNWIND allNodes AS node
  WITH collect(DISTINCT node) AS nodes

  UNWIND nodes AS source
  UNWIND nodes AS target
  WITH nodes, source, target
  WHERE elementId(source) < elementId(target)
  OPTIONAL MATCH (source)-[rel]-(target)
  WITH nodes, [entry IN collect(DISTINCT rel) WHERE entry IS NOT NULL] AS edges

  RETURN {
    nodes: [node IN nodes | {
      elementId: elementId(node),
      id: node.id,
      label: head(labels(node)),
      name: coalesce(node.name, node.title, node.term, node.id),
      caption: coalesce(node.primaryField, node.field, node.country, node.domain,
                        node.status, node.publisher, toString(node.year), ''),
      properties: properties(node)
    }],
    edges: [rel IN edges | {
      elementId: elementId(rel),
      type: type(rel),
      source: elementId(startNode(rel)),
      target: elementId(endNode(rel)),
      properties: properties(rel)
    }]
  } AS graph
`;

/**
 * The landing view of the graph explorer.
 *
 * It samples the most connected entities across several labels so the first
 * render is immediately interesting rather than an arbitrary slice, then
 * returns every relationship among them.
 */
export const SAMPLE_GRAPH = cypher`
  MATCH (author:Author)
  WITH author ORDER BY author.citationCount DESC LIMIT $authorLimit
  WITH collect(author) AS authors

  MATCH (paper:Paper)
  WITH authors, paper ORDER BY paper.citationCount DESC LIMIT $paperLimit
  WITH authors, collect(paper) AS papers

  MATCH (topic:ResearchTopic)
  WITH authors, papers, topic ORDER BY topic.paperCount DESC LIMIT $topicLimit
  WITH authors, papers, collect(topic) AS topics

  MATCH (university:University)
  WITH authors, papers, topics, university ORDER BY university.researcherCount DESC LIMIT $universityLimit
  WITH authors + papers + topics + collect(university) AS combined

  UNWIND combined AS node
  WITH collect(DISTINCT node) AS nodes

  UNWIND nodes AS source
  UNWIND nodes AS target
  WITH nodes, source, target
  WHERE elementId(source) < elementId(target)
  OPTIONAL MATCH (source)-[rel]-(target)
  WITH nodes, [entry IN collect(DISTINCT rel) WHERE entry IS NOT NULL] AS edges

  RETURN {
    nodes: [node IN nodes | {
      elementId: elementId(node),
      id: node.id,
      label: head(labels(node)),
      name: coalesce(node.name, node.title, node.term, node.id),
      caption: coalesce(node.primaryField, node.field, node.country, node.domain, ''),
      properties: properties(node)
    }],
    edges: [rel IN edges | {
      elementId: elementId(rel),
      type: type(rel),
      source: elementId(startNode(rel)),
      target: elementId(endNode(rel)),
      properties: properties(rel)
    }]
  } AS graph
`;

/**
 * Builds a subgraph from an explicit node id list.
 *
 * The path finder uses it to turn a discovered route into something the
 * visualiser can render together with the surrounding context.
 */
export const SUBGRAPH_FOR_IDS = cypher`
  MATCH (node) WHERE node.id IN $ids
  WITH collect(DISTINCT node) AS nodes

  UNWIND nodes AS source
  UNWIND nodes AS target
  WITH nodes, source, target
  WHERE elementId(source) < elementId(target)
  OPTIONAL MATCH (source)-[rel]-(target)
  WITH nodes, [entry IN collect(DISTINCT rel) WHERE entry IS NOT NULL] AS edges

  RETURN {
    nodes: [node IN nodes | {
      elementId: elementId(node),
      id: node.id,
      label: head(labels(node)),
      name: coalesce(node.name, node.title, node.term, node.id),
      caption: coalesce(node.primaryField, node.field, node.country, node.domain, ''),
      properties: properties(node)
    }],
    edges: [rel IN edges | {
      elementId: elementId(rel),
      type: type(rel),
      source: elementId(startNode(rel)),
      target: elementId(endNode(rel)),
      properties: properties(rel)
    }]
  } AS graph
`;

/**
 * Degrees for a set of nodes, used to size them in the layout. Kept separate
 * from the subgraph queries so the expensive part - counting every incident
 * relationship, not just the ones inside the subgraph - runs only once.
 */
export const NODE_DEGREES = cypher`
  MATCH (node) WHERE node.id IN $ids
  OPTIONAL MATCH (node)-[rel]-()
  WITH node, count(rel) AS degree
  RETURN { id: node.id, degree: degree } AS row
`;
