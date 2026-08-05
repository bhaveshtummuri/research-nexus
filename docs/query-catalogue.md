# Research Nexus — Graph Query Catalogue

Production-ready OpenCypher for CognoDB (Neo4j-compatible), covering the seven
core discovery queries and sixteen analytics queries.

Every statement is parameterised, bounded, and index-backed. Together they are
the argument for the graph model: each answers a question whose relational form
needs a recursive CTE, a self-join per hop, or a precomputed matrix.

---

## Contents

**Core queries**
1. [Multi-hop collaboration discovery](#query-1--multi-hop-collaboration-discovery)
2. [Citation path explorer](#query-2--citation-path-explorer)
3. [Expert discovery](#query-3--expert-discovery)
4. [Similar university discovery](#query-4--similar-university-discovery)
5. [Hidden collaboration detection](#query-5--hidden-collaboration-detection)
6. [Paper recommendation engine](#query-6--paper-recommendation-engine)
7. [Funding opportunity discovery](#query-7--funding-opportunity-discovery)

**Analytics** — [16 queries](#additional-graph-analytics)

**Reference** — [Prerequisites](#index-and-constraint-prerequisites) ·
[Driver usage](#driver-usage) · [Complexity notation](#complexity-notation) ·
[Implementation notes](#implementation-notes)

---

## Conventions

**Parameterisation is absolute.** Every runtime value is a `$parameter`. No query
text is ever built by concatenation — in the implementation this is enforced by a
branded `CypherStatement` type that only a tagged template can produce, so a
plain string does not compile.

**Optional filters use `($param IS NULL OR predicate)`.** One prepared statement
serves every filter combination, keeping the plan cache small.

**Caller-chosen sorts use `CASE $sort WHEN …`.** Cypher cannot parameterise an
identifier; a validated enum plus a `CASE` is the safe equivalent.

**Every traversal is bounded.** Variable-length patterns declare a literal
maximum; `$maxDepth` narrows it; `$limit` caps the result. A hub node can never
return a subgraph large enough to stall a client.

**Portable OpenCypher only.** No APOC, no GDS, no vendor full-text. Counting uses
`OPTIONAL MATCH` + `count()`.

### Complexity notation

| Symbol | Meaning |
|---|---|
| `d` | Average degree (relationships per node) |
| `k` | Result set size after `LIMIT` |
| `h` | Traversal depth |
| `n` | Total nodes — appears only where a scan is unavoidable |

The headline property: traversal cost is `O(d^h)`, bounded by the *visited
neighbourhood*, and **independent of `n`**. That is index-free adjacency, and it
is why these queries scale.

---

## Query 1 — Multi-Hop Collaboration Discovery

### Objective

Find every researcher reachable within three collaboration hops, with their true
distance, shared work, shared interests, and the path connecting them.

### Real-world use case

A researcher joining a new institution wants to map their extended academic
network — not just direct co-authors, but the "friend of a friend" layer where
warm introductions actually live. A conference organiser uses the same query to
find speakers connected to a keynote without being their direct collaborators.

### Graph traversal path

```
Author ──AUTHORED──▶ Paper ◀──AUTHORED── Author ──AUTHORED──▶ Paper ◀──AUTHORED── Author
└──────────────── hop 1 ────────────────┘└──────────────── hop 2 ────────────────┘

Materialised as:  Author ──COLLABORATED_WITH*1..3── Author
```

### OpenCypher

```cypher
MATCH (start:Author { id: $authorId })

// Traverse the materialised collaboration network. Bounded at 3 hops
// structurally; $maxDepth narrows it further without changing the statement.
MATCH path = (start)-[:COLLABORATED_WITH*1..3]-(peer:Author)
WHERE peer.id <> start.id
  AND length(path) <= $maxDepth

// min() collapses the many routes to a person down to their true distance.
WITH start, peer, min(length(path)) AS distance, head(collect(path)) AS shortestRoute

// Shared publications — direct co-authorship only, so this is empty
// beyond distance 1 and that emptiness is itself informative.
OPTIONAL MATCH (start)-[:AUTHORED]->(shared:Paper)<-[:AUTHORED]-(peer)
WITH start, peer, distance, shortestRoute,
     collect(DISTINCT { id: shared.id, title: shared.title, year: shared.year }) AS sharedPapers

// Shared research interests — works at any distance, which is what makes
// a 3-hop peer worth surfacing at all.
OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
               <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(peer)
WITH peer, distance, shortestRoute, sharedPapers,
     collect(DISTINCT { id: topic.id, name: topic.name, field: topic.field }) AS sharedTopics

OPTIONAL MATCH (peer)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)

WITH peer, distance, shortestRoute, sharedPapers, sharedTopics,
     head(collect(university)) AS affiliation,
     // Closer is better; shared interests break ties.
     (1.0 / toFloat(distance)) * $distanceWeight +
     toFloat(size(sharedTopics)) * $topicWeight AS relevance
ORDER BY distance ASC, relevance DESC, peer.hIndex DESC
SKIP $offset LIMIT $limit

RETURN {
  author: {
    id: peer.id, name: peer.name, title: peer.title,
    hIndex: peer.hIndex, citationCount: peer.citationCount,
    affiliation: CASE WHEN affiliation IS NULL THEN NULL
                      ELSE { id: affiliation.id, name: affiliation.name,
                             country: affiliation.country } END
  },
  distance: distance,
  relevance: relevance,
  sharedPapers: sharedPapers,
  sharedTopics: sharedTopics,
  collaborationPath: [node IN nodes(shortestRoute) | { id: node.id, name: node.name }],
  pathStrength: [rel IN relationships(shortestRoute) | rel.paperCount]
} AS result
```

### Explanation

The query runs against `COLLABORATED_WITH`, a **derived edge** materialised from
`AUTHORED` at load time. That choice is load-bearing: expressed through papers,
a 3-hop collaboration query is *six* hops (`Author→Paper→Author→Paper→Author→
Paper→Author`). Materialising halves the depth and cuts the intermediate result
set by roughly an order of magnitude.

`min(length(path))` matters because a person reachable in 2 hops is often *also*
reachable in 3 — without the aggregation they would appear twice at the wrong
distance.

`pathStrength` exposes `paperCount` from each edge along the route, so the UI can
distinguish a chain of strong ties from a chain of one-off co-authorships.

### Expected output

```jsonc
{
  "author": {
    "id": "author-0087", "name": "Nadia Haddad", "title": "Associate Professor",
    "hIndex": 24, "citationCount": 3180,
    "affiliation": { "id": "university-0005", "name": "ETH Zurich", "country": "Switzerland" }
  },
  "distance": 2,
  "relevance": 6.5,
  "sharedPapers": [],
  "sharedTopics": [
    { "id": "topic-0001", "name": "Graph Neural Networks", "field": "Artificial Intelligence" }
  ],
  "collaborationPath": [
    { "id": "author-0001", "name": "Ada Okafor" },
    { "id": "author-0042", "name": "Liang Chen" },
    { "id": "author-0087", "name": "Nadia Haddad" }
  ],
  "pathStrength": [4, 2]
}
```

### Time complexity

`O(d^h + k·t)` — `d^h` for the bounded expansion (h ≤ 3), plus `k·t` for the
topic-overlap enrichment per returned peer. **Independent of total graph size.**

### Why graph over SQL

SQL needs a recursive CTE with an explicit cycle guard:

```sql
WITH RECURSIVE collab AS (
  SELECT a2.author_id AS peer, 1 AS depth, ARRAY[a1.author_id] AS visited
  FROM paper_authors a1 JOIN paper_authors a2 USING (paper_id)
  WHERE a1.author_id = $1 AND a2.author_id <> $1
  UNION ALL
  SELECT a2.author_id, c.depth + 1, c.visited || c.peer
  FROM collab c
  JOIN paper_authors a1 ON a1.author_id = c.peer
  JOIN paper_authors a2 ON a2.paper_id = a1.paper_id
  WHERE c.depth < 3 AND NOT a2.author_id = ANY(c.visited)
)
SELECT peer, MIN(depth) FROM collab GROUP BY peer;
```

Each level re-scans `paper_authors`; intermediate rows multiply with depth; the
`visited` array must be carried and checked on every row. Then the topic overlap
is a *second* four-way join, materialised separately and joined back.

The graph engine walks pointers from one index-seeded node and never touches a
join table — because there is no join table. Extending to 4 hops is one character.

---

## Query 2 — Citation Path Explorer

### Objective

Trace the citation chain between two papers: the shortest route, all
intermediate work, and the depth of intellectual separation.

### Real-world use case

A reviewer asks how a new drug-discovery paper relates to the original
Transformer paper. The answer is a lineage — Transformer → BERT → Graph Attention
Networks → the paper in question — and that chain *is* the explanation.

### Graph traversal path

```
Paper ──CITES──▶ Paper ──CITES──▶ Paper ──CITES──▶ Paper
```

### OpenCypher

```cypher
// --- 2a. Shortest citation chain between two specific papers ---------------
MATCH (from:Paper { id: $fromPaperId })
MATCH (to:Paper   { id: $toPaperId })

// Directed: every hop follows CITES the same way, so the chain is a genuine
// lineage rather than a mix of citing and cited work.
MATCH path = shortestPath((from)-[:CITES*1..8]->(to))
WHERE length(path) <= $maxDepth

WITH path, nodes(path) AS chain, relationships(path) AS citations
RETURN {
  depth: length(path),
  chain: [paper IN chain | {
    id: paper.id, title: paper.title, year: paper.year,
    doi: paper.doi, citationCount: paper.citationCount
  }],
  intermediatePapers: [paper IN chain[1..-1] | { id: paper.id, title: paper.title }],
  citationYears: [rel IN citations | rel.year],
  // Total citation weight accumulated along the chain, for ranking alternatives.
  chainImpact: reduce(total = 0, paper IN chain | total + coalesce(paper.citationCount, 0))
} AS citationPath
```

```cypher
// --- 2b. All shortest chains, when several equally short routes exist ------
MATCH (from:Paper { id: $fromPaperId })
MATCH (to:Paper   { id: $toPaperId })
MATCH path = allShortestPaths((from)-[:CITES*1..6]->(to))
WHERE length(path) <= $maxDepth
WITH path, reduce(t = 0, p IN nodes(path) | t + coalesce(p.citationCount, 0)) AS impact
ORDER BY impact DESC
LIMIT $limit
RETURN {
  depth: length(path),
  impact: impact,
  chain: [paper IN nodes(path) | { id: paper.id, title: paper.title, year: paper.year }]
} AS route
```

```cypher
// --- 2c. Open-ended lineage from one paper (no target) ---------------------
MATCH (start:Paper { id: $paperId })
MATCH path = (start)-[:CITES*1..5]->(ancestor:Paper)   // ← reverse arrow for influence
WHERE length(path) <= $maxDepth
WITH path, nodes(path) AS chain,
     reduce(total = 0, p IN nodes(path) | total + coalesce(p.citationCount, 0)) AS impact
ORDER BY length(path) DESC, impact DESC
LIMIT $limit
RETURN {
  depth: length(path),
  impact: impact,
  papers: [p IN chain | { id: p.id, title: p.title, year: p.year,
                          citationCount: p.citationCount }]
} AS chain
```

### Explanation

`shortestPath` runs a **bidirectional breadth-first search**: it expands from
both endpoints simultaneously and stops the instant the frontiers meet. On a
citation graph where the average paper cites ~6 others, finding a depth-6
connection explores roughly `2·6³` nodes instead of `6⁶` — two orders of
magnitude less work.

Direction is semantic, and reversing the arrow changes the question:

| Pattern | Meaning |
|---|---|
| `(p)-[:CITES]->()` | What it builds on — **ancestry** |
| `(p)<-[:CITES]-()` | What builds on it — **influence** |

Two prepared statements exist for this reason; Cypher cannot parameterise an
arrow, so the service selects a statement, it never assembles one.

### Expected output

```jsonc
{
  "depth": 3,
  "chain": [
    { "id": "paper-0001", "title": "Attention Is All You Need", "year": 2017, "citationCount": 215 },
    { "id": "paper-0044", "title": "BERT: Pre-training of Deep Bidirectional Transformers", "year": 2019, "citationCount": 141 },
    { "id": "paper-0120", "title": "Graph Attention Networks at Scale", "year": 2021, "citationCount": 63 },
    { "id": "paper-0311", "title": "Heterogeneous GNNs for Drug Discovery", "year": 2023, "citationCount": 12 }
  ],
  "intermediatePapers": [
    { "id": "paper-0044", "title": "BERT: Pre-training of Deep Bidirectional Transformers" },
    { "id": "paper-0120", "title": "Graph Attention Networks at Scale" }
  ],
  "citationYears": [2019, 2021, 2023],
  "chainImpact": 431
}
```

### Time complexity

`O(d^(h/2))` for `shortestPath` thanks to the bidirectional search — versus
`O(d^h)` for the naive unidirectional walk in 2c.

### Why graph over SQL

Shortest path is the single clearest case. SQL has no bidirectional search
primitive; the practical approach materialises every partial path up to the depth
limit and prunes afterwards:

```sql
WITH RECURSIVE chain AS (
  SELECT citing_id, cited_id, 1 AS depth, ARRAY[citing_id, cited_id] AS path
  FROM citations WHERE citing_id = $1
  UNION ALL
  SELECT c.citing_id, ci.cited_id, c.depth + 1, c.path || ci.cited_id
  FROM chain c JOIN citations ci ON ci.citing_id = c.cited_id
  WHERE c.depth < 6 AND NOT ci.cited_id = ANY(c.path)
)
SELECT * FROM chain WHERE cited_id = $2 ORDER BY depth LIMIT 1;
```

This explores the **entire** 6-hop frontier before discarding almost all of it.
The graph engine explores a fraction and stops early.

---

## Query 3 — Expert Discovery

### Objective

Rank the genuine experts on a research topic — weighting not just output and
impact, but *focus*.

### Real-world use case

A programme committee needs reviewers for a "Federated Learning" track. Someone
with 4 of their 5 papers on the topic is a better reviewer than someone with 6 of
their 200 — even though the second person has more papers on it. Focus is the
signal that separates a specialist from a prolific generalist.

### Graph traversal path

```
ResearchTopic ◀──HAS_TOPIC── Paper ◀──AUTHORED── Author ──AFFILIATED_WITH──▶ University
```

### OpenCypher

```cypher
MATCH (topic:ResearchTopic { id: $topicId })<-[ht:HAS_TOPIC]-(paper:Paper)<-[:AUTHORED]-(author:Author)
WHERE ($minRelevance IS NULL OR ht.relevance >= $minRelevance)
  AND ($fromYear IS NULL OR paper.year >= $fromYear)

WITH author,
     count(DISTINCT paper) AS topicPaperCount,
     sum(coalesce(paper.citationCount, 0)) AS topicCitationCount,
     collect(paper) AS topicPapers
WHERE topicPaperCount >= $minPapers

// Focus ratio: what share of this author's total output is on this topic.
// author.paperCount is a derived counter, so this needs no second traversal.
WITH author, topicPaperCount, topicCitationCount, topicPapers,
     CASE WHEN coalesce(author.paperCount, 0) = 0 THEN 0.0
          ELSE toFloat(topicPaperCount) / toFloat(author.paperCount) END AS focusRatio

// Citations are logged before weighting so one famous paper cannot dominate.
WITH author, topicPaperCount, topicCitationCount, topicPapers, focusRatio,
     toFloat(topicPaperCount)               * $paperWeight    +
     log(toFloat(topicCitationCount) + 1)   * $citationWeight +
     focusRatio                             * $focusWeight    +
     toFloat(coalesce(author.hIndex, 0))    * $hIndexWeight   AS expertiseScore
ORDER BY expertiseScore DESC
SKIP $offset LIMIT $limit

OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
WITH author, topicPaperCount, topicCitationCount, topicPapers, focusRatio, expertiseScore,
     head(collect(university)) AS affiliation

// Broader research interests, for context beyond the queried topic.
OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(interest:ResearchTopic)
WITH author, topicPaperCount, topicCitationCount, topicPapers, focusRatio,
     expertiseScore, affiliation,
     interest, count(*) AS interestStrength
ORDER BY expertiseScore DESC, interestStrength DESC
WITH author, topicPaperCount, topicCitationCount, topicPapers, focusRatio,
     expertiseScore, affiliation,
     collect(DISTINCT { id: interest.id, name: interest.name })[0..6] AS researchInterests

RETURN {
  author: {
    id: author.id, name: author.name, title: author.title, orcid: author.orcid,
    hIndex: author.hIndex, totalPapers: author.paperCount,
    totalCitations: author.citationCount
  },
  university: CASE WHEN affiliation IS NULL THEN NULL
                   ELSE { id: affiliation.id, name: affiliation.name,
                          country: affiliation.country } END,
  topicPaperCount: topicPaperCount,
  topicCitationCount: topicCitationCount,
  focusRatio: focusRatio,
  expertiseScore: expertiseScore,
  researchInterests: researchInterests,
  influentialPapers: [p IN topicPapers WHERE p.citationCount IS NOT NULL |
                      { id: p.id, title: p.title, year: p.year,
                        citationCount: p.citationCount }][0..5]
} AS expert
```

### Explanation

Four weighted signals, each a driver parameter so the ranking can be tuned
without touching the query or invalidating its cached plan:

| Signal | Rationale |
|---|---|
| `topicPaperCount` | Raw productivity on the subject |
| `log(topicCitations)` | Impact, dampened so one hit paper cannot dominate |
| `focusRatio` | **Devotion** — the differentiating signal |
| `hIndex` | Career-level standing as a tiebreak |

The `$minRelevance` filter uses the `relevance` property on `HAS_TOPIC`, so an
author tagged marginally to a topic does not count the same as one whose paper is
primarily about it. That nuance lives on the relationship because it belongs to
neither the paper nor the topic alone.

### Expected output

```jsonc
{
  "author": { "id": "author-0012", "name": "Priya Iyer", "title": "Professor",
              "orcid": "0000-4471-2210-9983", "hIndex": 41,
              "totalPapers": 96, "totalCitations": 8420 },
  "university": { "id": "university-0001", "name": "Massachusetts Institute of Technology",
                  "country": "United States" },
  "topicPaperCount": 14,
  "topicCitationCount": 1830,
  "focusRatio": 0.146,
  "expertiseScore": 46.2,
  "researchInterests": [
    { "id": "topic-0003", "name": "Federated Learning" },
    { "id": "topic-0007", "name": "Algorithmic Fairness" }
  ],
  "influentialPapers": [
    { "id": "paper-0055", "title": "Secure Aggregation at Scale", "year": 2022, "citationCount": 412 }
  ]
}
```

### Time complexity

`O(p·a)` where `p` is papers on the topic and `a` is average authors per paper —
bounded by the topic's neighbourhood, not the graph.

### Why graph over SQL

The focus ratio is the interesting part. In SQL it needs the author's topic count
*and* their global count, which is either a correlated subquery per author or a
separate aggregate CTE joined back:

```sql
SELECT a.id, COUNT(DISTINCT tp.paper_id) AS topic_papers,
       COUNT(DISTINCT tp.paper_id)::float / NULLIF(total.cnt, 0) AS focus_ratio
FROM authors a
JOIN paper_authors pa ON pa.author_id = a.id
JOIN paper_topics tp  ON tp.paper_id = pa.paper_id
JOIN LATERAL (SELECT COUNT(*) cnt FROM paper_authors WHERE author_id = a.id) total ON TRUE
WHERE tp.topic_id = $1
GROUP BY a.id, total.cnt;
```

A `LATERAL` per author row. In the graph both numbers come from the same node —
one from the traversal, one from a derived counter property.

---

## Query 4 — Similar University Discovery

### Objective

Find institutions researching similar domains, scored by topic-profile overlap,
with the shared topics, shared publication count, and collaboration strength.

### Real-world use case

A university planning an international partnership needs peer institutions with
genuinely overlapping research portfolios — and wants to know whether joint work
already exists, which turns a cold introduction into a warm one.

### Graph traversal path

```
University ◀─AFFILIATED_WITH─ Author ─AUTHORED─▶ Paper ─HAS_TOPIC─▶ ResearchTopic
                                                                          │
University ◀─AFFILIATED_WITH─ Author ◀─AUTHORED─ Paper ◀─HAS_TOPIC───────┘

Six hops, symmetric around the shared topic.
```

### OpenCypher

```cypher
// Build the source institution's topic profile.
MATCH (source:University { id: $universityId })<-[:AFFILIATED_WITH]-(:Author)
      -[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
WITH source, collect(DISTINCT topic) AS sourceTopics
WITH source, sourceTopics, size(sourceTopics) AS sourceSize
WHERE sourceSize > 0

// Walk back down through each shared topic to reach peer institutions.
UNWIND sourceTopics AS sharedTopic
MATCH (sharedTopic)<-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(:Author)
      -[:AFFILIATED_WITH]->(other:University)
WHERE other.id <> source.id
WITH source, sourceSize, other,
     collect(DISTINCT { id: sharedTopic.id, name: sharedTopic.name,
                        field: sharedTopic.field }) AS sharedTopics
WITH source, sourceSize, other, sharedTopics, size(sharedTopics) AS sharedCount
WHERE sharedCount >= $minSharedTopics

// The peer's own profile size, needed for the Jaccard denominator.
MATCH (other)<-[:AFFILIATED_WITH]-(:Author)-[:AUTHORED]->(:Paper)
      -[:HAS_TOPIC]->(otherTopic:ResearchTopic)
WITH source, sourceSize, other, sharedTopics, sharedCount,
     count(DISTINCT otherTopic) AS otherSize

// Actual joint publications — papers co-authored across both institutions.
OPTIONAL MATCH (source)<-[:AFFILIATED_WITH]-(a1:Author)-[:AUTHORED]->(joint:Paper)
               <-[:AUTHORED]-(a2:Author)-[:AFFILIATED_WITH]->(other)
WITH source, other, sharedTopics, sharedCount, sourceSize, otherSize,
     count(DISTINCT joint) AS sharedPublications

// Existing co-authorship ties between the two faculties.
OPTIONAL MATCH (source)<-[:AFFILIATED_WITH]-(x:Author)-[collab:COLLABORATED_WITH]-(y:Author)
               -[:AFFILIATED_WITH]->(other)
WITH other, sharedTopics, sharedCount, sourceSize, otherSize, sharedPublications,
     count(DISTINCT collab) AS collaborationTies,
     sum(coalesce(collab.paperCount, 0)) AS collaborationStrength

// Is there a formal agreement already?
OPTIONAL MATCH (source2:University { id: $universityId })-[p:PARTNERS_WITH]-(other)

WITH other, sharedTopics, sharedCount, sharedPublications, collaborationTies,
     collaborationStrength, head(collect(p)) AS partnership,
     // Jaccard: |A ∩ B| / |A ∪ B|, union expanded to |A| + |B| - |A ∩ B|
     toFloat(sharedCount) / toFloat(sourceSize + otherSize - sharedCount) AS topicSimilarity
WITH other, sharedTopics, sharedCount, sharedPublications, collaborationTies,
     collaborationStrength, partnership, topicSimilarity,
     topicSimilarity * $similarityWeight +
     log(toFloat(sharedPublications) + 1) * $publicationWeight AS overallScore
ORDER BY overallScore DESC
LIMIT $limit

RETURN {
  university: {
    id: other.id, name: other.name, country: other.country, city: other.city,
    type: other.type, ranking: other.ranking, researcherCount: other.researcherCount
  },
  sharedTopics: sharedTopics[0..10],
  sharedTopicCount: sharedCount,
  sharedPublications: sharedPublications,
  collaborationTies: collaborationTies,
  collaborationStrength: collaborationStrength,
  topicSimilarity: topicSimilarity,
  overallScore: overallScore,
  hasFormalPartnership: partnership IS NOT NULL,
  partnershipSince: CASE WHEN partnership IS NULL THEN NULL ELSE partnership.since END
} AS similarUniversity
```

### Explanation

Similarity is the **Jaccard index** over topic profiles. Both profiles are built
by traversal — there is no institution-to-topic edge anywhere in the model.

The query separates three distinct notions that are easy to conflate:

| Measure | Meaning |
|---|---|
| `topicSimilarity` | Research *interests* overlap |
| `sharedPublications` | Joint work already exists |
| `hasFormalPartnership` | An agreement is on paper |

Comparing them answers a genuinely useful question: which formal partnerships
produce no joint work, and which thriving collaborations have no agreement behind
them.

### Expected output

```jsonc
{
  "university": { "id": "university-0014", "name": "EPFL", "country": "Switzerland",
                  "city": "Lausanne", "type": "Technical Institute",
                  "ranking": 14, "researcherCount": 9 },
  "sharedTopics": [
    { "id": "topic-0001", "name": "Graph Neural Networks", "field": "Artificial Intelligence" },
    { "id": "topic-0021", "name": "Quantum Error Correction", "field": "Quantum Information" }
  ],
  "sharedTopicCount": 12,
  "sharedPublications": 7,
  "collaborationTies": 4,
  "collaborationStrength": 11,
  "topicSimilarity": 0.324,
  "overallScore": 6.72,
  "hasFormalPartnership": true,
  "partnershipSince": 2016
}
```

### Time complexity

`O(t·p·a)` — topics in the source profile × papers per topic × authors per paper.
Bounded by the institution's research footprint.

### Why graph over SQL

This is a **six-hop symmetric traversal**. Relationally it means materialising a
university × topic matrix first:

```sql
CREATE MATERIALIZED VIEW university_topics AS
SELECT DISTINCT aff.university_id, pt.topic_id
FROM affiliations aff
JOIN paper_authors pa ON pa.author_id = aff.author_id
JOIN paper_topics pt  ON pt.paper_id = pa.paper_id;
```

Then a self-join of that view, plus a separate joint-publication query, plus a
separate collaboration query. Three passes and a batch-refreshed view that is
stale the moment a paper is added.

The graph computes all three at query time from live data, in one statement.

---

## Query 5 — Hidden Collaboration Detection

### Objective

Find researchers who have **never** collaborated directly but are tightly
connected through shared keywords and publication patterns — the introductions
most worth making.

### Real-world use case

A research office wants to seed new internal collaborations. The valuable pairs
are not existing co-authors (already connected) or unrelated researchers (no
basis) — they are people working the same problems who have not yet met.

### Graph traversal path

```
Author ─AUTHORED─▶ Paper ─HAS_KEYWORD─▶ Keyword ◀─HAS_KEYWORD─ Paper ◀─AUTHORED─ Author
                                          │
                                    RELATED_TO (query expansion)

Exclusion:  NOT (author)-[:COLLABORATED_WITH]-(candidate)
```

### OpenCypher

```cypher
MATCH (start:Author { id: $authorId })

// Everyone already collaborated with — the set we must exclude.
OPTIONAL MATCH (start)-[:COLLABORATED_WITH]-(direct:Author)
WITH start, collect(DISTINCT direct.id) AS directIds

// Keyword-mediated connection. Direct keyword match plus one RELATED_TO hop,
// so "GNN" reaches papers tagged "message passing".
MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_KEYWORD]->(k1:Keyword)
OPTIONAL MATCH (k1)-[rel:RELATED_TO]-(k2:Keyword)
WHERE rel.strength >= $minKeywordStrength
WITH start, directIds, collect(DISTINCT k1) + collect(DISTINCT k2) AS keywordSet

UNWIND keywordSet AS keyword
MATCH (keyword)<-[:HAS_KEYWORD]-(:Paper)<-[:AUTHORED]-(candidate:Author)
WHERE candidate.id <> start.id
  AND NOT candidate.id IN directIds          // ← the "hidden" condition

WITH start, candidate,
     collect(DISTINCT { id: keyword.id, term: keyword.term }) AS sharedKeywords,
     count(DISTINCT keyword) AS keywordOverlap
WHERE keywordOverlap >= $minSharedKeywords

// Shared research domains, a coarser corroborating signal.
OPTIONAL MATCH (start)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
               <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(candidate)
WITH start, candidate, sharedKeywords, keywordOverlap,
     collect(DISTINCT { id: topic.id, name: topic.name, field: topic.field }) AS sharedDomains

// Mutual collaborators — how socially close they already are.
OPTIONAL MATCH (start)-[:COLLABORATED_WITH]-(bridge:Author)-[:COLLABORATED_WITH]-(candidate)
WITH candidate, sharedKeywords, keywordOverlap, sharedDomains,
     collect(DISTINCT { id: bridge.id, name: bridge.name }) AS mutualCollaborators,
     count(DISTINCT bridge) AS mutualCount

OPTIONAL MATCH (candidate)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)

WITH candidate, sharedKeywords, keywordOverlap, sharedDomains,
     mutualCollaborators, mutualCount, head(collect(university)) AS affiliation,
     toFloat(keywordOverlap)         * $keywordWeight +
     toFloat(size(sharedDomains))    * $domainWeight  +
     toFloat(mutualCount)            * $mutualWeight  AS recommendationScore
ORDER BY recommendationScore DESC, candidate.hIndex DESC
SKIP $offset LIMIT $limit

RETURN {
  author: {
    id: candidate.id, name: candidate.name, title: candidate.title,
    hIndex: candidate.hIndex, citationCount: candidate.citationCount,
    affiliation: CASE WHEN affiliation IS NULL THEN NULL
                      ELSE { id: affiliation.id, name: affiliation.name,
                             country: affiliation.country } END
  },
  sharedKeywords: sharedKeywords[0..10],
  sharedKeywordCount: keywordOverlap,
  commonResearchDomains: sharedDomains,
  mutualCollaborators: mutualCollaborators[0..5],
  mutualCollaboratorCount: mutualCount,
  recommendationScore: recommendationScore,
  reasons: [reason IN [
    { kind: 'shared-keyword',
      label: toString(keywordOverlap) + ' shared keyword(s)',
      weight: toFloat(keywordOverlap) * $keywordWeight },
    { kind: 'shared-topic',
      label: toString(size(sharedDomains)) + ' shared research domain(s)',
      weight: toFloat(size(sharedDomains)) * $domainWeight },
    { kind: 'shared-collaborator',
      label: toString(mutualCount) + ' mutual collaborator(s)',
      weight: toFloat(mutualCount) * $mutualWeight }
  ] WHERE reason.weight > 0]
} AS potentialCollaborator
```

### Explanation

Three things happen in one pass: the first-degree set is collected, the
keyword-mediated candidate set is walked, and an anti-join removes anyone already
connected.

The `RELATED_TO` expansion matters. Without it, two researchers using "GNN" and
"message passing" for the same idea would never match. One hop through the
keyword semantic network catches them, and `$minKeywordStrength` stops the
expansion from becoming noise.

`reasons[]` returns the individual contributions, so the UI can *explain* each
suggestion rather than assert it — essential in a research tool, where an
unexplained recommendation is an unusable one.

### Expected output

```jsonc
{
  "author": { "id": "author-0203", "name": "Tomas Bergman", "title": "Research Scientist",
              "hIndex": 18, "citationCount": 1640,
              "affiliation": { "id": "university-0016", "name": "Technical University of Munich",
                               "country": "Germany" } },
  "sharedKeywords": [
    { "id": "keyword-0021", "term": "message passing" },
    { "id": "keyword-0022", "term": "node embedding" }
  ],
  "sharedKeywordCount": 6,
  "commonResearchDomains": [
    { "id": "topic-0001", "name": "Graph Neural Networks", "field": "Artificial Intelligence" }
  ],
  "mutualCollaborators": [{ "id": "author-0042", "name": "Liang Chen" }],
  "mutualCollaboratorCount": 2,
  "recommendationScore": 14.5,
  "reasons": [
    { "kind": "shared-keyword", "label": "6 shared keyword(s)", "weight": 9 },
    { "kind": "shared-topic", "label": "1 shared research domain(s)", "weight": 3 },
    { "kind": "shared-collaborator", "label": "2 mutual collaborator(s)", "weight": 3 }
  ]
}
```

### Time complexity

`O(k·p·a)` — keywords in the expanded set × papers per keyword × authors per
paper, plus `O(d²)` for the mutual-collaborator check.

### Why graph over SQL

This is the flagship case. SQL needs, simultaneously:
1. A recursive or two-level self-join for the first-degree exclusion set
2. A `NOT EXISTS` anti-join against it
3. A five-way join for keyword overlap
4. A `RELATED_TO` expansion — itself a recursive join
5. A second-degree closure for mutual collaborators

Five separate operations, each materialised, then joined. ~50 lines, and the
`RELATED_TO` expansion alone would probably be dropped as too expensive.

In Cypher they compose because they are all patterns over the same structure.
Nothing is materialised that is not returned.

---

## Query 6 — Paper Recommendation Engine

### Objective

Recommend papers related to a selected one, blending keyword overlap, citation
structure and topic alignment into a single explainable score.

### Real-world use case

A researcher reading a paper wants "more like this" — but not only papers that
cite it. The valuable recommendations are papers the community *treats* as
related (co-cited) and papers built on the same foundations (bibliographic
coupling), neither of which any direct link reveals.

### Graph traversal path

```
Paper ─HAS_KEYWORD─▶ Keyword ◀─HAS_KEYWORD─ Paper      (keyword overlap)
Paper ◀─CITES─ Paper ─CITES─▶ Paper                    (co-citation)
Paper ─CITES─▶ Paper ◀─CITES─ Paper                    (bibliographic coupling)
Paper ─HAS_TOPIC─▶ ResearchTopic ◀─HAS_TOPIC─ Paper    (topic overlap)
```

### OpenCypher

```cypher
MATCH (source:Paper { id: $paperId })

// --- Signal 1: shared keywords ---
OPTIONAL MATCH (source)-[:HAS_KEYWORD]->(keyword:Keyword)<-[:HAS_KEYWORD]-(byKeyword:Paper)
WHERE byKeyword.id <> source.id
WITH source, byKeyword, count(DISTINCT keyword) AS n
WITH source, [row IN collect(
       CASE WHEN byKeyword IS NULL THEN NULL
            ELSE { id: byKeyword.id, kw: n, topic: 0, coCited: 0, coupled: 0 } END
     ) WHERE row IS NOT NULL] AS keywordRows

// --- Signal 2: shared topics ---
OPTIONAL MATCH (source)-[:HAS_TOPIC]->(topic:ResearchTopic)<-[:HAS_TOPIC]-(byTopic:Paper)
WHERE byTopic.id <> source.id
WITH source, keywordRows, byTopic, count(DISTINCT topic) AS n
WITH source, keywordRows, [row IN collect(
       CASE WHEN byTopic IS NULL THEN NULL
            ELSE { id: byTopic.id, kw: 0, topic: n, coCited: 0, coupled: 0 } END
     ) WHERE row IS NOT NULL] AS topicRows

// --- Signal 3: co-citation — cited alongside the source ---
OPTIONAL MATCH (source)<-[:CITES]-(citing:Paper)-[:CITES]->(coCited:Paper)
WHERE coCited.id <> source.id
WITH source, keywordRows, topicRows, coCited, count(DISTINCT citing) AS n
WITH source, keywordRows, topicRows, [row IN collect(
       CASE WHEN coCited IS NULL THEN NULL
            ELSE { id: coCited.id, kw: 0, topic: 0, coCited: n, coupled: 0 } END
     ) WHERE row IS NOT NULL] AS coCitationRows

// --- Signal 4: bibliographic coupling — cites the same sources ---
OPTIONAL MATCH (source)-[:CITES]->(reference:Paper)<-[:CITES]-(coupled:Paper)
WHERE coupled.id <> source.id
WITH keywordRows, topicRows, coCitationRows, coupled, count(DISTINCT reference) AS n
WITH keywordRows, topicRows, coCitationRows, [row IN collect(
       CASE WHEN coupled IS NULL THEN NULL
            ELSE { id: coupled.id, kw: 0, topic: 0, coCited: 0, coupled: n } END
     ) WHERE row IS NOT NULL] AS couplingRows

// Merge the four signal sets and sum per candidate.
UNWIND (keywordRows + topicRows + coCitationRows + couplingRows) AS row
WITH row.id AS candidateId,
     sum(row.kw)      AS sharedKeywords,
     sum(row.topic)   AS sharedTopics,
     sum(row.coCited) AS coCitations,
     sum(row.coupled) AS sharedReferences
WITH candidateId, sharedKeywords, sharedTopics, coCitations, sharedReferences,
     toFloat(sharedKeywords)   * $keywordWeight    +
     toFloat(sharedTopics)     * $topicWeight      +
     toFloat(coCitations)      * $coCitationWeight +
     toFloat(sharedReferences) * $couplingWeight   AS similarityScore
WHERE similarityScore > 0
ORDER BY similarityScore DESC
LIMIT $limit

MATCH (candidate:Paper { id: candidateId })

// Does a direct citation link exist in either direction?
OPTIONAL MATCH (candidate)-[outgoing:CITES]->(:Paper { id: $paperId })
OPTIONAL MATCH (candidate)<-[incoming:CITES]-(:Paper { id: $paperId })

OPTIONAL MATCH (author:Author)-[au:AUTHORED]->(candidate)
WITH candidate, sharedKeywords, sharedTopics, coCitations, sharedReferences,
     similarityScore, outgoing, incoming, author, au
ORDER BY similarityScore DESC, au.position ASC
WITH candidate, sharedKeywords, sharedTopics, coCitations, sharedReferences,
     similarityScore, outgoing, incoming,
     collect(DISTINCT { id: author.id, name: author.name }) AS authors

OPTIONAL MATCH (candidate)-[:HAS_TOPIC]->(candidateTopic:ResearchTopic)
OPTIONAL MATCH (candidate)-[:HAS_KEYWORD]->(candidateKeyword:Keyword)

RETURN {
  paper: {
    id: candidate.id, title: candidate.title, year: candidate.year,
    doi: candidate.doi, citationCount: candidate.citationCount, authors: authors
  },
  researchTopics: collect(DISTINCT { id: candidateTopic.id, name: candidateTopic.name })[0..5],
  sharedKeywordCount: sharedKeywords,
  sharedTopicCount: sharedTopics,
  coCitationCount: coCitations,
  sharedReferenceCount: sharedReferences,
  citationRelationship: CASE
    WHEN outgoing IS NOT NULL THEN 'cites-source'
    WHEN incoming IS NOT NULL THEN 'cited-by-source'
    ELSE 'none' END,
  similarityScore: similarityScore
} AS recommendation
ORDER BY recommendation.similarityScore DESC
```

### Explanation

Four **independent** signals, deliberately kept separable rather than collapsed
into one number:

| Signal | Pattern | What it captures |
|---|---|---|
| Shared keywords | 2 hops via `Keyword` | Same specific problem |
| Shared topics | 2 hops via `ResearchTopic` | Same subject area |
| Co-citation | `(a)<-[:CITES]-()-[:CITES]->(b)` | The field already links them |
| Bibliographic coupling | `(a)-[:CITES]->()<-[:CITES]-(b)` | Same intellectual foundation |

Aggregating each signal *per candidate before merging* is what preserves the
breakdown. That is why the API can return "3 shared topics, co-cited by 2 papers"
instead of an opaque 14.5.

Co-citation and coupling are the classic bibliometric similarity measures and the
two that no keyword or topic analysis can reproduce — two papers can share zero
vocabulary and still be co-cited by every survey in the field.

### Expected output

```jsonc
{
  "paper": { "id": "paper-0231", "title": "Hierarchical Models for Graph Neural Networks",
             "year": 2022, "doi": "10.4821/rn.00231", "citationCount": 87,
             "authors": [{ "id": "author-0042", "name": "Liang Chen" }] },
  "researchTopics": [{ "id": "topic-0001", "name": "Graph Neural Networks" }],
  "sharedKeywordCount": 4,
  "sharedTopicCount": 2,
  "coCitationCount": 3,
  "sharedReferenceCount": 5,
  "citationRelationship": "cited-by-source",
  "similarityScore": 26.5
}
```

### Time complexity

`O(k·p + c·r)` — keyword/topic fan-out plus citation-neighbourhood expansion.
Each signal is two hops, so all four are bounded by the source's immediate
neighbourhood.

### Why graph over SQL

Co-citation and bibliographic coupling each require their **own self-join** of
the citations table:

```sql
-- Co-citation only
SELECT c2.cited_id, COUNT(DISTINCT c1.citing_id) AS co_citations
FROM citations c1
JOIN citations c2 ON c2.citing_id = c1.citing_id
WHERE c1.cited_id = $1 AND c2.cited_id <> $1
GROUP BY c2.cited_id;
```

That is one signal. Four signals means four separate queries, four result sets
merged in the application, and the per-signal breakdown reconstructed by hand.

In Cypher each signal is a single line, and the merge is an `UNWIND` of the
concatenated rows.

---

## Query 7 — Funding Opportunity Discovery

### Objective

Find funding agencies that support research in a given topic, with their funded
projects, resulting papers, research portfolio and funding history.

### Real-world use case

A researcher preparing a grant application needs to know which agencies
*actually* fund their area — evidenced by projects that produced papers on it,
not by an agency's published remit.

### Graph traversal path

```
ResearchTopic ◀─HAS_TOPIC─ Paper ─PART_OF_PROJECT─▶ Project ─FUNDED_BY─▶ FundingAgency
```

Note there is **no direct edge** from a funder to a paper or a topic anywhere in
the model. Funders fund programmes; programmes produce papers. The indirection is
deliberate, and this query is why it pays off.

### OpenCypher

```cypher
MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(paper:Paper)
      -[:PART_OF_PROJECT]->(project:ResearchProject)-[grant:FUNDED_BY]->(agency:FundingAgency)
WHERE ($fromYear IS NULL OR project.startYear >= $fromYear)
  AND ($status IS NULL OR project.status = $status)
  AND ($country IS NULL OR agency.country = $country)

WITH agency,
     collect(DISTINCT project) AS projects,
     collect(DISTINCT paper)   AS fundedPapers,
     sum(grant.amountUsd)      AS totalAwardedForTopic,
     count(DISTINCT project)   AS projectCount,
     min(project.startYear)    AS firstFundedYear,
     max(project.startYear)    AS latestFundedYear

// The agency's full portfolio, for context beyond the queried topic.
OPTIONAL MATCH (agency)<-[allGrants:FUNDED_BY]-(allProjects:ResearchProject)
WITH agency, projects, fundedPapers, totalAwardedForTopic, projectCount,
     firstFundedYear, latestFundedYear,
     count(DISTINCT allProjects)          AS totalProjects,
     sum(coalesce(allGrants.amountUsd, 0)) AS totalAwardedOverall

// Which other research areas this agency backs.
OPTIONAL MATCH (agency)<-[:FUNDED_BY]-(:ResearchProject)-[:HAS_TOPIC]->(portfolio:ResearchTopic)
WITH agency, projects, fundedPapers, totalAwardedForTopic, projectCount,
     firstFundedYear, latestFundedYear, totalProjects, totalAwardedOverall,
     portfolio, count(*) AS portfolioStrength
ORDER BY portfolioStrength DESC
WITH agency, projects, fundedPapers, totalAwardedForTopic, projectCount,
     firstFundedYear, latestFundedYear, totalProjects, totalAwardedOverall,
     collect(DISTINCT { id: portfolio.id, name: portfolio.name,
                        field: portfolio.field })[0..8] AS researchAreas

WITH agency, projects, fundedPapers, totalAwardedForTopic, projectCount,
     firstFundedYear, latestFundedYear, totalProjects, totalAwardedOverall, researchAreas,
     // Topic focus: what share of this agency's projects touch the queried area.
     CASE WHEN totalProjects = 0 THEN 0.0
          ELSE toFloat(projectCount) / toFloat(totalProjects) END AS topicFocus
ORDER BY totalAwardedForTopic DESC, projectCount DESC
LIMIT $limit

RETURN {
  agency: {
    id: agency.id, name: agency.name, country: agency.country,
    type: agency.type, annualBudgetUsd: agency.annualBudgetUsd, website: agency.website
  },
  relatedProjects: [p IN projects | {
    id: p.id, title: p.title, status: p.status,
    startYear: p.startYear, endYear: p.endYear, budgetUsd: p.budgetUsd
  }][0..10],
  fundedPapers: [p IN fundedPapers | {
    id: p.id, title: p.title, year: p.year, citationCount: p.citationCount
  }][0..10],
  researchAreas: researchAreas,
  fundingHistory: {
    projectsInThisTopic: projectCount,
    totalProjects: totalProjects,
    awardedForThisTopic: totalAwardedForTopic,
    awardedOverall: totalAwardedOverall,
    firstFundedYear: firstFundedYear,
    latestFundedYear: latestFundedYear,
    topicFocus: topicFocus,
    isActiveFunder: latestFundedYear >= $recentYearThreshold
  }
} AS fundingOpportunity
```

### Explanation

The four-hop chain `Topic ← Paper → Project → Agency` is the entire point: it
connects two entities with no direct relationship between them.

`topicFocus` is the differentiating output. An agency with 3 of 8 projects in
your area is a far better target than one with 3 of 400 — even though the raw
count is identical. Same reasoning as the expert query's focus ratio, applied to
money.

`isActiveFunder` guards against a common failure: an agency that funded the area
heavily in 2015 and has not since. `latestFundedYear` comes free from the same
traversal.

`grant.amountUsd` lives on the relationship because a co-funded project has a
different amount from each agency — a fact that belongs to the award, not to
either endpoint.

### Expected output

```jsonc
{
  "agency": { "id": "agency-0003", "name": "European Research Council",
              "country": "European Union", "type": "Supranational",
              "annualBudgetUsd": 2400000000, "website": "https://www.european-research-council.org" },
  "relatedProjects": [
    { "id": "project-0044", "title": "Consortium for Trustworthy Graph Neural Networks",
      "status": "Active", "startYear": 2021, "endYear": 2026, "budgetUsd": 12500000 }
  ],
  "fundedPapers": [
    { "id": "paper-0231", "title": "Hierarchical Models for Graph Neural Networks",
      "year": 2022, "citationCount": 87 }
  ],
  "researchAreas": [
    { "id": "topic-0001", "name": "Graph Neural Networks", "field": "Artificial Intelligence" },
    { "id": "topic-0007", "name": "Algorithmic Fairness", "field": "Artificial Intelligence" }
  ],
  "fundingHistory": {
    "projectsInThisTopic": 3, "totalProjects": 11,
    "awardedForThisTopic": 21750000, "awardedOverall": 68300000,
    "firstFundedYear": 2018, "latestFundedYear": 2023,
    "topicFocus": 0.273, "isActiveFunder": true
  }
}
```

### Time complexity

`O(p·j·g)` — papers on the topic × projects per paper × grants per project.
Small in practice: a paper belongs to at most one project, and a project has 1–3
funders.

### Why graph over SQL

Four join tables in sequence — `paper_topics`, `project_papers`, `projects`,
`project_funding` — plus a second pass for the agency's full portfolio and a
third for its research areas:

```sql
SELECT fa.id, fa.name, COUNT(DISTINCT p.id) AS projects, SUM(pf.amount_usd) AS awarded
FROM paper_topics pt
JOIN project_papers pp  ON pp.paper_id   = pt.paper_id
JOIN projects p         ON p.id          = pp.project_id
JOIN project_funding pf ON pf.project_id = p.id
JOIN funding_agencies fa ON fa.id        = pf.agency_id
WHERE pt.topic_id = $1
GROUP BY fa.id, fa.name;
-- …then two more queries for portfolio and research areas.
```

Each join multiplies intermediate rows; `topicFocus` needs the agency's global
project count, which is another correlated subquery.

More fundamentally: **the graph makes the indirection cheap enough to model
honestly.** In a relational schema the temptation is to denormalise a
`paper.funding_agency_id` shortcut, which then lies whenever a project has
multiple funders or a paper spans projects.

---

## Additional Graph Analytics

Sixteen production queries. Each states its objective, the traversal, and the
relational cost.

---

### A1 — Shortest collaboration path between two researchers

**Objective.** Find how any two researchers are connected, and every equally
short route.

```cypher
MATCH (from:Author { id: $fromId })
MATCH (to:Author   { id: $toId })
MATCH path = allShortestPaths((from)-[:COLLABORATED_WITH*1..8]-(to))
WHERE length(path) <= $maxDepth
WITH path,
     reduce(strength = 0, rel IN relationships(path) | strength + coalesce(rel.paperCount, 0)) AS pathStrength
ORDER BY pathStrength DESC
LIMIT $limit
RETURN {
  hops: length(path),
  pathStrength: pathStrength,
  chain: [node IN nodes(path) | { id: node.id, name: node.name, hIndex: node.hIndex }],
  ties: [rel IN relationships(path) | {
    sharedPapers: rel.paperCount, firstYear: rel.firstYear, lastYear: rel.lastYear
  }]
} AS route
```

**Why graph.** `allShortestPaths` is a bidirectional BFS. Ranking by
`pathStrength` surfaces the route through the *strongest* ties — the best
introduction, not just the shortest one. **`O(d^(h/2))`.**

---

### A2 — Most influential authors

**Objective.** Rank authors by a composite of citation impact, network centrality
and reach.

```cypher
MATCH (author:Author)
WHERE ($field IS NULL OR author.primaryField = $field)

OPTIONAL MATCH (author)-[:AUTHORED]->(paper:Paper)
WITH author, count(DISTINCT paper) AS papers,
     sum(coalesce(paper.citationCount, 0)) AS citations

OPTIONAL MATCH (author)-[collab:COLLABORATED_WITH]-(:Author)
WITH author, papers, citations,
     count(collab) AS degreeCentrality,
     sum(coalesce(collab.paperCount, 0)) AS collaborationVolume

// Second-degree reach — a proxy for network influence.
OPTIONAL MATCH (author)-[:COLLABORATED_WITH*2]-(reach:Author)
WITH author, papers, citations, degreeCentrality, collaborationVolume,
     count(DISTINCT reach) AS twoHopReach

WITH author, papers, citations, degreeCentrality, collaborationVolume, twoHopReach,
     log(toFloat(citations) + 1)      * $citationWeight   +
     toFloat(coalesce(author.hIndex, 0)) * $hIndexWeight  +
     log(toFloat(degreeCentrality) + 1) * $centralityWeight +
     log(toFloat(twoHopReach) + 1)     * $reachWeight     AS influenceScore
ORDER BY influenceScore DESC
LIMIT $limit
RETURN { author: author { .id, .name, .title, .hIndex },
         papers: papers, citations: citations,
         degreeCentrality: degreeCentrality, twoHopReach: twoHopReach,
         influenceScore: influenceScore } AS row
```

**Why graph.** `twoHopReach` is network influence — impossible to express
relationally without a recursive CTE per author. **`O(n·d²)`**; cache for
dashboards.

---

### A3 — Most cited papers

**Objective.** Rank by citation count with velocity, so recent high-impact work
is not buried by old classics.

```cypher
MATCH (paper:Paper)
WHERE ($fromYear IS NULL OR paper.year >= $fromYear)
  AND ($topicId IS NULL OR (paper)-[:HAS_TOPIC]->(:ResearchTopic { id: $topicId }))

OPTIONAL MATCH (paper)<-[cite:CITES]-(citing:Paper)
WITH paper, count(cite) AS citations,
     count(CASE WHEN cite.year >= $recentYearThreshold THEN 1 END) AS recentCitations,
     collect(DISTINCT citing.year) AS citationYears

WITH paper, citations, recentCitations,
     // Citations per year since publication — comparable across eras.
     toFloat(citations) / toFloat(CASE WHEN $currentYear - paper.year <= 0
                                       THEN 1 ELSE $currentYear - paper.year END) AS velocity
ORDER BY citations DESC
LIMIT $limit

OPTIONAL MATCH (author:Author)-[au:AUTHORED]->(paper)
WITH paper, citations, recentCitations, velocity, author, au
ORDER BY citations DESC, au.position ASC
RETURN { paper: paper { .id, .title, .year, .doi },
         citations: citations, recentCitations: recentCitations, velocity: velocity,
         authors: collect({ id: author.id, name: author.name }) } AS row
```

**Why graph.** `recentCitations` reads `cite.year` **from the relationship** —
the year of the citing act, which no denormalised counter column can hold.
**`O(p·c)`.**

---

### A4 — Emerging research topics

**Objective.** Detect topics accelerating now, by comparing consecutive windows.

```cypher
MATCH (topic:ResearchTopic)<-[:HAS_TOPIC]-(paper:Paper)
WHERE paper.year >= $priorFromYear
  AND ($field IS NULL OR topic.field = $field)

WITH topic,
     sum(CASE WHEN paper.year >= $recentFromYear THEN 1 ELSE 0 END) AS recentPapers,
     sum(CASE WHEN paper.year <  $recentFromYear THEN 1 ELSE 0 END) AS priorPapers,
     sum(CASE WHEN paper.year >= $recentFromYear
              THEN coalesce(paper.citationCount, 0) ELSE 0 END) AS recentCitations
WHERE recentPapers >= $minRecentPapers

WITH topic, recentPapers, priorPapers, recentCitations,
     toFloat(recentPapers) / toFloat(CASE WHEN priorPapers = 0 THEN 1 ELSE priorPapers END) AS growthRate
WITH topic, recentPapers, priorPapers, recentCitations, growthRate,
     // log-volume damping: 1→3 papers must not outrank 40→90
     growthRate * log(toFloat(recentPapers) + 1) AS momentum
ORDER BY momentum DESC
LIMIT $limit

OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(recent:Paper)<-[:AUTHORED]-(author:Author)
WHERE recent.year >= $recentFromYear
WITH topic, recentPapers, priorPapers, recentCitations, growthRate, momentum,
     author, count(recent) AS authored
ORDER BY momentum DESC, authored DESC
RETURN { topic: topic { .id, .name, .field, .emergenceYear },
         recentPapers: recentPapers, priorPapers: priorPapers,
         recentCitations: recentCitations, growthRate: growthRate, momentum: momentum,
         leadingAuthors: collect({ id: author.id, name: author.name })[0..5] } AS row
```

**Why graph.** No warehouse, no nightly job. The trend is derived at query time
and is correct the instant a paper lands. **`O(t·p)`.**

---

### A5 — Trending keywords

```cypher
MATCH (keyword:Keyword)<-[:HAS_KEYWORD]-(paper:Paper)
WHERE paper.year >= $priorFromYear
WITH keyword,
     sum(CASE WHEN paper.year >= $recentFromYear THEN 1 ELSE 0 END) AS recentUses,
     sum(CASE WHEN paper.year <  $recentFromYear THEN 1 ELSE 0 END) AS priorUses
WHERE recentUses >= $minRecentUses

WITH keyword, recentUses, priorUses,
     toFloat(recentUses) / toFloat(CASE WHEN priorUses = 0 THEN 1 ELSE priorUses END) AS growth
ORDER BY growth * log(toFloat(recentUses) + 1) DESC
LIMIT $limit

// Which topics this keyword is spreading into — the interesting part.
OPTIONAL MATCH (keyword)<-[:HAS_KEYWORD]-(p:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
WHERE p.year >= $recentFromYear
RETURN { keyword: keyword { .id, .term },
         recentUses: recentUses, priorUses: priorUses, growth: growth,
         spreadingInto: collect(DISTINCT { id: topic.id, name: topic.name })[0..5] } AS row
```

**Why graph.** `spreadingInto` shows a keyword crossing field boundaries — an
early signal of cross-disciplinary transfer, and a two-hop traversal. **`O(k·p)`.**

---

### A6 — Research communities

**Objective.** Detect clusters of tightly-connected researchers, without a
community-detection library.

```cypher
MATCH (seed:Author)
WHERE ($field IS NULL OR seed.primaryField = $field)
WITH seed ORDER BY seed.citationCount DESC LIMIT $seedLimit

// Expand two hops through strong ties only.
MATCH (seed)-[c1:COLLABORATED_WITH]-(member:Author)
WHERE c1.paperCount >= $minTieStrength
OPTIONAL MATCH (member)-[c2:COLLABORATED_WITH]-(peer:Author)
WHERE c2.paperCount >= $minTieStrength AND peer <> seed

WITH seed, collect(DISTINCT member) AS members, collect(DISTINCT peer) AS extended
WITH seed, members, [p IN extended WHERE NOT p IN members] AS periphery
WHERE size(members) >= $minCommunitySize

// Internal density: how interconnected the core actually is.
UNWIND members AS m1
UNWIND members AS m2
WITH seed, members, periphery, m1, m2
WHERE elementId(m1) < elementId(m2)
OPTIONAL MATCH (m1)-[internal:COLLABORATED_WITH]-(m2)
WITH seed, members, periphery, count(internal) AS internalEdges

// The community's shared research focus.
UNWIND members AS member
OPTIONAL MATCH (member)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
WITH seed, members, periphery, internalEdges, topic, count(*) AS topicWeight
ORDER BY topicWeight DESC

WITH seed, members, periphery, internalEdges,
     collect(DISTINCT { id: topic.id, name: topic.name })[0..5] AS focusTopics,
     size(members) AS memberCount
RETURN {
  anchor: seed { .id, .name },
  memberCount: memberCount,
  members: [m IN members | { id: m.id, name: m.name, hIndex: m.hIndex }][0..20],
  peripherySize: size(periphery),
  internalEdges: internalEdges,
  // Actual edges ÷ possible edges: 1.0 means everyone works with everyone.
  density: CASE WHEN memberCount < 2 THEN 0.0
                ELSE toFloat(internalEdges) / (toFloat(memberCount * (memberCount - 1)) / 2.0) END,
  focusTopics: focusTopics
} AS community
ORDER BY community.density DESC, community.memberCount DESC
```

**Why graph.** Density requires counting edges *within* a discovered node set —
the double `UNWIND` with `elementId(m1) < elementId(m2)` does it in one pass.
Relationally this is a self-join against a set that does not exist until the
first query has run. **`O(s·d²)`.**

---

### A7 — Cross-disciplinary collaborations

```cypher
MATCH (paper:Paper)-[:HAS_TOPIC]->(topicA:ResearchTopic)
MATCH (paper)-[:HAS_TOPIC]->(topicB:ResearchTopic)
// Different fields, canonical order so (AI, Robotics) is not also (Robotics, AI).
WHERE topicA.field < topicB.field
  AND ($field IS NULL OR topicA.field = $field OR topicB.field = $field)
  AND ($fromYear IS NULL OR paper.year >= $fromYear)

WITH topicA.field AS fieldA, topicB.field AS fieldB, collect(DISTINCT paper) AS papers
WITH fieldA, fieldB, papers, size(papers) AS paperCount
WHERE paperCount >= $minPapers

UNWIND papers AS crossPaper
MATCH (author:Author)-[:AUTHORED]->(crossPaper)
OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(uni:University)
WITH fieldA, fieldB, paperCount, papers,
     count(DISTINCT author) AS authorCount,
     count(DISTINCT uni)    AS institutionCount,
     sum(coalesce(crossPaper.citationCount, 0)) AS totalCitations
ORDER BY paperCount DESC, totalCitations DESC
LIMIT $limit
RETURN { fieldA: fieldA, fieldB: fieldB,
         paperCount: paperCount, authorCount: authorCount,
         institutionCount: institutionCount, totalCitations: totalCitations,
         // Citations per paper: is bridging fields actually paying off?
         avgImpact: toFloat(totalCitations) / toFloat(paperCount),
         exemplars: [p IN papers | { id: p.id, title: p.title, year: p.year }][0..5] } AS row
```

**Why graph.** "Cross-disciplinary" is not a column — it is a property of a
paper's *position*, having topic edges reaching into two fields. The traversal is
what makes the concept expressible. **`O(p·t²)`.**

---

### A8 — Conference influence analysis

```cypher
MATCH (paper:Paper)-[pa:PRESENTED_AT]->(conference:Conference)
WHERE ($fromYear IS NULL OR pa.year >= $fromYear)
  AND ($field IS NULL OR conference.field = $field)

WITH conference,
     count(DISTINCT paper) AS papers,
     sum(coalesce(paper.citationCount, 0)) AS citations,
     collect(paper) AS venuePapers

// External influence: citations arriving from papers NOT at this venue.
UNWIND venuePapers AS vp
OPTIONAL MATCH (vp)<-[:CITES]-(citing:Paper)
WHERE NOT (citing)-[:PRESENTED_AT]->(conference)
WITH conference, papers, citations, venuePapers, count(DISTINCT citing) AS externalCitations

UNWIND venuePapers AS vp2
OPTIONAL MATCH (vp2)<-[:AUTHORED]-(author:Author)-[:AFFILIATED_WITH]->(uni:University)
WITH conference, papers, citations, externalCitations,
     count(DISTINCT author) AS contributors,
     count(DISTINCT uni)    AS institutions,
     count(DISTINCT uni.country) AS countries

RETURN { conference: conference { .id, .name, .acronym, .tier, .field },
         papers: papers, citations: citations, externalCitations: externalCitations,
         avgCitationsPerPaper: toFloat(citations) / toFloat(CASE WHEN papers = 0 THEN 1 ELSE papers END),
         // Share of impact from outside the venue's own community.
         externalInfluenceRatio: toFloat(externalCitations) /
                                 toFloat(CASE WHEN citations = 0 THEN 1 ELSE citations END),
         contributors: contributors, institutions: institutions, countries: countries } AS row
ORDER BY row.citations DESC LIMIT $limit
```

**Why graph.** `externalInfluenceRatio` needs a `NOT EXISTS` on a *pattern* — "a
citing paper that was not presented here" — inside an aggregate. That is a
correlated `NOT EXISTS` subquery per row in SQL. **`O(p·c)`.**

---

### A9 — Journal impact network

**Objective.** Map how journals cite each other — the flow of ideas between
venues.

```cypher
MATCH (citingPaper:Paper)-[:PUBLISHED_IN]->(citingJournal:Journal)
MATCH (citingPaper)-[:CITES]->(citedPaper:Paper)-[:PUBLISHED_IN]->(citedJournal:Journal)
WHERE citingJournal.id <> citedJournal.id
  AND ($minImpactFactor IS NULL OR citingJournal.impactFactor >= $minImpactFactor)

WITH citingJournal, citedJournal, count(*) AS citationFlow
WHERE citationFlow >= $minFlow
ORDER BY citationFlow DESC
LIMIT $limit

// Reciprocal flow — mutual exchange versus one-way influence.
OPTIONAL MATCH (citedJournal)<-[:PUBLISHED_IN]-(:Paper)-[:CITES]->(:Paper)-[:PUBLISHED_IN]->(citingJournal)
WITH citingJournal, citedJournal, citationFlow, count(*) AS reverseFlow
RETURN { from: citingJournal { .id, .name, .impactFactor },
         to:   citedJournal  { .id, .name, .impactFactor },
         citationFlow: citationFlow, reverseFlow: reverseFlow,
         // > 0 means net exporter of influence
         netFlow: citationFlow - reverseFlow,
         isReciprocal: reverseFlow > 0 } AS edge
```

**Why graph.** A journal-to-journal network derived from a paper-to-paper one —
four hops. Relationally: a four-way join plus a correlated subquery for reverse
flow. **`O(c)`** over citation edges.

---

### A10 — Dataset usage network

```cypher
MATCH (dataset:Dataset)<-[ud:USES_DATASET]-(paper:Paper)
WHERE ($domain IS NULL OR dataset.domain = $domain)

WITH dataset, count(DISTINCT paper) AS usageCount,
     sum(coalesce(paper.citationCount, 0)) AS citationsOfUsers,
     collect(DISTINCT ud.usageType) AS usageTypes,
     collect(paper) AS papers

// Which fields reach for this dataset — cross-domain reuse is the key signal.
UNWIND papers AS p
OPTIONAL MATCH (p)-[:HAS_TOPIC]->(topic:ResearchTopic)
WITH dataset, usageCount, citationsOfUsers, usageTypes, papers,
     collect(DISTINCT topic.field) AS fields,
     collect(DISTINCT { id: topic.id, name: topic.name }) AS topics

// Datasets frequently used alongside this one.
UNWIND papers AS p2
OPTIONAL MATCH (p2)-[:USES_DATASET]->(companion:Dataset)
WHERE companion.id <> dataset.id
WITH dataset, usageCount, citationsOfUsers, usageTypes, fields, topics,
     companion, count(*) AS coUsage
ORDER BY coUsage DESC

RETURN { dataset: dataset { .id, .name, .domain, .license, .releaseYear },
         usageCount: usageCount, citationsOfUsers: citationsOfUsers,
         usageTypes: usageTypes,
         fieldsUsingIt: fields, crossDomainReach: size(fields),
         topics: topics[0..8],
         frequentlyPairedWith: collect(DISTINCT { id: companion.id, name: companion.name,
                                                  coUsage: coUsage })[0..5] } AS row
ORDER BY row.usageCount DESC LIMIT $limit
```

**Why graph.** `crossDomainReach` finds datasets bridging unrelated fields —
methodological connections invisible to topic or citation analysis.
**`O(d·p·t)`.**

---

### A11 — University partnership network

**Objective.** Compare *declared* partnerships against *actual* collaboration.

```cypher
MATCH (a:University)-[partnership:PARTNERS_WITH]-(b:University)
WHERE a.id < b.id
  AND ($country IS NULL OR a.country = $country OR b.country = $country)

// Real joint output between the two faculties.
OPTIONAL MATCH (a)<-[:AFFILIATED_WITH]-(x:Author)-[:AUTHORED]->(joint:Paper)
               <-[:AUTHORED]-(y:Author)-[:AFFILIATED_WITH]->(b)
WITH a, b, partnership, count(DISTINCT joint) AS jointPapers,
     count(DISTINCT x) + count(DISTINCT y) AS engagedResearchers

// Shared research interests, whether or not they co-publish.
OPTIONAL MATCH (a)<-[:AFFILIATED_WITH]-(:Author)-[:AUTHORED]->(:Paper)
               -[:HAS_TOPIC]->(topic:ResearchTopic)<-[:HAS_TOPIC]-(:Paper)
               <-[:AUTHORED]-(:Author)-[:AFFILIATED_WITH]->(b)
WITH a, b, partnership, jointPapers, engagedResearchers,
     count(DISTINCT topic) AS sharedTopics

RETURN { universityA: a { .id, .name, .country },
         universityB: b { .id, .name, .country },
         since: partnership.since, focus: partnership.focus,
         jointPapers: jointPapers, engagedResearchers: engagedResearchers,
         sharedTopics: sharedTopics,
         isInternational: a.country <> b.country,
         // The honest verdict on whether the agreement produced anything.
         partnershipHealth: CASE
           WHEN jointPapers >= $strongThreshold THEN 'productive'
           WHEN jointPapers > 0                 THEN 'emerging'
           ELSE 'dormant' END } AS partnership
ORDER BY partnership.jointPapers DESC LIMIT $limit
```

**Why graph.** `partnershipHealth` compares a *stored* edge against a *derived*
one. The derived side is a six-hop traversal; relationally it is a materialised
view refreshed on a schedule. **`O(u·a·p)`.**

---

### A12 — Author recommendation engine

**Objective.** Recommend researchers to follow or approach, blending four
structural signals.

```cypher
MATCH (me:Author { id: $authorId })
OPTIONAL MATCH (me)-[:COLLABORATED_WITH]-(known:Author)
WITH me, collect(DISTINCT known.id) + [me.id] AS excludeIds

// Signal 1 — shared research topics
OPTIONAL MATCH (me)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(t:ResearchTopic)
               <-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(c1:Author)
WHERE NOT c1.id IN excludeIds
WITH me, excludeIds, c1 AS cand, count(DISTINCT t) AS n
WITH me, excludeIds, [r IN collect({ id: cand.id, topic: n, mutual: 0, venue: 0, cite: 0 })
                      WHERE r.id IS NOT NULL] AS topicRows

// Signal 2 — mutual collaborators
OPTIONAL MATCH (me)-[:COLLABORATED_WITH]-(:Author)-[:COLLABORATED_WITH]-(c2:Author)
WHERE NOT c2.id IN excludeIds
WITH me, excludeIds, topicRows, c2 AS cand, count(*) AS n
WITH me, excludeIds, topicRows, [r IN collect({ id: cand.id, topic: 0, mutual: n, venue: 0, cite: 0 })
                                 WHERE r.id IS NOT NULL] AS mutualRows

// Signal 3 — shared publication venues
OPTIONAL MATCH (me)-[:AUTHORED]->(:Paper)-[:PRESENTED_AT]->(v:Conference)
               <-[:PRESENTED_AT]-(:Paper)<-[:AUTHORED]-(c3:Author)
WHERE NOT c3.id IN excludeIds
WITH me, excludeIds, topicRows, mutualRows, c3 AS cand, count(DISTINCT v) AS n
WITH me, excludeIds, topicRows, mutualRows,
     [r IN collect({ id: cand.id, topic: 0, mutual: 0, venue: n, cite: 0 })
      WHERE r.id IS NOT NULL] AS venueRows

// Signal 4 — they cite my work
OPTIONAL MATCH (me)-[:AUTHORED]->(:Paper)<-[:CITES]-(:Paper)<-[:AUTHORED]-(c4:Author)
WHERE NOT c4.id IN excludeIds
WITH topicRows, mutualRows, venueRows, c4 AS cand, count(*) AS n
WITH topicRows, mutualRows, venueRows,
     [r IN collect({ id: cand.id, topic: 0, mutual: 0, venue: 0, cite: n })
      WHERE r.id IS NOT NULL] AS citeRows

UNWIND (topicRows + mutualRows + venueRows + citeRows) AS row
WITH row.id AS candidateId,
     sum(row.topic) AS sharedTopics, sum(row.mutual) AS mutuals,
     sum(row.venue) AS sharedVenues, sum(row.cite)  AS citesMyWork
WITH candidateId, sharedTopics, mutuals, sharedVenues, citesMyWork,
     toFloat(sharedTopics) * $topicWeight + toFloat(mutuals)     * $mutualWeight +
     toFloat(sharedVenues) * $venueWeight + toFloat(citesMyWork) * $citationWeight AS score
WHERE score > 0
ORDER BY score DESC LIMIT $limit

MATCH (candidate:Author { id: candidateId })
OPTIONAL MATCH (candidate)-[:AFFILIATED_WITH { isPrimary: true }]->(uni:University)
RETURN { author: candidate { .id, .name, .title, .hIndex },
         affiliation: head(collect(uni { .id, .name, .country })),
         sharedTopics: sharedTopics, mutualCollaborators: mutuals,
         sharedVenues: sharedVenues, citesMyWork: citesMyWork, score: score } AS row
```

**Why graph.** Four traversals of different shapes, merged by summing per
candidate. Relationally: four queries, four result sets, application-side merge.
**`O(d²·t)`.**

---

### A13 — Topic recommendation engine

**Objective.** Recommend research areas to explore next, from five structural
signals — **no machine learning**.

```cypher
MATCH (seed:ResearchTopic { id: $topicId })

// 1 — Co-occurrence on the same papers (strongest, most direct)
OPTIONAL MATCH (seed)<-[:HAS_TOPIC]-(p:Paper)-[:HAS_TOPIC]->(r1:ResearchTopic)
WHERE r1.id <> seed.id
WITH seed, r1 AS cand, count(DISTINCT p) AS n
WITH seed, [r IN collect({ id: cand.id, co: n, kw: 0, au: 0, ds: 0 })
            WHERE r.id IS NOT NULL] AS coRows

// 2 — Keyword bridges
OPTIONAL MATCH (seed)<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(k:Keyword)
               <-[:HAS_KEYWORD]-(:Paper)-[:HAS_TOPIC]->(r2:ResearchTopic)
WHERE r2.id <> seed.id
WITH seed, coRows, r2 AS cand, count(DISTINCT k) AS n
WITH seed, coRows, [r IN collect({ id: cand.id, co: 0, kw: n, au: 0, ds: 0 })
                    WHERE r.id IS NOT NULL] AS kwRows

// 3 — Author migration (the leading indicator: expertise moves before literature)
OPTIONAL MATCH (seed)<-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(a:Author)
               -[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(r3:ResearchTopic)
WHERE r3.id <> seed.id
WITH seed, coRows, kwRows, r3 AS cand, count(DISTINCT a) AS n
WITH seed, coRows, kwRows, [r IN collect({ id: cand.id, co: 0, kw: 0, au: n, ds: 0 })
                            WHERE r.id IS NOT NULL] AS auRows

// 4 — Shared datasets (methodological kinship)
OPTIONAL MATCH (seed)<-[:HAS_TOPIC]-(:Paper)-[:USES_DATASET]->(d:Dataset)
               <-[:USES_DATASET]-(:Paper)-[:HAS_TOPIC]->(r4:ResearchTopic)
WHERE r4.id <> seed.id
WITH coRows, kwRows, auRows, r4 AS cand, count(DISTINCT d) AS n
WITH coRows, kwRows, auRows, [r IN collect({ id: cand.id, co: 0, kw: 0, au: 0, ds: n })
                              WHERE r.id IS NOT NULL] AS dsRows

UNWIND (coRows + kwRows + auRows + dsRows) AS row
WITH row.id AS topicId,
     sum(row.co) AS coOccurrence, sum(row.kw) AS keywordBridge,
     sum(row.au) AS sharedAuthors, sum(row.ds) AS sharedDatasets
WITH topicId, coOccurrence, keywordBridge, sharedAuthors, sharedDatasets,
     toFloat(coOccurrence)   * $coWeight      + toFloat(keywordBridge) * $kwWeight +
     toFloat(sharedAuthors)  * $authorWeight  + toFloat(sharedDatasets) * $datasetWeight AS score
WHERE score > 0
ORDER BY score DESC LIMIT $limit

MATCH (related:ResearchTopic { id: topicId })
RETURN { topic: related { .id, .name, .field, .emergenceYear, .paperCount },
         signals: { coOccurrence: coOccurrence, keywordBridge: keywordBridge,
                    sharedAuthors: sharedAuthors, sharedDatasets: sharedDatasets },
         score: score } AS recommendation
```

**Why graph.** Every recommendation is **explainable** — the system can name the
exact papers, authors and datasets that produced it. A trained model returns an
embedding distance. In a research tool, an unexplained suggestion is unusable.
**`O(p·t + p·k + p·a)`.**

---

### A14 — Similar paper discovery (content-based)

**Objective.** Find similar papers using *only* content signals, for papers with
no citations yet — the cold-start case where Query 6 degrades.

```cypher
MATCH (source:Paper { id: $paperId })-[:HAS_KEYWORD]->(keyword:Keyword)
WITH source, collect(DISTINCT keyword) AS sourceKeywords
WITH source, sourceKeywords, size(sourceKeywords) AS sourceSize
WHERE sourceSize > 0

UNWIND sourceKeywords AS kw
MATCH (kw)<-[:HAS_KEYWORD]-(candidate:Paper)
WHERE candidate.id <> source.id
WITH source, sourceSize, candidate,
     collect(DISTINCT { id: kw.id, term: kw.term }) AS sharedKeywords,
     count(DISTINCT kw) AS overlap

MATCH (candidate)-[:HAS_KEYWORD]->(candidateKeyword:Keyword)
WITH source, sourceSize, candidate, sharedKeywords, overlap,
     count(DISTINCT candidateKeyword) AS candidateSize

WITH candidate, sharedKeywords, overlap,
     // Jaccard over keyword sets
     toFloat(overlap) / toFloat(sourceSize + candidateSize - overlap) AS jaccard
WHERE overlap >= $minSharedKeywords
ORDER BY jaccard DESC LIMIT $limit

OPTIONAL MATCH (candidate)-[:HAS_TOPIC]->(topic:ResearchTopic)
OPTIONAL MATCH (author:Author)-[:AUTHORED]->(candidate)
RETURN { paper: candidate { .id, .title, .year, .citationCount },
         sharedKeywords: sharedKeywords[0..8], sharedKeywordCount: overlap,
         jaccardSimilarity: jaccard,
         topics: collect(DISTINCT topic { .id, .name })[0..4],
         authors: collect(DISTINCT author { .id, .name })[0..5] } AS row
```

**Why graph.** Works from the first edge — no citation history, no training data,
no cold start. **`O(k·p)`.**

---

### A15 — Collaboration network visualisation

**Objective.** Return a renderable subgraph: deduplicated nodes, edges confined
to that node set, and a degree per node for sizing.

```cypher
MATCH (center:Author { id: $authorId })
MATCH path = (center)-[:COLLABORATED_WITH*1..2]-(peer:Author)
WHERE ($minTieStrength IS NULL OR
       all(rel IN relationships(path) WHERE rel.paperCount >= $minTieStrength))
WITH center, peer, min(length(path)) AS distance
ORDER BY distance ASC, peer.hIndex DESC
LIMIT $nodeLimit

WITH collect(peer) + [center] AS people
UNWIND people AS node
WITH collect(DISTINCT node) AS nodes

// Only the edges BETWEEN returned nodes — otherwise the renderer receives an
// edge pointing at a node it never got, and the layout places a ghost at 0,0.
UNWIND nodes AS a
UNWIND nodes AS b
WITH nodes, a, b WHERE elementId(a) < elementId(b)
OPTIONAL MATCH (a)-[rel:COLLABORATED_WITH]-(b)
WITH nodes, [r IN collect(rel) WHERE r IS NOT NULL] AS edges

// Degree in the WHOLE graph, so a hub renders as a hub even when only part
// of its neighbourhood is on screen.
UNWIND nodes AS n
OPTIONAL MATCH (n)-[anyRel:COLLABORATED_WITH]-()
WITH nodes, edges, n, count(anyRel) AS globalDegree

RETURN {
  nodes: collect({ id: n.id, label: 'Author', name: n.name,
                   hIndex: n.hIndex, citationCount: n.citationCount,
                   degree: globalDegree }),
  edges: [r IN edges | { id: elementId(r),
                         source: startNode(r).id, target: endNode(r).id,
                         weight: r.paperCount,
                         firstYear: r.firstYear, lastYear: r.lastYear }]
} AS graph
```

**Why graph.** Node set, induced edge set and global degree in one round trip.
Relationally: one query for nodes, a second with a large `IN` clause for edges, a
third for degrees. **`O(d² + k²)`.**

---

### A16 — Citation network visualisation

```cypher
MATCH (center:Paper { id: $paperId })

OPTIONAL MATCH backwardPath = (center)<-[:CITES*1..2]-(:Paper)
OPTIONAL MATCH forwardPath  = (center)-[:CITES*1..2]->(:Paper)
WITH center,
     [n IN coalesce(nodes(backwardPath), []) | n] +
     [n IN coalesce(nodes(forwardPath),  []) | n] AS reached
UNWIND (reached + [center]) AS node
WITH collect(DISTINCT node) AS allNodes
WITH allNodes[0..$nodeLimit] AS nodes

UNWIND nodes AS a
UNWIND nodes AS b
WITH nodes, a, b WHERE elementId(a) <> elementId(b)
OPTIONAL MATCH (a)-[rel:CITES]->(b)
WITH nodes, [r IN collect(rel) WHERE r IS NOT NULL] AS edges

RETURN {
  nodes: [n IN nodes | {
    id: n.id, label: 'Paper', title: n.title, year: n.year,
    citationCount: n.citationCount,
    // Distance from the focal paper drives colour in the renderer.
    isCenter: n.id = $paperId }],
  edges: [r IN edges | { id: elementId(r),
                         source: startNode(r).id, target: endNode(r).id,
                         year: r.year }],
  stats: { nodeCount: size(nodes), edgeCount: size(edges) }
} AS graph
```

**Why graph.** `CITES` is directed, so `elementId(a) <> elementId(b)` (not `<`)
is correct here — both directions are meaningful edges, unlike the undirected
collaboration case. **`O(d²)`.**

---

## Index and constraint prerequisites

Every query above assumes this schema. Applied by `npm run db:schema` from
[`database/schema/`](../database/schema/).

### Uniqueness constraints

```cypher
CREATE CONSTRAINT author_id_unique     IF NOT EXISTS FOR (n:Author)          REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT paper_id_unique      IF NOT EXISTS FOR (n:Paper)           REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT university_id_unique IF NOT EXISTS FOR (n:University)      REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT topic_id_unique      IF NOT EXISTS FOR (n:ResearchTopic)   REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT keyword_id_unique    IF NOT EXISTS FOR (n:Keyword)         REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT conference_id_unique IF NOT EXISTS FOR (n:Conference)      REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT journal_id_unique    IF NOT EXISTS FOR (n:Journal)         REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT dataset_id_unique    IF NOT EXISTS FOR (n:Dataset)         REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT agency_id_unique     IF NOT EXISTS FOR (n:FundingAgency)   REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT project_id_unique    IF NOT EXISTS FOR (n:ResearchProject) REQUIRE n.id IS UNIQUE;

-- Natural keys. Without these, near-duplicate nodes fragment traversals:
-- two papers using "graph neural network" and "graph neural networks" would
-- share no Keyword node, and Query 5 and 6 would silently miss the match.
CREATE CONSTRAINT keyword_term_unique IF NOT EXISTS FOR (n:Keyword) REQUIRE n.term  IS UNIQUE;
CREATE CONSTRAINT paper_doi_unique    IF NOT EXISTS FOR (n:Paper)   REQUIRE n.doi   IS UNIQUE;
CREATE CONSTRAINT author_orcid_unique IF NOT EXISTS FOR (n:Author)  REQUIRE n.orcid IS UNIQUE;
```

**Why constraints matter for performance, not just integrity.** Every uniqueness
constraint is index-backed, so `MATCH (n:Label { id: $id })` — the anchor of
every query in this catalogue — is a single index seek rather than a label scan.
Without them, each query would begin by scanning every node of its label.

### Indexes by query

| Query | Required indexes | Why |
|---|---|---|
| 1 — Collaboration | `author.id` (constraint) | Anchor seek; traversal needs no index |
| 2 — Citation path | `paper.id` (constraint) | Both endpoints seeded |
| 3 — Expert discovery | `topic.id`, `author.hIndex` | Anchor + ranking |
| 4 — Similar universities | `university.id`, `university.country` | Anchor + filter |
| 5 — Hidden collaboration | `author.id`, `keyword.term` | Anchor + keyword dedup |
| 6 — Paper recommendation | `paper.id` (constraint) | Anchor only |
| 7 — Funding discovery | `topic.id`, `agency.country`, `project.startYear` | Anchor + filters |
| A2, A3 | `author.citationCount`, `paper.citationCount`, `paper.year` | Ranking + range |
| A4, A5 | `paper.year`, `topic.field` | Windowed comparison |
| A8, A9 | `conference.field`, `journal.impactFactor` | Filter + ranking |

```cypher
-- Search (all ten labels carry a lowercased searchText blob)
CREATE INDEX author_search_text IF NOT EXISTS FOR (n:Author)        ON (n.searchText);
CREATE INDEX paper_search_text  IF NOT EXISTS FOR (n:Paper)         ON (n.searchText);
CREATE INDEX topic_search_text  IF NOT EXISTS FOR (n:ResearchTopic) ON (n.searchText);
-- … and the remaining seven

-- Ranking
CREATE INDEX author_h_index      IF NOT EXISTS FOR (n:Author)        ON (n.hIndex);
CREATE INDEX author_citations    IF NOT EXISTS FOR (n:Author)        ON (n.citationCount);
CREATE INDEX paper_citations     IF NOT EXISTS FOR (n:Paper)         ON (n.citationCount);
CREATE INDEX journal_impact      IF NOT EXISTS FOR (n:Journal)       ON (n.impactFactor);
CREATE INDEX topic_paper_count   IF NOT EXISTS FOR (n:ResearchTopic) ON (n.paperCount);

-- Range filtering
CREATE INDEX paper_year          IF NOT EXISTS FOR (n:Paper)           ON (n.year);
CREATE INDEX project_start_year  IF NOT EXISTS FOR (n:ResearchProject) ON (n.startYear);
CREATE INDEX topic_field         IF NOT EXISTS FOR (n:ResearchTopic)   ON (n.field);
CREATE INDEX university_country  IF NOT EXISTS FOR (n:University)      ON (n.country);
CREATE INDEX agency_country      IF NOT EXISTS FOR (n:FundingAgency)   ON (n.country);
CREATE INDEX conference_tier     IF NOT EXISTS FOR (n:Conference)      ON (n.tier);

-- Composite: "highly cited papers since 2020" is the single most common filter
CREATE INDEX paper_year_citations  IF NOT EXISTS FOR (n:Paper)         ON (n.year, n.citationCount);
CREATE INDEX topic_field_papers    IF NOT EXISTS FOR (n:ResearchTopic) ON (n.field, n.paperCount);
```

### Derived counters

Several queries read `author.paperCount`, `paper.citationCount` and
`topic.paperCount` instead of re-aggregating. These are **computed in Cypher
after the edges exist**, so a counter can never disagree with the relationships
it summarises:

```cypher
-- Citation and reference counts
MATCH (paper:Paper)
OPTIONAL MATCH (paper)<-[incoming:CITES]-(:Paper)
WITH paper, count(incoming) AS citations
OPTIONAL MATCH (paper)-[outgoing:CITES]->(:Paper)
WITH paper, citations, count(outgoing) AS references
SET paper.citationCount = citations, paper.referenceCount = references;

-- h-index, computed without an application-side loop
MATCH (author:Author)
OPTIONAL MATCH (author)-[:AUTHORED]->(paper:Paper)
WITH author, paper ORDER BY paper.citationCount DESC
WITH author, collect(coalesce(paper.citationCount, 0)) AS citations
WITH author, [i IN range(0, size(citations) - 1)
              WHERE citations[i] >= i + 1 | i + 1] AS qualifying
SET author.hIndex = CASE WHEN size(qualifying) = 0 THEN 0
                         ELSE qualifying[size(qualifying) - 1] END;

-- COLLABORATED_WITH, derived from AUTHORED. Stored once in canonical order
-- (a.id < b.id) and matched without an arrow, which halves the edge count.
MATCH (a:Author)-[:AUTHORED]->(paper:Paper)<-[:AUTHORED]-(b:Author)
WHERE a.id < b.id
WITH a, b, count(paper) AS shared, min(paper.year) AS first, max(paper.year) AS last
MERGE (a)-[rel:COLLABORATED_WITH]->(b)
SET rel.paperCount = shared, rel.firstYear = first, rel.lastYear = last;
```

**Why materialise `COLLABORATED_WITH`.** Expressed through papers, a 3-hop
collaboration query is *six* hops. This is the one deliberate denormalisation in
the model, and the bar for adding another is high: measurable savings on a hot
path, plus a deterministic recomputation step.

---

## Driver usage

Every query executes through the official Neo4j driver with parameters bound by
the driver — never interpolated into the statement.

### The rule, enforced by the compiler

```ts
/**
 * A Cypher statement the query runner is willing to execute.
 *
 * The brand enforces the project's hard rule: no query text may ever be built
 * by concatenation. Because runRead/runWrite accept only CypherStatement, a
 * plain string - and therefore anything assembled from user input - is rejected
 * by the compiler.
 */
export type CypherStatement = string & { readonly __cypher: unique symbol };

export function cypher(strings: TemplateStringsArray, ...values: unknown[]): CypherStatement {
  if (values.length > 0) {
    throw new Error(
      'Cypher templates must not interpolate values. Pass them as query parameters instead.',
    );
  }
  return (strings.raw[0] ?? '').trim() as CypherStatement;
}
```

```ts
// Declaration — the only way a statement can come into existence.
export const FIND_EXPERTS_FOR_TOPIC = cypher`
  MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(paper:Paper)<-[:AUTHORED]-(author:Author)
  ...
`;
```

Interpolation fails twice — at compile time (the tag returns a branded type only
for a literal template) and at runtime (the guard throws). Injection is
structurally impossible, not merely avoided by convention.

### Execution

```ts
export async function runRead<T>(
  statement: CypherStatement,
  parameters: QueryParameters,
  mapper: (record: Neo4jRecord) => T,
): Promise<T[]> {
  assertDatabaseAvailable();                    // fail fast, don't wait for a socket timeout
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });

  try {
    // executeRead brings automatic retries on transient failures (leader switch,
    // dropped connection) - the main reason every read goes through here rather
    // than calling session.run directly.
    const result = await session.executeRead((tx) =>
      tx.run(statement, toDriverParameters(parameters)),
    );
    return result.records.map(mapper);
  } catch (error) {
    throw translateDatabaseError(error, statement);
  } finally {
    await session.close();
  }
}
```

### Bolt integer promotion

Bolt distinguishes 64-bit integers from doubles; JavaScript has one `number`.
Clauses such as `SKIP` and `LIMIT` **reject floats**, so integer-valued
parameters are promoted before they leave the process:

```ts
function convertParameter(value: unknown): unknown {
  if (typeof value === 'number') {
    // Integer-valued → Bolt integer. Non-integral stays a float, which is what
    // comparisons like `impactFactor >= $min` need.
    return Number.isInteger(value) && Number.isSafeInteger(value) ? neo4j.int(value) : value;
  }
  if (Array.isArray(value)) return value.map(convertParameter);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype) {
    return toDriverParameters(value as QueryParameters);
  }
  return value;
}
```

Skipping this step is the most common cause of a `SKIP`/`LIMIT` type error that
appears only in production, where offsets are non-zero.

### Calling a query

```ts
export async function findExperts(
  topicId: string,
  minPapers: number,
  pagination: Pagination,
): Promise<ExpertSummary[]> {
  return runRead(
    FIND_EXPERTS_FOR_TOPIC,
    {
      topicId,
      minPapers,
      // Scoring weights are parameters, not literals: tuning them neither edits
      // a query nor invalidates its cached plan.
      paperWeight: EXPERTISE_WEIGHTS.paper,
      citationWeight: EXPERTISE_WEIGHTS.citation,
      focusWeight: EXPERTISE_WEIGHTS.focus,
      hIndexWeight: EXPERTISE_WEIGHTS.hIndex,
      ...pagination,
    },
    (record) => mapExpertSummary(column(record, 'expert')),
  );
}
```

### Production safeguards

| Concern | Mechanism |
|---|---|
| Injection | Branded `CypherStatement`; interpolation rejected at compile and run time |
| Unbounded traversal | Literal `*1..n` maximum + `$maxDepth` + `$limit`; enforced by a unit test over every statement |
| Oversized pages | `$limit` clamped server-side to `MAX_PAGE_SIZE` before it reaches a service |
| Invalid sort keys | Zod enum → `CASE $sort WHEN …`; an unknown key is a 422 |
| Plan-cache churn | `($param IS NULL OR …)` — one statement per endpoint regardless of filters |
| Transient failures | `session.executeRead` retries automatically |
| Database outage | Fail fast with 503 `DATABASE_UNAVAILABLE`; background probe reconnects |
| Slow queries | Logged above a threshold with duration, row count and first line |

---

## Implementation notes

### Verification status

| Layer | Status |
|---|---|
| Static invariants across all statements | ✅ 241 automated assertions |
| Envelope, error codes, validation | ✅ 12 integration tests |
| Semantic correctness against a live engine | ⏸ 15 tests, skipped locally — no Bolt endpoint available here |

The static suite iterates **every** exported query and asserts: no interpolation,
well-formed parameter names, balanced delimiters, no unbounded traversals, no
hard-coded page sizes. A new query that breaks a rule fails immediately.

The live suite runs in CI against a real engine — provisioned, seeded, and
exercised on every push. It cannot run in this environment (no Docker, no
reachable Bolt endpoint), so **the Cypher in this document is verified
structurally but not executed**. To verify it yourself:

```bash
docker compose up -d cognodb
npm run db:schema && npm run db:seed
npm test --workspace server
```

### Relationship to the shipped code

Queries 1–4, 6, 7 and analytics A1–A16 map directly onto
[`server/src/cypher/`](../server/src/cypher/), with minor naming differences.

**Query 5 differs meaningfully.** This catalogue specifies hidden-collaborator
detection via the **keyword** layer with `RELATED_TO` expansion. The shipped
implementation uses the **topic** layer and has no keyword-level `RELATED_TO`
network. Both find hidden collaborators; the keyword version is finer-grained and
catches pairs the topic version misses.

Adopting it requires:
1. A keyword co-occurrence pass at seed time to build `(:Keyword)-[:RELATED_TO]->(:Keyword)`
2. Swapping the topic traversal for the keyword traversal in
   `FIND_HIDDEN_COLLABORATORS`

That is genuinely new work, not a rename — flagged rather than glossed over.

Other deltas are mechanical: `Project` → `ResearchProject`, and `FUNDS`/
`INCLUDES` are stored reversed as `FUNDED_BY`/`PART_OF_PROJECT`.

### Related documents

| Document | Contents |
|---|---|
| [`graph-design.md`](graph-design.md) | Full schema spec, user journeys, visual model |
| [`graph-model.md`](graph-model.md) | As-built model reference |
| [`graph-queries.md`](graph-queries.md) | The ten core queries, explained line by line |
| [`architecture.md`](architecture.md) | Layer boundaries, resilience, rendering |
| [`api.md`](api.md) | Every endpoint, parameter and payload |
