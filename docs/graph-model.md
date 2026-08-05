# Graph Data Model

The complete specification of the Research Nexus property graph: every label,
every relationship type, the properties each carries, and the reasoning behind
the modelling decisions.

---

## Node labels

Ten labels. Each node is identified by a stable business key in `id`
(`author-0042`, `paper-0311`) that is unique, indexed, and safe to put in a URL.

Every searchable label additionally carries `searchText`: a lowercased
concatenation of its human-readable fields, written at seed time and backed by a
range index. That single property is what lets global search be a plain
`CONTAINS` predicate rather than a vendor-specific full-text call.

### `Author`

| Property            | Type    | Notes                                            |
| ------------------- | ------- | ------------------------------------------------ |
| `id`                | string  | Unique. `author-NNNN`.                           |
| `name`              | string  | Unique across the dataset.                       |
| `title`             | string  | Academic rank, e.g. `Associate Professor`.       |
| `email`             | string  | Domain matches the primary affiliation.          |
| `orcid`             | string  | Unique.                                          |
| `primaryField`      | string  | Field the author mostly publishes in.            |
| `careerStartYear`   | integer | Derived from seniority; bounds authorship edges. |
| `researchStatement` | string  | Prose summary shown on the profile.              |
| `hIndex`            | integer | **Derived** — computed from the citation graph.  |
| `citationCount`     | integer | **Derived** — sum over authored papers.          |
| `paperCount`        | integer | **Derived** — count of `AUTHORED` edges.         |

### `Paper`

| Property         | Type    | Notes                                       |
| ---------------- | ------- | ------------------------------------------- |
| `id`             | string  | Unique. `paper-NNNN`.                       |
| `title`          | string  |                                             |
| `abstract`       | string  | Four sentences: problem, method, result, implication. |
| `year`           | integer | Never precedes the anchor topic's emergence year. |
| `doi`            | string  | Unique.                                     |
| `url`            | string  |                                             |
| `citationCount`  | integer | **Derived** — incoming `CITES` edges.       |
| `referenceCount` | integer | **Derived** — outgoing `CITES` edges.       |

### `University`

`id`, `name`, `country`, `city`, `type` (Public Research / Private Research /
Technical Institute / National Laboratory), `foundedYear`, `ranking`, `website`,
and the derived `researcherCount`.

### `ResearchTopic`

`id`, `name`, `field`, `description`, `emergenceYear`, and the derived
`paperCount`. `emergenceYear` is what makes trend analysis meaningful — newer
topics accelerate while established ones plateau.

### `Keyword`

`id`, `term` (unique), and the derived `paperCount`. Keywords are deliberately
finer-grained than topics: they are the signal the similarity query uses when
two papers share no topic but clearly address the same problem.

### `Conference`

`id`, `name`, `acronym`, `field`, `tier` (`A*`, `A`, `B`), `foundedYear`,
`location`, `website`, derived `paperCount`.

### `Journal`

`id`, `name`, `publisher`, `issn`, `field`, `impactFactor`, `website`, derived
`paperCount`.

### `Dataset`

`id`, `name`, `domain`, `license`, `sizeGb`, `releaseYear`, `url`, derived
`paperCount`.

### `FundingAgency`

`id`, `name`, `country`, `type` (Government / Supranational / Private Foundation
/ Industry Consortium), `annualBudgetUsd`, `website`.

### `ResearchProject`

`id`, `title`, `summary`, `status` (Active / Completed / Planned), `startYear`,
`endYear`, `budgetUsd`.

---

## Relationship types

Thirteen types. Properties on relationships are used wherever a fact belongs to
the *connection* rather than to either endpoint — the position of an author on a
paper, the amount of a specific grant, the year a partnership began.

| Type               | Pattern                                                   | Properties                                   |
| ------------------ | --------------------------------------------------------- | -------------------------------------------- |
| `AUTHORED`         | `(Author)→(Paper)`                                        | `position`, `isCorresponding`                |
| `CITES`            | `(Paper)→(Paper)`                                         | `year`                                       |
| `AFFILIATED_WITH`  | `(Author)→(University)`                                   | `since`, `role`, `isPrimary`                 |
| `HAS_TOPIC`        | `(Paper\|Conference\|Journal\|Dataset\|ResearchProject)→(ResearchTopic)` | `relevance`                    |
| `HAS_KEYWORD`      | `(Paper)→(Keyword)`                                       | —                                            |
| `PUBLISHED_IN`     | `(Paper)→(Journal)`                                       | `year`, `volume`, `issue`                    |
| `PRESENTED_AT`     | `(Paper)→(Conference)`                                    | `year`, `track`                              |
| `USES_DATASET`     | `(Paper)→(Dataset)`                                       | `usageType`                                  |
| `FUNDED_BY`        | `(ResearchProject)→(FundingAgency)`                       | `amountUsd`, `grantNumber`, `startYear`      |
| `COLLABORATED_WITH`| `(Author)→(Author)`                                       | `paperCount`, `firstYear`, `lastYear`        |
| `RELATED_TO`       | `(ResearchTopic)→(ResearchTopic)`                         | `strength`                                   |
| `PART_OF_PROJECT`  | `(Paper\|Author)→(ResearchProject)`                       | `role` (author edges only)                   |
| `PARTNERS_WITH`    | `(University)→(University)`                               | `since`, `focus`                             |

### Direction and undirected semantics

`COLLABORATED_WITH` and `PARTNERS_WITH` are conceptually undirected. They are
stored **once**, in a canonical direction (lower `id` → higher `id`), and matched
without an arrow:

```cypher
MATCH (a:Author)-[:COLLABORATED_WITH]-(peer:Author)
```

Storing one edge instead of two halves the edge count for these types and removes
any possibility of the two directions disagreeing about `paperCount`.

### Derived relationships

`COLLABORATED_WITH` is not invented by the generator. It is computed from
`AUTHORED` after the graph is loaded:

```cypher
MATCH (a:Author)-[:AUTHORED]->(paper:Paper)<-[:AUTHORED]-(b:Author)
WHERE a.id < b.id
WITH a, b, count(paper) AS sharedPapers,
     min(paper.year) AS firstYear, max(paper.year) AS lastYear
MERGE (a)-[rel:COLLABORATED_WITH]->(b)
SET rel.paperCount = sharedPapers,
    rel.firstYear = firstYear,
    rel.lastYear = lastYear
```

This is a deliberate denormalisation. The relationship is fully derivable from
`AUTHORED`, but materialising it turns the most common traversal in the product —
"who has this person worked with, and who have *they* worked with" — from a
four-hop pattern into a one-hop pattern. Multi-hop collaboration queries are
roughly an order of magnitude cheaper as a result.

---

## Why these entities, and why these edges

**Authors and papers are separate nodes, not a denormalised document.** The whole
point of the model is that a paper connects several authors, and an author
connects several papers. That many-to-many relationship is the object of study,
not an implementation detail to be flattened away.

**Topics are nodes, not tags on a paper.** Because a topic is a node, it can
carry its own properties (`emergenceYear`, `field`), participate in `RELATED_TO`
edges, and be the anchor of an expert-discovery traversal. A string tag column
could do none of those things.

**Projects sit between authors and funders.** There is no direct edge from a
researcher to a funding agency, and there should not be: funding flows to a
project, and people work on projects. The indirection is what makes "which
agencies support the topics this person works on" a real question with a real
answer — a four-hop traversal through `PART_OF_PROJECT` and `FUNDED_BY`.

**Universities partner directly.** `PARTNERS_WITH` records formal institutional
agreements. Informal institutional connection — two universities whose people
co-author constantly — is *not* stored; it is discovered, by traversing
affiliations and authorship. Both kinds of connection are useful, and the model
keeps them distinct.

---

## Constraints and indexes

Applied by `npm run db:schema` from the files in [`database/schema/`](../database/schema/).

### Uniqueness constraints

Every label has `id IS UNIQUE`. Three natural keys are additionally constrained:
`Keyword.term`, `Paper.doi`, `Author.orcid`.

Constraints serve two purposes here. They make the seed idempotent — re-running
it `MERGE`s onto the same nodes rather than duplicating them — and, because every
uniqueness constraint is index-backed, they turn every `MATCH (n:Label {id: $id})`
in the API into a single index seek rather than a label scan.

### Secondary indexes

| Purpose            | Indexed properties                                                            |
| ------------------ | ----------------------------------------------------------------------------- |
| Global search      | `searchText` on all ten labels                                                |
| Ranking            | `Author.hIndex`, `Author.citationCount`, `Paper.citationCount`, `University.ranking`, `Journal.impactFactor`, `ResearchTopic.paperCount` |
| Range filtering    | `Paper.year`, `ResearchProject.startYear`, `ResearchTopic.field`, `University.country`, `Conference.tier`, `FundingAgency.country` |
| Compound filtering | `Paper(year, citationCount)`, `ResearchTopic(field, paperCount)`               |

A native full-text index is available as an optional accelerator in
[`03-fulltext-optional.cypher`](../database/schema/03-fulltext-optional.cypher).
The application never requires it: search works identically without it, which is
what keeps the project portable across OpenCypher engines.

---

## Dataset shape

`npm run db:seed` generates 1,420 nodes and roughly 14,000 relationships, plus
around 2,500 `COLLABORATED_WITH` edges derived at load time.

| Label             | Count |
| ----------------- | ----: |
| `Author`          |   300 |
| `Paper`           |   600 |
| `University`      |    50 |
| `ResearchTopic`   |   100 |
| `Keyword`         |   150 |
| `Conference`      |    40 |
| `Journal`         |    30 |
| `Dataset`         |    40 |
| `FundingAgency`   |    30 |
| `ResearchProject` |    80 |

The generator reproduces three properties of real research data on purpose,
because without them the interesting queries return uniform noise:

1. **Power-law citations.** Papers enter a ticket pool on publication and gain a
   ticket each time they are cited; references are drawn uniformly from that pool.
   This is Barabási–Albert preferential attachment, and it produces the long tail
   that makes ranking and hub detection meaningful. The seeded graph's most-cited
   paper has over 200 citations while the median has a handful.

2. **Community structure.** Co-authors are sampled preferentially from the lead
   author's institution, their field, and — with the highest probability — their
   past collaborators. The result is genuine research groups, which is why
   multi-hop collaboration queries return clusters rather than random people.

3. **Temporal consistency.** A paper never predates its topic's emergence year and
   never cites a dataset released after it. Authors' career start years bound
   which papers they can appear on.

The seed is deterministic: the same `SEED_RANDOM_SEED` always produces the same
graph, so demos, screenshots and integration tests all describe the same data.
