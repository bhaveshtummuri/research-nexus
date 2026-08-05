# API Documentation

Base URL: `{host}/api/v1` — configurable via `API_PREFIX`.

All endpoints are `GET`. The API is read-only: the graph is populated by the seed
CLI, not over HTTP.

---

## Response envelope

Every successful response shares one shape, so the client needs a single unwrap
helper rather than per-endpoint parsing.

```jsonc
{
  "success": true,
  "data": { /* … or [ … ] for list endpoints */ },
  "meta": {
    "offset": 0,
    "limit": 20,
    "count": 20,
    "total": 300,
    "hasMore": true
  }
}
```

Failures use a parallel shape:

```jsonc
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request query.",
    "details": [{ "path": "limit", "message": "Number must be less than or equal to 100" }]
  },
  "requestId": "0f2c1a9e-…"
}
```

### Error codes

The client switches on `code`, never on message text, so copy changes never break
error handling.

| Code                   | Status | Meaning                                                     |
| ---------------------- | -----: | ----------------------------------------------------------- |
| `BAD_REQUEST`          |    400 | Malformed request                                            |
| `VALIDATION_ERROR`     |    422 | A parameter failed schema validation; see `details`          |
| `NOT_FOUND`            |    404 | No such entity or route                                      |
| `RATE_LIMITED`         |    429 | Fixed-window limit exceeded; see `Retry-After`               |
| `DATABASE_UNAVAILABLE` |    503 | CognoDB is unreachable — retrying later is worthwhile        |
| `QUERY_TIMEOUT`        |    504 | The traversal exceeded its time budget                       |
| `DATABASE_ERROR`       |    500 | The engine rejected the query (a server bug)                 |
| `INTERNAL_ERROR`       |    500 | Unexpected failure                                           |

### Common parameters

| Parameter | Type    | Default | Notes                                          |
| --------- | ------- | ------: | ---------------------------------------------- |
| `offset`  | integer |     `0` | Zero-based row offset                          |
| `limit`   | integer |    `20` | Clamped server-side to `MAX_PAGE_SIZE` (100)   |
| `search`  | string  |       — | Substring match against the indexed `searchText` |

Every numeric parameter is clamped server-side. A `limit=100000` is rejected with
422 rather than silently turning a bounded traversal into a scan.

---

## Health

| Endpoint                  | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `GET /health`             | Liveness. Never touches the database, so a database outage cannot trigger a restart loop. |
| `GET /health/ready`       | Readiness. Verifies the driver is active, connectivity holds, and a probe query actually executes; returns **503** with a `DATABASE_UNAVAILABLE` error envelope when degraded. |
| `GET /health/database`    | Cached connection status without issuing a fresh probe. Credentials are redacted from the reported URI. |

A non-2xx response always carries `error`, never `data` — the readiness probe
is no exception, so one client parser handles every endpoint.

```bash
curl http://localhost:4000/api/v1/health/ready
```

```jsonc
// 200 — ready
{
  "success": true,
  "data": {
    "status": "ready",
    "database": {
      "state": "connected",
      "uri": "bolt://localhost:7687",
      "database": null,
      "serverVersion": "Bolt 5.4",
      "lastCheckedAt": "2024-08-05T09:14:22.117Z",
      "lastError": null
    },
    "checks": {
      "driverActive": true,
      "connectivity": true,
      "queryExecution": true,
      "queryLatencyMs": 3
    },
    "environment": {
      "nodeEnv": "production",
      "apiPrefix": "/api/v1",
      "nodeVersion": "v20.11.0",
      "maxPageSize": 100,
      "maxGraphNodes": 400,
      "corsOrigins": 2
    },
    "uptimeSeconds": 412
  }
}

// 503 — degraded
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "The API is running but CognoDB is not reachable, so data endpoints are unavailable.",
    "details": [
      { "path": "database.state", "message": "unavailable" },
      { "path": "database.uri", "message": "bolt://localhost:7687" },
      { "path": "database.lastError", "message": "Failed to connect to server." }
    ]
  },
  "requestId": "0f2c1a9e-…"
}
```

---

## Authors

### `GET /authors`

| Parameter   | Type   | Notes                                        |
| ----------- | ------ | -------------------------------------------- |
| `search`    | string |                                              |
| `minHIndex` | int    |                                              |
| `sort`      | enum   | `hIndex` (default), `citations`, `papers`    |

### `GET /authors/:id`

Full profile: affiliation, research focus with per-topic paper counts, recent
publications, frequent collaborators with shared-paper counts, projects and
venues — assembled in **one** request. The relational equivalent is six joins
across five tables.

### `GET /authors/:id/papers`

Publications, newest first. Accepts `offset` and `limit`.

### `GET /authors/:id/collaborators`

Researchers reachable within `depth` collaboration hops, nearest first.

| Parameter | Type | Default | Notes                    |
| --------- | ---- | ------: | ------------------------ |
| `depth`   | int  |     `2` | Clamped to 4             |

Each result carries `distance` — the true minimum hop count — plus the overlap
that explains the connection: `sharedPapers` (work actually co-authored),
`sharedTopics`, `sharedKeywords`, `sharedCollaborators`, and a `reasons[]`
breakdown of the weighted `score`.

Results are ordered `distance ASC, score DESC`: distance leads so the page order
matches the pagination key, and score ranks within a distance band, where hop
count alone cannot separate two peers.

```jsonc
{
  "id": "author-0044",
  "name": "Liang Chen",
  "distance": 1,
  "score": 21.5,
  "sharedPapers": [{ "id": "paper-0112", "title": "Sparse Routing", "year": 2019 }],
  "sharedTopics": [{ "id": "topic-0007", "name": "Graph Neural Networks", "field": "AI" }],
  "sharedKeywords": [{ "id": "keyword-0102", "term": "transformer" }],
  "sharedCollaborators": [{ "id": "author-0088", "name": "Nadia Haddad" }],
  "reasons": [
    { "kind": "shared-collaborator", "label": "Reachable in 1 collaboration hop(s)", "weight": 5 },
    { "kind": "shared-paper", "label": "1 co-authored paper(s)", "weight": 4 }
  ]
}
```

### `GET /authors/:id/hidden-collaborators`

People exactly two hops away who work on the same problems but have **never**
co-authored — so `sharedPapers` is always empty here, by definition.

| Parameter           | Type | Default | Notes                              |
| ------------------- | ---- | ------: | ---------------------------------- |
| `minSharedTopics`   | int  |     `1` | 0–20                               |
| `minSharedKeywords` | int  |     `2` | 0–50                               |

A candidate qualifies on **either** threshold, not both: two researchers sharing
a dozen keywords but no formally recorded topic are exactly the pairing this
endpoint exists to surface, and an `AND` would discard them. Each result carries
`sharedTopics`, `sharedKeywords`, `sharedCollaborators` (the mutual contacts who
could make the introduction), and a `reasons[]` breakdown of the score.

| Parameter         | Type | Default |
| ----------------- | ---- | ------: |
| `minSharedTopics` | int  |     `1` |

### `GET /authors/:id/recommendations`

Papers this author has not written, ranked by topic overlap, work by their
collaborators, and shared references.

---

## Papers

### `GET /papers`

| Parameter      | Type | Notes                                       |
| -------------- | ---- | ------------------------------------------- |
| `search`       | str  | Matches title, abstract, topic and keywords |
| `fromYear`     | int  |                                             |
| `toYear`       | int  |                                             |
| `minCitations` | int  |                                             |
| `sort`         | enum | `citations` (default), `year`, `references` |

### `GET /papers/:id`

Full record including abstract, keywords, datasets, project, and both citation
directions (`citedBy`, `references`).

### `GET /papers/:id/similar`

Similarity blended from four graph signals. Every result carries the individual
contributions:

```jsonc
{
  "id": "paper-0231",
  "title": "Hierarchical Models for Graph Neural Networks",
  "score": 14.5,
  "reasons": [
    { "kind": "shared-topic",    "label": "3 shared topic(s)",      "weight": 9 },
    { "kind": "co-citation",     "label": "Co-cited by 2 paper(s)", "weight": 5 },
    { "kind": "shared-keyword",  "label": "2 shared keyword(s)",    "weight": 3 }
  ]
}
```

`meta.weights` echoes the scoring configuration that produced the ranking.

### `GET /papers/:id/citation-chains`

| Parameter   | Type | Default     | Notes                                     |
| ----------- | ---- | ----------- | ----------------------------------------- |
| `direction` | enum | `forward`   | `forward` = ancestry, `backward` = influence |
| `depth`     | int  | `3`         | 1–5                                       |
| `limit`     | int  | `10`        |                                           |

---

### `GET /papers/:id/citation-tree`

The citation tree rooted at a paper, flattened for rendering.

| Parameter   | Type | Default   | Notes                                    |
| ----------- | ---- | --------: | ---------------------------------------- |
| `direction` | enum | `forward` | `forward` = what it cites, `backward` = what cites it |
| `depth`     | int  |       `3` | 1–4                                      |
| `limit`     | int  |      `50` | 1–200                                    |

Each row carries `depth` and the `parentId` it hangs from; the client rebuilds
the hierarchy in one pass. Every paper appears exactly once, attached at its
shallowest point. `meta.roots` lists the direct children of the requested paper.

```jsonc
{
  "success": true,
  "data": [
    { "id": "paper-0301", "title": "Attention Revisited", "year": 2021,
      "citationCount": 812, "depth": 1, "parentId": "paper-0042" },
    { "id": "paper-0455", "title": "Sparse Routing", "year": 2019,
      "citationCount": 240, "depth": 2, "parentId": "paper-0301" }
  ],
  "meta": { "count": 2, "rootId": "paper-0042", "direction": "forward",
            "maxDepth": 2, "roots": ["paper-0301"] }
}
```

### `GET /papers/:id/influential-citations`

Citation lineages ranked by citations accumulated along the route, rather than by
length — "which line of descent mattered most" rather than "how is this
connected". Returns the standard path envelope with an added `influence`.

| Parameter | Type | Default | Notes |
| --------- | ---- | ------: | ----- |
| `depth`   | int  |     `4` | 1–5   |
| `limit`   | int  |     `5` | 1–20  |

---

## Universities

| Endpoint                        | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `GET /universities`             | `search`, `country`, `sort` = `ranking` \| `researchers` \| `name` |
| `GET /universities/:id`         | Researchers, research strengths, partners, traversal-computed output |
| `GET /universities/:id/similar` | Jaccard topic-profile overlap. `minSharedTopics`, `limit`      |

---

## Topics

| Endpoint                   | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `GET /topics`              | `search`, `field`, `sort` = `papers` \| `recent`                 |
| `GET /topics/fields`       | Distinct fields with topic and paper counts — populates filters   |
| `GET /topics/trending`     | `windowYears` (default 3), `minRecentPapers`, `limit`            |
| `GET /topics/:id`          | Detail, related topics, experts, institutions, yearly output      |
| `GET /topics/:id/experts`  | Expert ranking. `minPapers`, `offset`, `limit`                   |
| `GET /topics/:id/related`  | Direct and inferred related topics, labelled by `connectionKind` |
| `GET /topics/:id/similar`  | Similarity by shared keyword vocabulary. `minSharedKeywords` (default 2), `limit` |

`/topics/trending` compares a recent window against the one immediately before
it and returns `recentPaperCount`, `priorPaperCount`, `growthRate` and `momentum`.

`/topics/:id/experts` ranks by a blend of output, impact and focus, and returns
`collaboratorCount` and the expert's `activeProjects` alongside the score.

**`/topics/:id/related` vs `/topics/:id/similar`.** `related` requires the two
topics to co-occur on the same paper. `similar` walks
`Topic→Paper→Keyword→Paper→Topic`, so it reaches topics that share no publication
at all but draw on the same vocabulary — two communities working the same problem
without citing each other. Its `similarity` is a Jaccard ratio over keyword sets,
so a broad topic that overlaps with everything cannot dominate.

```jsonc
// GET /topics/topic-0007/similar?limit=3&minSharedKeywords=2
{
  "success": true,
  "data": [
    {
      "id": "topic-0031",
      "name": "Protein Structure Prediction",
      "field": "Computational Biology",
      "similarity": 0.2143,
      "sharedKeywordCount": 6,
      "sharedKeywords": [{ "id": "keyword-0102", "term": "transformer" }],
      "commonPapers": [{ "id": "paper-0455", "title": "Folding at Scale", "year": 2022 }],
      "relatedResearchers": [{ "id": "author-0088", "name": "Nadia Haddad", "paperCount": 14 }]
    }
  ],
  "meta": { "count": 1, "metric": "jaccard-keyword-overlap", "minSharedKeywords": 2 }
}
```

---

## Venues

| Endpoint               | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `GET /conferences`     | `search`, `field`, `tier` (`A*` \| `A` \| `B`), `sort`      |
| `GET /conferences/:id` | Topics, top papers, regular contributors, papers per year   |
| `GET /journals`        | `search`, `field`, `minImpactFactor`, `sort`                |
| `GET /journals/:id`    | Topics, top papers, frequent authors                        |

---

## Funding, projects and datasets

| Endpoint                            | Description                                                    |
| ----------------------------------- | -------------------------------------------------------------- |
| `GET /funding/agencies`             | `search`, `country`, `type`, `sort` = `awarded` \| `budget` \| `projects` |
| `GET /funding/agencies/:id`         | Grants with award amounts and grant numbers, topics reached, overlapping funders |
| `GET /funding/agencies/:id/similar` | Funders backing the same topics                                |
| `GET /funding/projects`             | `search`, `status`, `sort` = `budget` \| `start`                |
| `GET /datasets`                     | `search`, `domain`, `sort` = `papers` \| `size` \| `recent`     |
| `GET /keywords`                     | `search`, ordered by usage                                      |
| `GET /keywords/:id/papers`          | Papers carrying a keyword                                       |

---

## Graph

### `GET /graph` · `GET /graph/sample`

The explorer's opening view: the most connected authors, papers, topics and
institutions, plus every relationship among them. `GET /graph` is the short form
of the same endpoint.

| Parameter | Type | Default | Notes                          |
| --------- | ---- | ------: | ------------------------------ |
| `limit`   | int  |    `80` | Clamped to `MAX_GRAPH_NODES`   |

### `GET /graph/author/:id` · `GET /graph/paper/:id`

Neighbourhood expansion anchored on one entity, taking the id from the path
rather than the query string. The traversal is identical for both — the label
only shapes what comes back — so both accept `depth` (1–3), `limit` and `types`,
exactly as `GET /graph/expand` does.

```bash
curl "$API/graph/author/author-0117?depth=2&limit=60&types=AUTHORED,COLLABORATED_WITH"
```

### `GET /graph/expand`

| Parameter | Type   | Default | Notes                                            |
| --------- | ------ | ------: | ------------------------------------------------ |
| `id`      | string |       — | **Required.** Any entity id                      |
| `depth`   | int    |     `1` | 1–3                                              |
| `limit`   | int    |    `80` | Node budget                                      |
| `types`   | csv    |       — | Restrict to these relationship types             |

Unknown relationship types in `types` are dropped rather than rejected.

### `GET /graph/subgraph`

`ids` — comma-separated entity ids. Returns those nodes and every relationship
between them.

### `GET /graph/shortest-path`

| Parameter  | Type   | Default         | Notes                                        |
| ---------- | ------ | --------------- | -------------------------------------------- |
| `from`     | string | —               | **Required**                                 |
| `to`       | string | —               | **Required**                                 |
| `mode`     | enum   | `collaboration` | `collaboration` \| `citation` \| `any`       |
| `maxDepth` | int    | `6`             | 1–8                                          |
| `all`      | bool   | `false`         | Return every equally short route             |

`mode` selects which edges the traversal may use: `collaboration` walks
`COLLABORATED_WITH` between authors, `citation` walks `CITES` between papers, and
`any` leaves the type unconstrained — which is how two researchers who never
co-authored turn out to be two hops apart through a shared dataset or funder.

Returns the ordered path *and* a renderable subgraph, so the visualiser needs no
second round trip:

```jsonc
{
  "success": true,
  "data": {
    "found": true,
    "paths": [
      {
        "length": 2,
        "nodes": [ /* … */ ],
        "edges": [ /* … */ ],
        "narrative": "Ada Okafor → Liang Chen → Nadia Haddad"
      }
    ],
    "graph": { "nodes": [], "edges": [], "stats": {} }
  },
  "meta": { "mode": "collaboration", "maxDepth": 6, "pathCount": 1 }
}
```

### `GET /graph/neighbourhood/:id`

Everything reachable within `depth` hops, grouped by distance.

| Parameter | Type | Default | Notes                        |
| --------- | ---- | ------: | ---------------------------- |
| `depth`   | int  |     `2` | Clamped to 4                 |
| `limit`   | int  |    `50` |                              |
| `labels`  | csv  |       — | Restrict to these node labels |

---

## Discovery

### `GET /discovery/cross-domain`

Field pairs that appear together on the same papers.

| Parameter   | Type | Default |
| ----------- | ---- | ------: |
| `minPapers` | int  |     `2` |
| `field`     | str  |       — |
| `limit`     | int  |    `15` |

---

## Recommendations

Flat, verb-first aliases for the recommendation handlers nested under their
resources. Same handler, same response — pick whichever shape suits the client.

| Endpoint                              | Equivalent to                        |
| ------------------------------------- | ------------------------------------ |
| `GET /recommendations/papers/:id`     | `GET /papers/:id/similar`            |
| `GET /recommendations/authors/:id`    | `GET /authors/:id/recommendations`   |

`limit` (default `10`, max 50) applies to both. Every result carries the
`reasons` array and the weights that produced its score in `meta`.

```bash
curl "$API/recommendations/papers/paper-0042?limit=5"
```

---

## Collaboration

### `GET /collaboration/researchers`

Researchers ranked by the *reach* of their collaboration network, across the
whole graph. `institutionCount` is what separates broad from busy: twenty
co-authors spread across ten universities outranks fifty down the same corridor.

| Parameter     | Type | Default | Notes                          |
| ------------- | ---- | ------: | ------------------------------ |
| `minPartners` | int  |     `2` | 1–500, floor on network degree |
| `field`       | str  |       — | Restrict to a primary field    |
| `limit`       | int  |       — | Bounded by `MAX_PAGE_SIZE`     |
| `offset`      | int  |       — |                                |

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "author-0117",
      "name": "Ada Okafor",
      "hIndex": 41,
      "citationCount": 8120,
      "affiliation": { "id": "university-0003", "name": "ETH Zürich", "country": "CH" },
      "partnerCount": 34,
      "institutionCount": 12,
      "jointPapers": 61,
      "score": 64.0,
      "topPartners": [{ "id": "author-0044", "name": "Liang Chen" }]
    }
  ],
  "meta": { "count": 1, "minPartners": 2, "weights": { "partner": 1, "institution": 2.5 } }
}
```

### Other collaboration routes

| Endpoint                              | Description                                          |
| ------------------------------------- | ---------------------------------------------------- |
| `GET /collaboration/researchers/:id`  | One researcher's neighbourhood — `depth` (default 2) |
| `GET /collaboration/hidden/:id`       | Second-degree peers who are not yet co-authors       |
| `GET /collaboration/path`             | Shortest route, `mode` defaults to `collaboration`   |
| `GET /collaboration/cross-domain`     | Same as `GET /discovery/cross-domain`                |

---

## Citations

### `GET /citations/path`

Shortest citation route between two papers. Takes the same parameters as
`GET /graph/shortest-path`, except `mode` defaults to **`citation`** — a citation
endpoint that quietly walked collaboration edges would answer a different
question. The traversal is left undirected: a lineage running forward two hops
and back one is still a real intellectual link.

```bash
curl "$API/citations/path?from=paper-0011&to=paper-0480&maxDepth=6"
```

Responds with the same `{ found, paths, graph }` envelope as
`GET /graph/shortest-path`; every edge in a returned path is `CITES`.

### `GET /citations/:paperId`

Citation lineages reaching out from one paper — identical to
`GET /papers/:id/citation-chains`.

| Parameter   | Type | Default   | Notes                                          |
| ----------- | ---- | --------: | ---------------------------------------------- |
| `direction` | enum | `forward` | `forward` = what it cites, `backward` = what cites it |
| `depth`     | int  |       `3` | 1–5                                            |
| `limit`     | int  |      `10` | 1–30                                           |

---

## Search

### `GET /search`

| Parameter  | Type | Default | Notes                       |
| ---------- | ---- | ------: | --------------------------- |
| `q`        | str  |       — | **Required**, min 2 chars   |
| `perLabel` | int  |     `5` | Results per node label      |

One round trip covers all ten labels. Results arrive grouped, each hit carrying a
ready-made client route:

```jsonc
{
  "query": "graph",
  "totalHits": 23,
  "groups": [
    {
      "label": "ResearchTopic",
      "hits": [
        {
          "id": "topic-0001",
          "label": "ResearchTopic",
          "title": "Graph Neural Networks",
          "subtitle": "Artificial Intelligence · 47 papers",
          "score": 2.38,
          "href": "/topics/topic-0001"
        }
      ]
    }
  ]
}
```

---

## Analytics

| Endpoint                          | Description                                                        |
| --------------------------------- | ------------------------------------------------------------------ |
| `GET /analytics/totals`           | Headline counters for the dashboard                                |
| `GET /analytics/overview`         | Node and relationship census with graph density                    |
| `GET /analytics/summary`          | Full payload — seven traversals issued concurrently. `fromYear`, `limit` |
| `GET /analytics/dashboard`        | Alias of `/analytics/summary`                                      |
| `GET /analytics/trending-topics`  | Alias of `/topics/trending`. `limit`, `windowYears`, `minRecentPapers` |
| `GET /analytics/popular-authors`  | Authors ranked by citation impact. `limit` (default `10`, max 50)  |
| `GET /analytics/most-cited-papers` | Papers ranked by incoming `CITES` edges. `limit`, `fromYear`       |
| `GET /analytics/connected-keywords` | Keywords ranked by co-occurrence degree. `limit`                 |
| `GET /analytics/funded-areas`     | Research fields ranked by grant money received. `limit`, `fromYear` |
| `GET /analytics/collaborative-institutions` | Institutions ranked by distinct partner institutions. `limit`, `country` |

`popular-authors` shares the exact ranking used inside `/analytics/summary`
rather than sorting the generic author list, so the leaderboard and the dashboard
can never disagree.

```jsonc
// GET /analytics/popular-authors?limit=5
{
  "success": true,
  "data": [
    {
      "id": "author-0117",
      "name": "Ada Okafor",
      "title": "Professor",
      "hIndex": 41,
      "citationCount": 8120,
      "paperCount": 96,
      "primaryField": "Artificial Intelligence",
      "affiliation": { "id": "university-0003", "name": "ETH Zürich", "country": "CH" }
    }
  ],
  "meta": { "count": 5, "ranking": "citations-then-h-index" }
}
```

Each of the four rankings above measures something a row store cannot reach
without a self-join per hop:

- **`most-cited-papers`** counts incoming `CITES` edges rather than reading the
  stored `citationCount`. Both values are returned as `inGraphCitations` and
  `citationCount`, so a drifting counter is visible rather than authoritative.
- **`connected-keywords`** ranks by how many *other* keywords a term co-occurs
  with. A term used on a thousand papers inside one niche is less connective than
  one spanning many vocabularies.
- **`funded-areas`** traces money three hops —
  `FundingAgency-[:FUNDS]->Project-[:HAS_TOPIC]->ResearchTopic` — and groups by
  the topic's field. No column anywhere holds "funding per field".
- **`collaborative-institutions`** counts distinct peer institutions reached
  through co-authorship, measuring openness rather than size.

Every figure is computed at request time. There is no warehouse, no materialised
view, and no nightly job behind any of these numbers.

---

## Rate limiting

Fixed-window, in-process, applied per client IP. Defaults to 300 requests per 60
seconds (`RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`).

Every response carries `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset`; a 429 additionally carries `Retry-After`.

This is deliberately not a distributed limiter — the API is read-only and
deployed as a single instance, so an in-memory counter protects the database
without adding Redis to the deployment.

## CORS

Browser origins are checked strictly against `CORS_ORIGINS`. Requests without an
`Origin` header — curl, server-to-server calls, platform health checks — are
permitted, because the API is public and read-only.
