import { cypher } from '../database/cypher-tag.js';

/**
 * Collaboration network traversals.
 *
 * These run against the materialised COLLABORATED_WITH edge. Expressed through
 * papers, a three-hop collaboration query would be six hops - halving the depth
 * is the difference between a responsive UI and a timeout.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

/**
 * Researchers reachable within N collaboration hops, with the overlap that
 * explains each connection.
 *
 * Two deliberate choices here.
 *
 * The hop traversal runs over the materialised `COLLABORATED_WITH` edge rather
 * than the literal Author→Paper→Author path the domain describes. Expressed
 * through papers, four collaboration hops would be eight pattern hops; halving
 * the depth is the difference between a responsive UI and a timeout. The paper
 * path is still used — but only for enrichment, where it is cheap.
 *
 * That enrichment runs *after* `SKIP`/`LIMIT`. Selecting the page first means
 * the four overlap expansions touch only the rows being returned, not every
 * candidate in the neighbourhood, which is what keeps this query's cost tied to
 * page size rather than to network size.
 */
export const FIND_COLLABORATORS_WITHIN_HOPS = cypher`
  MATCH (start:Author { id: $authorId })
  MATCH path = (start)-[:COLLABORATED_WITH*1..4]-(peer:Author)
  WHERE peer.id <> start.id
    AND length(path) <= $maxDepth
  WITH start, peer, min(length(path)) AS distance
  ORDER BY distance ASC, peer.hIndex DESC, peer.citationCount DESC
  SKIP $offset LIMIT $limit

  // Papers the two actually wrote together - direct evidence, not inference.
  OPTIONAL MATCH (start)-[:AUTHORED]->(joint:Paper)<-[:AUTHORED]-(peer)
  WITH start, peer, distance,
       [entry IN collect(DISTINCT
          CASE WHEN joint IS NULL THEN NULL
               ELSE { id: joint.id, title: joint.title, year: joint.year } END
       ) WHERE entry IS NOT NULL] AS sharedPapers

  OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
                 <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(peer)
  WITH start, peer, distance, sharedPapers,
       [entry IN collect(DISTINCT
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS sharedTopics

  OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_KEYWORD]->(keyword:Keyword)
                 <-[:HAS_KEYWORD]-(:Paper)<-[:AUTHORED]-(peer)
  WITH start, peer, distance, sharedPapers, sharedTopics,
       [entry IN collect(DISTINCT
          CASE WHEN keyword IS NULL THEN NULL
               ELSE { id: keyword.id, term: keyword.term } END
       ) WHERE entry IS NOT NULL] AS sharedKeywords

  OPTIONAL MATCH (start)-[:COLLABORATED_WITH]-(mutual:Author)-[:COLLABORATED_WITH]-(peer)
  WHERE mutual.id <> start.id AND mutual.id <> peer.id
  WITH peer, distance, sharedPapers, sharedTopics, sharedKeywords,
       [entry IN collect(DISTINCT
          CASE WHEN mutual IS NULL THEN NULL
               ELSE { id: mutual.id, name: mutual.name } END
       ) WHERE entry IS NOT NULL] AS sharedCollaborators

  OPTIONAL MATCH (peer)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH peer, distance, sharedPapers, sharedTopics, sharedKeywords, sharedCollaborators,
       head(collect(university)) AS home

  WITH peer, distance, sharedPapers, sharedTopics, sharedKeywords, sharedCollaborators, home,
       toFloat(1) / toFloat(distance) * $proximityWeight +
       toFloat(size(sharedPapers)) * $paperWeight +
       toFloat(size(sharedTopics)) * $topicWeight +
       toFloat(size(sharedKeywords)) * $keywordWeight AS score

  RETURN {
    id: peer.id,
    name: peer.name,
    title: peer.title,
    orcid: peer.orcid,
    hIndex: peer.hIndex,
    citationCount: peer.citationCount,
    paperCount: peer.paperCount,
    primaryField: peer.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END,
    distance: distance,
    score: score,
    reasons: [reason IN [
      { kind: 'shared-collaborator',
        label: 'Reachable in ' + toString(distance) + ' collaboration hop(s)',
        weight: toFloat(1) / toFloat(distance) * $proximityWeight },
      { kind: 'shared-paper',
        label: toString(size(sharedPapers)) + ' co-authored paper(s)',
        weight: toFloat(size(sharedPapers)) * $paperWeight },
      { kind: 'shared-topic',
        label: toString(size(sharedTopics)) + ' shared research topic(s)',
        weight: toFloat(size(sharedTopics)) * $topicWeight },
      { kind: 'shared-keyword',
        label: toString(size(sharedKeywords)) + ' shared keyword(s)',
        weight: toFloat(size(sharedKeywords)) * $keywordWeight }
    ] WHERE reason.weight > 0],
    sharedPapers: sharedPapers,
    sharedTopics: sharedTopics,
    sharedKeywords: sharedKeywords,
    sharedCollaborators: sharedCollaborators
  } AS collaborator
  // Distance leads so the page order matches the pagination key; score ranks
  // within a distance band, where hop count alone cannot separate two peers.
  ORDER BY collaborator.distance ASC, collaborator.score DESC
`;

/**
 * Researchers ranked by the breadth of their collaboration network.
 *
 * The ranking is a graph property, not a stored column: `partnerCount` is the
 * degree of the COLLABORATED_WITH edge, and `institutionCount` counts the
 * distinct institutions those partners sit in — so someone with fifty
 * co-authors down the hall ranks below someone with twenty across ten
 * universities. That distinction is invisible to a row store.
 */
export const MOST_COLLABORATIVE_RESEARCHERS = cypher`
  MATCH (author:Author)-[collaboration:COLLABORATED_WITH]-(peer:Author)
  WHERE ($field IS NULL OR author.primaryField = $field)
  WITH author,
       count(DISTINCT peer) AS partnerCount,
       sum(coalesce(collaboration.paperCount, 1)) AS jointPapers,
       collect(DISTINCT peer)[0..5] AS topPartners
  WHERE partnerCount >= $minPartners

  OPTIONAL MATCH (author)-[:COLLABORATED_WITH]-(:Author)-[:AFFILIATED_WITH]->(peerHome:University)
  WITH author, partnerCount, jointPapers, topPartners,
       count(DISTINCT peerHome) AS institutionCount

  OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH author, partnerCount, jointPapers, topPartners, institutionCount,
       head(collect(university)) AS home

  WITH author, partnerCount, jointPapers, topPartners, institutionCount, home,
       toFloat(partnerCount) * $partnerWeight +
       toFloat(institutionCount) * $institutionWeight AS score
  ORDER BY score DESC, author.citationCount DESC
  SKIP $offset LIMIT $limit

  RETURN {
    id: author.id,
    name: author.name,
    title: author.title,
    orcid: author.orcid,
    hIndex: author.hIndex,
    citationCount: author.citationCount,
    paperCount: author.paperCount,
    primaryField: author.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END,
    partnerCount: partnerCount,
    institutionCount: institutionCount,
    jointPapers: jointPapers,
    score: score,
    topPartners: [partner IN topPartners | { id: partner.id, name: partner.name }]
  } AS researcher
`;

/**
 * Finds researchers two collaboration hops away who also publish on the same
 * topics, and excludes anyone the author has already co-authored with.
 *
 * This is the query that is genuinely hard in SQL: it needs the second-degree
 * co-authorship closure, a topic overlap count and a NOT-EXISTS against the
 * first-degree set, all in one pass.
 */
export const FIND_HIDDEN_COLLABORATORS = cypher`
  MATCH (start:Author { id: $authorId })

  OPTIONAL MATCH (start)-[:COLLABORATED_WITH]-(direct:Author)
  WITH start, collect(DISTINCT direct.id) AS directIds

  MATCH (start)-[:COLLABORATED_WITH]-(bridge:Author)-[:COLLABORATED_WITH]-(candidate:Author)
  WHERE candidate.id <> start.id
    AND NOT candidate.id IN directIds
  WITH start, candidate,
       collect(DISTINCT { id: bridge.id, name: bridge.name }) AS bridges,
       count(DISTINCT bridge) AS bridgeCount

  OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
                 <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(candidate)
  WITH start, candidate, bridges, bridgeCount,
       [entry IN collect(DISTINCT
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS sharedTopics

  // The keyword bridge: Author→Paper→Keyword→Paper→Author. Keywords are finer
  // grained than topics, so two researchers can share none of the latter and
  // still be working on the same problem - which is exactly the pairing this
  // query exists to surface.
  OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_KEYWORD]->(keyword:Keyword)
                 <-[:HAS_KEYWORD]-(:Paper)<-[:AUTHORED]-(candidate)
  WITH start, candidate, bridges, bridgeCount, sharedTopics,
       [entry IN collect(DISTINCT
          CASE WHEN keyword IS NULL THEN NULL
               ELSE { id: keyword.id, term: keyword.term } END
       ) WHERE entry IS NOT NULL] AS sharedKeywords

  WITH candidate, bridges, bridgeCount, sharedTopics, sharedKeywords,
       toFloat(bridgeCount) * $bridgeWeight +
       toFloat(size(sharedTopics)) * $topicWeight +
       toFloat(size(sharedKeywords)) * $keywordWeight AS score
  WHERE size(sharedTopics) >= $minSharedTopics
     OR size(sharedKeywords) >= $minSharedKeywords
  // A second WITH carries the ordering. Cypher parses ORDER BY as part of the
  // projection clause, before WHERE, so ranking in the same WITH that filters
  // would both be a syntax error and rank rows that are about to be discarded.
  WITH candidate, bridges, bridgeCount, sharedTopics, sharedKeywords, score
  ORDER BY score DESC, candidate.hIndex DESC
  SKIP $offset LIMIT $limit

  OPTIONAL MATCH (candidate)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH candidate, bridges, bridgeCount, sharedTopics, sharedKeywords, score,
       head(collect(university)) AS home

  RETURN {
    id: candidate.id,
    name: candidate.name,
    title: candidate.title,
    orcid: candidate.orcid,
    hIndex: candidate.hIndex,
    citationCount: candidate.citationCount,
    paperCount: candidate.paperCount,
    primaryField: candidate.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END,
    distance: 2,
    score: score,
    // Never worked together directly, so there is no shared paper by definition.
    sharedPapers: [],
    sharedTopics: sharedTopics,
    sharedKeywords: sharedKeywords,
    sharedCollaborators: bridges[0..5],
    reasons: [reason IN [
      { kind: 'shared-collaborator',
        label: toString(bridgeCount) + ' mutual collaborator(s)',
        weight: toFloat(bridgeCount) * $bridgeWeight },
      { kind: 'shared-topic',
        label: toString(size(sharedTopics)) + ' shared research topic(s)',
        weight: toFloat(size(sharedTopics)) * $topicWeight },
      { kind: 'shared-keyword',
        label: toString(size(sharedKeywords)) + ' shared keyword(s)',
        weight: toFloat(size(sharedKeywords)) * $keywordWeight }
    ] WHERE reason.weight > 0]
  } AS collaborator
  ORDER BY collaborator.score DESC
`;

/**
 * Finds papers whose topics span two different research fields, then aggregates
 * them into field pairs. The traversal is what makes "cross-domain" definable
 * at all: it is a property of a paper's position in the graph, not a column.
 */
export const FIND_CROSS_DOMAIN_COLLABORATIONS = cypher`
  MATCH (paper:Paper)-[:HAS_TOPIC]->(topicA:ResearchTopic)
  MATCH (paper)-[:HAS_TOPIC]->(topicB:ResearchTopic)
  WHERE topicA.field < topicB.field
    AND ($field IS NULL OR topicA.field = $field OR topicB.field = $field)
  WITH topicA.field AS fieldA, topicB.field AS fieldB, collect(DISTINCT paper) AS papers
  WITH fieldA, fieldB, papers, size(papers) AS paperCount
  WHERE paperCount >= $minPapers

  UNWIND papers AS crossPaper
  MATCH (author:Author)-[:AUTHORED]->(crossPaper)
  WITH fieldA, fieldB, paperCount, papers, count(DISTINCT author) AS authorCount
  ORDER BY paperCount DESC, authorCount DESC
  LIMIT $limit

  RETURN {
    fieldA: fieldA,
    fieldB: fieldB,
    paperCount: paperCount,
    authorCount: authorCount,
    exemplarPapers: [paper IN papers[0..5] | { id: paper.id, title: paper.title, year: paper.year }]
  } AS row
`;

export const SHORTEST_COLLABORATION_PATH = cypher`
  MATCH (from:Author { id: $fromId })
  MATCH (to:Author { id: $toId })
  MATCH path = shortestPath((from)-[:COLLABORATED_WITH*1..10]-(to))
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

/**
 * Every equally short collaboration route, not just one.
 *
 * Alternative shortest paths matter for introductions: knowing there are three
 * different two-hop routes tells you which mutual contact to approach.
 */
export const ALL_SHORTEST_COLLABORATION_PATHS = cypher`
  MATCH (from:Author { id: $fromId })
  MATCH (to:Author { id: $toId })
  MATCH path = allShortestPaths((from)-[:COLLABORATED_WITH*1..8]-(to))
  WITH path
  WHERE length(path) <= $maxDepth
  WITH path
  ORDER BY length(path) ASC
  LIMIT $limit
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

/**
 * Shortest path across *any* relationship type.
 *
 * Two researchers who have never co-authored may still be two hops apart
 * through a shared institution, dataset or funding programme. Leaving the
 * relationship type unconstrained is what makes those routes visible.
 */
export const SHORTEST_ANY_PATH = cypher`
  MATCH (from) WHERE from.id = $fromId
  MATCH (to) WHERE to.id = $toId
  MATCH path = shortestPath((from)-[*1..8]-(to))
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

/**
 * Lists everything reachable from a node within N hops, grouped by how far away
 * it is and what kind of thing it is. This backs the multi-hop explorer, where
 * the user picks a starting entity and widens the radius.
 */
export const MULTI_HOP_NEIGHBOURHOOD = cypher`
  MATCH (start) WHERE start.id = $startId
  MATCH path = (start)-[*1..4]-(reached)
  WHERE length(path) <= $maxDepth
    AND reached.id <> start.id
    AND ($labels IS NULL OR head(labels(reached)) IN $labels)
  WITH reached, min(length(path)) AS distance
  ORDER BY distance ASC, coalesce(reached.citationCount, reached.paperCount, 0) DESC
  LIMIT $limit
  RETURN {
    id: reached.id,
    label: head(labels(reached)),
    name: coalesce(reached.name, reached.title, reached.term, reached.id),
    distance: distance,
    metric: coalesce(reached.citationCount, reached.paperCount, reached.researcherCount, 0)
  } AS neighbour
`;
