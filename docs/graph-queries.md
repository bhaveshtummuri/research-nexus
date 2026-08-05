# Graph Query Explanations

Each of the ten required capabilities, with the Cypher that implements it, why
the traversal is written the way it is, and what the relational equivalent costs.

All statements live in [`server/src/cypher/`](../server/src/cypher/) and every one
of them is fully parameterised. The `cypher` tagged template refuses
interpolation at both compile time and runtime, so the query text in this
document is exactly the query text that reaches the database.

---

## 1. Researchers connected within multiple collaboration hops

**File:** `collaboration.cypher.ts` → `FIND_COLLABORATORS_WITHIN_HOPS`

```cypher
MATCH (start:Author { id: $authorId })
MATCH path = (start)-[:COLLABORATED_WITH*1..4]-(peer:Author)
WHERE peer.id <> start.id
  AND length(path) <= $maxDepth
WITH start, peer, min(length(path)) AS distance
ORDER BY distance ASC, peer.hIndex DESC, peer.citationCount DESC
SKIP $offset LIMIT $limit

// Enrichment runs on the selected page only - see "Paginate before enriching".
OPTIONAL MATCH (start)-[:AUTHORED]->(joint:Paper)<-[:AUTHORED]-(peer)
OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
               <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(peer)
OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_KEYWORD]->(keyword:Keyword)
               <-[:HAS_KEYWORD]-(:Paper)<-[:AUTHORED]-(peer)
OPTIONAL MATCH (start)-[:COLLABORATED_WITH]-(mutual:Author)-[:COLLABORATED_WITH]-(peer)
```

**How it works.** `*1..4` is a variable-length pattern: the engine expands
outward from one index-seeded node, following `COLLABORATED_WITH` in either
direction. `min(length(path))` collapses the many routes to a given person down
to their true distance, so someone reachable in two hops is reported as two hops
even if a five-hop route also exists.

**Why the traversal is not literally Author→Paper→Author.** The domain describes
collaboration as co-authorship, but expressed that way four collaboration hops
become eight pattern hops. The materialised `COLLABORATED_WITH` edge halves the
depth, which is the difference between a responsive UI and a timeout. The paper
path is still used — for the shared-work enrichment, where it is cheap because it
runs over a single page.

**What comes back.** Degree of separation, the papers the two co-authored, shared
topics, shared keywords, mutual collaborators, and a weighted score with a
`reasons` array showing each signal's contribution. Ordering is `distance ASC,
score DESC`: distance leads so the page order matches the pagination key, and
score ranks within a distance band where hop count alone cannot separate peers.

**Why the bound is a literal.** Cypher cannot parameterise the bound of a
variable-length pattern, so the structural maximum is fixed at four and the
caller's `$maxDepth` narrows it in the `WHERE` clause. The statement stays
constant — one cached plan — while remaining fully parameterised.

**Relational cost.** A recursive CTE that unions a self-join per level, with a
cycle guard, then a `GROUP BY` to recover the minimum depth. Roughly 20 lines,
and the planner has no way to stop early.

---

## 2. Hidden collaborators through shared publications and topics

**File:** `collaboration.cypher.ts` → `FIND_HIDDEN_COLLABORATORS`

```cypher
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

WITH candidate, bridges, bridgeCount, sharedTopics,
     toFloat(bridgeCount) * $bridgeWeight +
     toFloat(size(sharedTopics)) * $topicWeight AS score
WHERE size(sharedTopics) >= $minSharedTopics
ORDER BY score DESC, candidate.hIndex DESC
```

**How it works.** Three things happen in one pass: the first-degree set is
collected, the second-degree closure is walked, and a six-hop pattern counts
topic overlap between the two people. The `NOT ... IN directIds` filter is what
makes the result *hidden* collaborators — people you should know but do not.

**Why it is the flagship query.** This is the question that motivates the entire
project. It needs the second-degree co-authorship closure, an anti-join against
the first degree, and an aggregate over a six-hop path — simultaneously. In SQL
that is a recursive CTE, a `NOT EXISTS` subquery, and a separate aggregation over
a four-way join, materialised and then joined together.

**Scoring.** The weights are driver parameters, not literals, so tuning them
neither edits a query nor invalidates its cached plan. The individual signal
contributions are returned alongside the score, which is what lets the UI explain
each recommendation rather than assert it.

---

## 3. Shortest collaboration path between two researchers

**File:** `collaboration.cypher.ts` → `SHORTEST_COLLABORATION_PATH`

```cypher
MATCH (from:Author { id: $fromId })
MATCH (to:Author { id: $toId })
MATCH path = shortestPath((from)-[:COLLABORATED_WITH*1..10]-(to))
WITH path
WHERE length(path) <= $maxDepth
RETURN {
  length: length(path),
  nodes: [node IN nodes(path) | {
    elementId: elementId(node), id: node.id,
    label: head(labels(node)),
    name: coalesce(node.name, node.title, node.term, node.id)
  }],
  edges: [rel IN relationships(path) | {
    elementId: elementId(rel), type: type(rel),
    startElementId: elementId(startNode(rel)),
    endElementId: elementId(endNode(rel)),
    properties: properties(rel)
  }]
} AS path
```

**How it works.** `shortestPath` performs a bidirectional breadth-first search,
expanding from both endpoints and stopping the moment the frontiers meet. It is a
first-class graph primitive, not something assembled from joins.

**Two more variants exist.** `ALL_SHORTEST_COLLABORATION_PATHS` returns every
equally short route, which matters for introductions — knowing there are three
different two-hop routes tells you which mutual contact to approach.
`SHORTEST_ANY_PATH` drops the relationship-type constraint, so two researchers
who have never co-authored can still be connected through a shared institution,
dataset or funding programme.

**Why two statements instead of one.** Cypher cannot parameterise a relationship
type inside a pattern. The service selects between prepared statements; it never
builds one.

**Relational cost.** Unbounded shortest path is genuinely hard in SQL. The
practical approach is a recursive CTE that materialises every partial path up to
some depth and prunes afterwards, which explores vastly more of the search space
than a bidirectional BFS and gets rapidly worse as the graph grows.

---

## 4. Recommend papers by shared keywords, citations and topics

**File:** `recommendations.cypher.ts` → `RECOMMEND_SIMILAR_PAPERS`

Four independent similarity signals, each aggregated per candidate, then unioned
and summed:

```cypher
MATCH (source:Paper { id: $paperId })

OPTIONAL MATCH (source)-[:HAS_TOPIC]->(topic:ResearchTopic)<-[:HAS_TOPIC]-(byTopic:Paper)
WHERE byTopic.id <> source.id
WITH source, byTopic, count(DISTINCT topic) AS topicOverlap
WITH source, [entry IN collect(...) WHERE entry IS NOT NULL] AS topicRows

/* … keyword overlap, co-citation and bibliographic coupling collected the same way … */

UNWIND (topicRows + keywordRows + coCitationRows + couplingRows) AS row
WITH row.id AS candidateId,
     sum(row.topics) AS sharedTopics,
     sum(row.keywords) AS sharedKeywords,
     sum(row.coCited) AS coCitations,
     sum(row.sharedRefs) AS sharedReferences
WITH candidateId, sharedTopics, sharedKeywords, coCitations, sharedReferences,
     toFloat(sharedTopics) * $topicWeight +
     toFloat(sharedKeywords) * $keywordWeight +
     toFloat(coCitations) * $coCitationWeight +
     toFloat(sharedReferences) * $couplingWeight AS score
WHERE score > 0
ORDER BY score DESC
LIMIT $limit
```

The four signals:

| Signal                     | Pattern                                             | Meaning                                      |
| -------------------------- | --------------------------------------------------- | -------------------------------------------- |
| Shared topics              | `(source)-[:HAS_TOPIC]->()<-[:HAS_TOPIC]-(candidate)` | Same subject area                            |
| Shared keywords            | `(source)-[:HAS_KEYWORD]->()<-[:HAS_KEYWORD]-(candidate)` | Same specific problem                  |
| Co-citation                | `(source)<-[:CITES]-()-[:CITES]->(candidate)`       | The community already treats them as related |
| Bibliographic coupling     | `(source)-[:CITES]->()<-[:CITES]-(candidate)`       | They build on the same prior work            |

**Why aggregate before merging.** Collecting `{candidate, signal, count}` rows
per signal and summing at the end keeps each contribution visible, which is
exactly what lets the API return a human-readable reason next to every
recommendation instead of an opaque number.

**Co-citation and coupling deserve emphasis.** Both are two-hop patterns through
the citation graph, written as a single line each. They are the classic
bibliometric similarity measures, and they are the ones that would each require
their own self-join of the citations table in SQL.

---

## 5. Identify experts in a research field

**File:** `topics.cypher.ts` → `FIND_EXPERTS_FOR_TOPIC`

```cypher
MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(paper:Paper)<-[:AUTHORED]-(author:Author)
WITH author,
     count(DISTINCT paper) AS topicPaperCount,
     sum(coalesce(paper.citationCount, 0)) AS topicCitationCount
WHERE topicPaperCount >= $minPapers

WITH author, topicPaperCount, topicCitationCount,
     CASE WHEN coalesce(author.paperCount, 0) = 0 THEN 0.0
          ELSE toFloat(topicPaperCount) / toFloat(author.paperCount) END AS focusRatio

WITH author, topicPaperCount, topicCitationCount, focusRatio,
     toFloat(topicPaperCount) * $paperWeight +
     log(toFloat(topicCitationCount) + 1) * $citationWeight +
     focusRatio * $focusWeight +
     toFloat(coalesce(author.hIndex, 0)) * $hIndexWeight AS expertiseScore
ORDER BY expertiseScore DESC
```

**The interesting term is `focusRatio`.** Volume and citations alone would rank a
prolific generalist above a genuine specialist. Dividing topic output by total
output measures *devotion* to the subject — four papers out of five is a much
stronger expertise signal than six out of two hundred. Both numbers come from
traversals off the same author node in one query.

**Citations are logged before weighting** so that a single famous paper cannot
dominate the ranking.

---

## 6. Explore citation chains across multiple publications

**File:** `citations.cypher.ts` → `CITATION_CHAINS_FORWARD` / `CITATION_CHAINS_BACKWARD`

```cypher
MATCH (start:Paper { id: $paperId })
MATCH path = (start)-[:CITES*1..5]->(cited:Paper)
WHERE length(path) <= $maxDepth
WITH path, nodes(path) AS chain
WITH path, chain,
     reduce(total = 0, paper IN chain | total + coalesce(paper.citationCount, 0)) AS impact
ORDER BY length(path) DESC, impact DESC
LIMIT $limit
```

**Direction is the whole point.** Following `CITES` outward (`->`) traces a
paper's intellectual ancestry; following it inward (`<-`) traces its downstream
influence. Fixing the direction is what guarantees every returned chain is a
genuine lineage rather than a mix of citing and cited work — which is exactly the
mistake an undirected traversal would make.

Two statements exist because the arrow, like a relationship type, cannot be
parameterised. `reduce` accumulates total impact along each chain in the same
pass that finds it.

---

## 7. Discover related topics through indirect relationships

**File:** `topics.cypher.ts` → `FIND_RELATED_TOPICS`

```cypher
MATCH (topic:ResearchTopic { id: $topicId })

OPTIONAL MATCH (topic)-[link:RELATED_TO]-(direct:ResearchTopic)
WITH topic, [ /* … direct links, connectionKind: 'direct' … */ ] AS directLinks

OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(paper:Paper)-[:HAS_TOPIC]->(inferred:ResearchTopic)
WHERE inferred.id <> topic.id
WITH topic, directLinks, inferred, count(DISTINCT paper) AS coOccurrence
WITH topic, directLinks, [ /* … inferred links, connectionKind: 'inferred' … */ ] AS inferredLinks

UNWIND (directLinks + inferredLinks) AS link
WITH link.id AS topicId, link.name AS name, link.field AS field,
     max(link.strength) AS strength,
     CASE WHEN 'direct' IN collect(link.connectionKind) THEN 'direct' ELSE 'inferred' END AS connectionKind
ORDER BY connectionKind ASC, strength DESC
```

**Two kinds of relatedness, clearly distinguished.** Direct links are curated
`RELATED_TO` edges — someone asserted the connection. Inferred links come from
topic co-occurrence on the same papers — nobody recorded them, and the traversal
found them anyway. The result labels which is which, so a reader can tell
editorial knowledge from discovered knowledge.

The inferred half is the genuinely valuable one: it surfaces connections that
exist in the literature but not in anyone's taxonomy.

---

## 8. Find universities working on similar research areas

**File:** `universities.cypher.ts` → `FIND_SIMILAR_UNIVERSITIES`

```cypher
MATCH (source:University { id: $universityId })<-[:AFFILIATED_WITH]-(:Author)
      -[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
WITH source, collect(DISTINCT topic) AS sourceTopics
WITH source, sourceTopics, size(sourceTopics) AS sourceSize
WHERE sourceSize > 0

UNWIND sourceTopics AS sharedTopic
MATCH (sharedTopic)<-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(:Author)
      -[:AFFILIATED_WITH]->(other:University)
WHERE other.id <> source.id
WITH source, sourceSize, other,
     collect(DISTINCT { id: sharedTopic.id, name: sharedTopic.name, field: sharedTopic.field }) AS sharedTopics
WITH source, sourceSize, other, sharedTopics, size(sharedTopics) AS sharedCount

MATCH (other)<-[:AFFILIATED_WITH]-(:Author)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(otherTopic:ResearchTopic)
WITH source, sourceSize, other, sharedTopics, sharedCount, count(DISTINCT otherTopic) AS otherSize
WITH other, sharedTopics, sharedCount,
     toFloat(sharedCount) / toFloat(sourceSize + otherSize - sharedCount) AS similarity
WHERE sharedCount >= $minSharedTopics
ORDER BY similarity DESC
```

**The metric is Jaccard similarity** over each institution's topic profile:
`|A ∩ B| / |A ∪ B|`, with the union expanded to `|A| + |B| - |A ∩ B|`.

**Note there is no institution-to-institution edge involved.** The similarity is
computed purely from four-hop traversals — university → researchers → papers →
topics, and back down again. Getting this from a relational schema means
materialising a university × topic matrix first, which is a batch job.

`FIND_SIMILAR_FUNDING_AGENCIES` applies the identical shape to
`FundingAgency → ResearchProject → ResearchTopic`, and additionally sums the
combined award value along the way.

---

## 9. Discover funding agencies supporting similar research

**File:** `funding.cypher.ts` → `FIND_SIMILAR_FUNDING_AGENCIES`

Same Jaccard construction as above, over the funding side of the graph. The
traversal path is `FundingAgency ← FUNDED_BY ← ResearchProject → HAS_TOPIC →
ResearchTopic`, and the query also accumulates `combinedAwardUsd` from the
`amountUsd` property on the `FUNDED_BY` relationships it crosses.

This is a good illustration of relationship properties earning their place: the
award amount belongs to the *grant*, not to the agency and not to the project, so
it lives on the edge and is available to any traversal that crosses it.

---

## 10. Identify cross-domain collaborations

**File:** `collaboration.cypher.ts` → `FIND_CROSS_DOMAIN_COLLABORATIONS`

```cypher
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
```

**`topicA.field < topicB.field` does two jobs at once.** It requires the fields to
be different — that is what makes the collaboration cross-domain — and it fixes a
canonical ordering so the pair (AI, Robotics) is not also reported as
(Robotics, AI).

**The deeper point:** "cross-domain" is not a column anyone could filter on. It
is a property of a paper's *position in the graph* — having topic edges that
reach into two different fields. The traversal is what makes the concept
expressible at all.

---

## 11. Topic similarity through the shared keyword vocabulary

**File:** `topics.cypher.ts` → `FIND_SIMILAR_TOPICS_BY_KEYWORD`

```cypher
MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(keyword:Keyword)
WITH topic, collect(DISTINCT keyword.id) AS sourceKeywordIds

MATCH (candidate:ResearchTopic)<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(shared:Keyword)
WHERE candidate.id <> topic.id AND shared.id IN sourceKeywordIds
WITH topic, sourceKeywordIds, candidate,
     collect(DISTINCT { id: shared.id, term: shared.term }) AS sharedKeywords
```

**What it finds that §7 cannot.** `FIND_RELATED_TOPICS` requires two topics to
appear on the *same* paper. This query connects topics that share no publication
at all but draw on the same vocabulary — two communities working one problem
without citing each other. That is a five-hop path
(`Topic→Paper→Keyword→Paper→Topic`) and it is the query that most clearly has no
practical relational form.

**Why Jaccard and not a count.** Raw overlap rewards breadth: a sprawling topic
shares keywords with everything. Dividing by the union
(`shared / (source + candidate - shared)`) makes a narrow topic that overlaps
almost perfectly outrank a broad one that overlaps incidentally.

**Returns.** Similarity, shared keywords, papers carrying both topics, and the
researchers most active in the candidate topic.

---

## 12. Citation tree

**File:** `citations.cypher.ts` → `BUILD_CITATION_TREE_FORWARD` / `_BACKWARD`

```cypher
MATCH (root:Paper { id: $paperId })
MATCH path = (root)-[:CITES*1..4]->(cited:Paper)
WHERE length(path) <= $maxDepth
WITH cited, path, length(path) AS hops
ORDER BY hops ASC
WITH cited, min(hops) AS depth, head(collect(path)) AS shortest
ORDER BY depth ASC, cited.citationCount DESC
LIMIT $limit
RETURN { …, depth: depth, parentId: nodes(shortest)[depth - 1].id } AS node
```

**Why it returns a flat list.** Cypher cannot return a nested structure of
arbitrary depth. Each row instead carries its `depth` and the `parentId` it hangs
from, which the client rebuilds into a tree in one pass — and which is already
the shape a graph renderer wants.

**How it stays a tree.** The citation graph is a DAG: a paper is often reachable
by several routes. `ORDER BY hops ASC` before `collect` makes
`head(collect(path))` the *shortest* route, so each paper is attached exactly
once, at its shallowest point. Without that ordering the result would be a
duplicate-laden DAG dump rather than a tree.

**Direction.** Cypher cannot parameterise an arrow, so forward (what this cites)
and backward (what cites this) are two prepared statements the service selects
between — it never builds one.

---

## 13. Influential citation path

**File:** `citations.cypher.ts` → `FIND_INFLUENTIAL_CITATION_PATH`

```cypher
MATCH path = (start)-[:CITES*1..5]->(target:Paper)
WHERE length(path) <= $maxDepth
WITH path,
     reduce(total = 0, paper IN nodes(path) | total + coalesce(paper.citationCount, 0)) AS influence
ORDER BY influence DESC, length(path) ASC
LIMIT $limit
```

**A different question from `shortestPath`.** Shortest asks "how is this
connected"; this asks "which line of descent mattered most". `reduce` accumulates
citations along each route, so a four-hop chain through seminal work outranks a
two-hop chain through obscure work. Returned in the standard path shape, so the
existing path renderer draws it with no new client code.

---

## 14. Analytics: rankings that only a graph can compute

**File:** `analytics.cypher.ts`

| Statement | Ranks by | Why it is graph-native |
| --------- | -------- | ---------------------- |
| `MOST_CITED_PAPERS` | Incoming `CITES` edges | Counts edges rather than reading the stored `citationCount`. Both are returned, so a drifting counter becomes visible instead of silently authoritative. |
| `MOST_CONNECTED_KEYWORDS` | Co-occurrence degree | How many *other* keywords a term appears alongside. A term on a thousand papers in one niche is less connective than one spanning many vocabularies — invisible to a `COUNT(*)`. |
| `MOST_FUNDED_RESEARCH_AREAS` | Grant money reaching a field | The money sits three hops from the field: `Agency-[:FUNDS]->Project-[:HAS_TOPIC]->Topic`. No column holds "funding per field"; it exists only as a traversal. |
| `MOST_COLLABORATIVE_INSTITUTIONS` | Distinct partner institutions | Counts peer institutions reached through co-authorship, not papers published — openness rather than size. |

---

## Query optimization

Ten decisions, each visible in the statements above.

### 1. Every query starts at an index

Every traversal is seeded by an indexed lookup — `{ id: $x }` against a uniqueness
constraint, or `searchText` against a range index — never by a label scan. The
engine anchors on one node and expands outward, so cost tracks neighbourhood
size rather than table size.

### 2. Paginate before enriching

The expensive pattern is enriching every candidate and then discarding all but a
page. `FIND_COLLABORATORS_WITHIN_HOPS` and `FIND_EXPERTS_FOR_TOPIC` both place
`SKIP`/`LIMIT` *before* their `OPTIONAL MATCH` enrichment, so the four overlap
expansions run over ten rows rather than ten thousand. This ties cost to page
size instead of network size.

The trade-off is deliberate and worth naming: a signal computed after pagination
cannot influence which rows are selected. Where a signal must drive selection —
the keyword overlap in `FIND_HIDDEN_COLLABORATORS`, which is the whole point of
that query — it is computed before `SKIP`/`LIMIT` and the cost is accepted.

### 3. Every traversal is bounded by a literal

No variable-length pattern is unbounded. Each declares a structural maximum
(`*1..4`), the caller's `$maxDepth` narrows it in a `WHERE`, and `$limit` caps
the result. A hub node can never return a subgraph large enough to stall the
client. A unit test enforces this across every statement.

### 4. Return properties, never nodes

Every statement returns an explicit projection map, never a bare node or path.
Only the fields the client renders cross the wire, and the response shape is
decoupled from the storage shape — a property added to the graph does not
silently widen an API payload.

### 5. Aggregate before expanding

Where a query fans out and then narrows, the aggregation comes first.
`FIND_TRENDING_TOPICS` reduces to one row per topic and applies `LIMIT` before
expanding to top authors, so the author expansion touches the surviving topics
only.

### 6. One prepared statement per direction

Cypher cannot parameterise a relationship type or an arrow. Rather than building
query text, direction variants are separate constants selected by lookup
(`PATH_STATEMENTS[mode]`, forward/backward citation trees). The statements stay
static, the plan cache stays warm, and no request value can reach the query text.

### 7. Optional filters stay in one plan

`($param IS NULL OR predicate)` means one statement serves every filter
combination. The alternative — assembling a `WHERE` clause — would multiply
cached plans and reintroduce string building.

### 8. Deduplicate at the source

`count(DISTINCT peer)` and `collect(DISTINCT …)` do the deduplication in the
engine. Since the fix to derive author→project membership through
`INCLUDES`, `DISTINCT` is what stops a project that includes three of an author's
papers from being listed three times.

### 9. Concurrency over sequencing

`getAnalyticsSummary` issues seven independent traversals with `Promise.all`, so
dashboard latency is bounded by the slowest query rather than their sum.

### 10. Profiling

Statements are constants, so any can be profiled directly:

```cypher
PROFILE
MATCH (start:Author { id: 'author-0042' })
MATCH path = (start)-[:COLLABORATED_WITH*1..4]-(peer:Author)
WHERE length(path) <= 3
RETURN count(peer);
```

Read the plan for `NodeIndexSeek` (not `NodeByLabelScan`) at the anchor, and
check that `db hits` scale with the neighbourhood rather than the node count. The
integration suite in
[`server/tests/integration/graph-queries.test.ts`](../server/tests/integration/graph-queries.test.ts)
runs every one of these against a seeded instance.

---

## Cross-cutting patterns

### Optional filters without dynamic SQL

Every list query expresses optional filters as `($param IS NULL OR predicate)`:

```cypher
MATCH (paper:Paper)
WHERE ($search IS NULL OR paper.searchText CONTAINS $search)
  AND ($fromYear IS NULL OR paper.year >= $fromYear)
  AND ($toYear IS NULL OR paper.year <= $toYear)
```

One prepared statement serves every combination of filters. The plan cache stays
small, and there is no code path anywhere that assembles a `WHERE` clause from
strings.

### Caller-chosen sort without an injectable identifier

Cypher cannot parameterise an identifier, so a sort column selected by the caller
is expressed as a `CASE` over a validated enum:

```cypher
ORDER BY
  CASE $sort WHEN 'citations' THEN author.citationCount
             WHEN 'papers' THEN author.paperCount
             ELSE author.hIndex END DESC,
  author.name ASC
```

The value of `$sort` is constrained by a Zod enum before it reaches the service,
so an unknown key is a 422 rather than an unexpected ordering.

### Every traversal is bounded

No variable-length pattern is unbounded. Each declares a literal structural
maximum, the caller's depth narrows it, and `$limit` caps the result set — so a
hub node like a prolific author or a popular topic can never return a subgraph
large enough to stall the client or the database. A unit test enforces this
across every statement in the codebase.

### Portability

The queries use OpenCypher constructs only: no APOC, no GDS, no `COUNT {}`
subqueries, no native full-text calls. Counting is done with `OPTIONAL MATCH` plus
`count()`, which is valid on any engine implementing the standard. That is what
lets the same statements run against CognoDB and Neo4j unchanged.
