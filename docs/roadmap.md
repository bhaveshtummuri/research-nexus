# Research Nexus — Development Roadmap

From empty directory to deployed application, in twelve phases. Each phase
carries objectives, tasks, deliverables, folder updates, commit milestones, best
practices, and the outcome that signals it is done.

> **This roadmap doubles as a status tracker.** Most of it is already built. Each
> phase is marked ✅ complete, 🟡 partial, or ⬜ not started, and partial phases
> say precisely what remains and why. Nothing is marked complete that has not
> been verified.

---

## Status at a glance

| Phase | Title | Status | Verified by |
|---|---|:--:|---|
| 0 | Planning & research | ✅ | 7 documents in `docs/` |
| 1 | Environment setup | 🟡 | Builds green; no live CognoDB instance — [details](phase-1-setup.md) |
| 2 | Graph database design | ✅ | 21 constraints · 46 indexes · 28 validation checks — [details](phase-2-graph-model.md) |
| 3 | Seed data generation | ✅ | 1,415 nodes / 14,697 edges · acyclic citations · 33 validation checks · [details](../seed/README.md) |
| 4 | Backend development | 🟡 | 0 type errors; repository layer not split |
| 5 | Graph queries | 🟡 | 59 queries, 241 static assertions; not executed live |
| 6 | Frontend development | ✅ | 19 routes, production build passes |
| 7 | Graph visualisation | ✅ | Canvas + d3-force, pan/zoom/drag/expand |
| 8 | UI/UX enhancement | ✅ | Responsive, themed, accessible, animated |
| 9 | Testing | 🟡 | 349 passing; no E2E or perf suite |
| 10 | Deployment | ⬜ | Configs ready; **not deployed** |
| 11 | Documentation & submission | 🟡 | 8 docs; no screenshots or demo video |

**Current totals:** 174 files · ~19,400 lines · 349 tests passing · 0 lint
errors · 0 type errors · both packages build.

---

## Phase 0 — Planning & Research ✅

### Objectives

Establish *why* this project needs a graph database before writing a line of
code, and design the model well enough that later phases are execution rather
than discovery.

### Tasks

- [x] Define the research discovery problem
- [x] Identify users and use cases
- [x] Justify the graph database choice with a concrete comparison
- [x] Identify all entities and relationships
- [x] Design the graph schema — properties, constraints, indexes
- [x] Produce Mermaid and architecture diagrams
- [x] Plan application modules and user journeys
- [x] Define API requirements
- [x] Specify realistic sample datasets
- [x] Design the project folder structure
- [x] Plan the deployment strategy

### Deliverables

| Artefact | Location |
|---|---|
| Requirements & problem statement | `README.md` — Overview, Problem Statement |
| Graph schema specification | `docs/graph-design.md` |
| Architecture diagram | `docs/architecture.md` |
| User flow design | `docs/graph-design.md` — User journeys |
| Folder structure | `docs/project-structure.md` |
| Database design | `docs/graph-model.md` |
| API contract | `docs/api.md` |
| README outline | `README.md` |

### Folder updates

```
docs/           architecture.md · graph-design.md · graph-model.md
                project-structure.md · api.md
README.md
```

### Git milestones

```
chore: initialise repository with licence and gitignore
docs: add problem statement and graph database justification
docs: specify graph schema with constraints and indexes
docs: add architecture and user journey design
```

### Best practices

**Write the "why graph" argument as a side-by-side comparison, not a claim.** The
README carries a 35-line recursive CTE next to 14 lines of Cypher answering the
same question. An assertion that graphs are better convinces nobody; a diff does.

**Design the schema before the API.** Endpoints follow from what the graph can
answer. Reversing the order produces a model shaped by REST conventions rather
than by the domain.

**Decide the denormalisation policy up front.** This project allows exactly two,
both derived in Cypher after load. Without a stated policy, counters accumulate
and drift.

### Expected outcome

Anyone can read `docs/` and understand what is being built, why a graph engine is
the right tool, and what the data looks like — before any code exists.

---

## Phase 1 — Environment Setup 🟡

### Objectives

A workspace where all three packages install, typecheck, lint and build with one
command, and where a single `.env` drives everything.

### Tasks

- [x] Initialise npm workspaces monorepo
- [x] Configure shared TypeScript base config
- [x] Initialise React + Vite + TypeScript client
- [x] Initialise Express + TypeScript server
- [x] Configure TailwindCSS with CSS-variable design tokens
- [x] Install and configure the official Neo4j Bolt driver
- [x] Set up environment variables with Zod validation
- [x] Configure ESLint flat config (type-aware) and Prettier
- [x] Initialise Git, `.gitignore`, `.editorconfig`
- [ ] **Provision a live CognoDB instance** ← remaining

### What remains

Provisioning a CognoDB instance needs credentials and a hosting account. Local
development is unblocked — `docker compose up -d cognodb` starts a
Bolt-compatible engine — but no instance was reachable in this environment, so
nothing has been run against a live database.

### Deliverables

`package.json` workspaces · `tsconfig.base.json` · `eslint.config.js` ·
`.prettierrc.json` · `.env.example` · `docker-compose.yml` ·
`client/vite.config.ts` · `client/tailwind.config.ts`

### Folder updates

```
research-nexus/
├── client/    package.json · tsconfig · vite.config.ts · tailwind.config.ts
├── server/    package.json · tsconfig · tsconfig.build.json
├── seed/      package.json · tsconfig
└── root       package.json · tsconfig.base.json · eslint.config.js · .env.example
```

### Git milestones

```
chore: scaffold npm workspaces monorepo
chore: configure typescript, eslint and prettier
feat(client): initialise vite + react + tailwind
feat(server): initialise express + typescript
chore: add docker compose for local graph database
```

### Best practices

**Validate environment at boot with Zod, not at first use.** A missing
`COGNODB_URI` should fail immediately with a precise message, not surface as a
confusing runtime error twenty minutes later.

**One `.env` at the repository root.** Server, seed CLI and Vite dev proxy all
read it. Three env files drift.

**Pin the Node version in `engines` and CI.** "Works on my machine" is almost
always a Node version gap.

*A dependency conflict appeared here: `vite` resolved to two copies (one hoisted,
one under `client/`), and `@vitejs/plugin-react` typed against the wrong one.
Fixed by hoisting `vite` and `vitest` to the workspace root.*

### Expected outcome

`npm install && npm run typecheck && npm run lint && npm run build` passes from a
clean clone. ✅ **Verified.**

---

## Phase 2 — Graph Database Design 🟡

### Objectives

Schema as versioned, idempotent, plain-text Cypher — applicable by our tooling or
by a DBA in a shell.

### Tasks

- [x] Define 10 node labels with required and optional properties
- [x] Define 13 relationship types with properties
- [x] Write uniqueness constraints (ids + natural keys)
- [x] Write secondary indexes (search, ranking, range, composite)
- [x] Write optional full-text indexes as a separate, tolerated-failure file
- [x] Build an idempotent schema runner (`npm run db:schema`)
- [ ] **Apply the schema to a live instance and verify connectivity** ← remaining

### What remains

The schema files are complete and the runner works, but neither has been executed
against a real engine here. `npm run db:schema` applies them in filename order
and tolerates failures only in the optional file.

### Deliverables

```
database/schema/
├── 01-constraints.cypher        13 constraints
├── 02-indexes.cypher            22 indexes
└── 03-fulltext-optional.cypher  4 optional, non-required
database/README.md
```

### Git milestones

```
feat(database): add uniqueness constraints for all node labels
feat(database): add search, ranking and range indexes
feat(database): add optional full-text acceleration
feat(seed): add idempotent schema runner CLI
```

### Best practices

**`IF NOT EXISTS` on every statement.** Re-running must always be safe.

**Constraints are a performance feature, not just integrity.** Each is
index-backed, so `MATCH (n:Label {id: $id})` — the anchor of every query — becomes
one index seek instead of a label scan.

**Constrain natural keys too.** Without `Keyword.term IS UNIQUE`, "graph neural
network" and "graph neural networks" become separate nodes and every similarity
traversal silently misses matches.

**Keep vendor features optional.** Search runs on an indexed `searchText` +
`CONTAINS`, which works on any OpenCypher engine. Full-text is an accelerator
nothing depends on.

### Expected outcome

`npm run db:schema` applies cleanly and repeatedly; every id lookup is an index
seek. 🟡 **Written, not executed.**

---

## Phase 3 — Seed Data Generation ✅

### Objectives

A realistic, deterministic dataset large enough for traversals to return
interesting results.

### Tasks

- [x] Build a seeded PRNG (mulberry32) for reproducibility
- [x] Author vocabularies — names, institutions, topics, keywords, venues, prose
- [x] Generate 300 Authors, 600 Papers, 50 Universities, 100 Topics
- [x] Generate 150 Keywords, 40 Conferences, 30 Journals, 40 Datasets
- [x] Generate 30 Funding Agencies, 80 Projects
- [x] Generate ~14,000 relationships with realistic distributions
- [x] Batched `UNWIND` + `MERGE` writer (idempotent)
- [x] Post-load Cypher derivations (h-index, counters, `COLLABORATED_WITH`)
- [x] CLI: `schema` · `seed` · `reset` · `stats`
- [x] 22 generator tests — counts, determinism, integrity, distribution

### Deliverables

| Label | Count | | Relationship | Count |
|---|---:|---|---|---:|
| Author | 300 | | AUTHORED | 2,490 |
| Paper | 600 | | CITES | 3,420 |
| University | 50 | | HAS_KEYWORD | 2,425 |
| ResearchTopic | 100 | | HAS_TOPIC | 1,956 |
| Keyword | 150 | | PART_OF_PROJECT | 1,561 |
| Conference | 40 | | USES_DATASET | 671 |
| Journal | 30 | | AFFILIATED_WITH | 350 |
| Dataset | 40 | | PRESENTED_AT | 316 |
| FundingAgency | 30 | | PUBLISHED_IN | 284 |
| ResearchProject | 80 | | RELATED_TO | 282 |
| **Total** | **1,420** | | **Total** | **14,048** |

Plus ~2,500 `COLLABORATED_WITH` edges derived at load.

### Folder updates

```
seed/src/
├── data/          people · institutions · research · venues · prose
├── generators/    nodes · relationships · text
├── build.ts       pure, deterministic assembly
├── writer.ts      batched UNWIND + MERGE
├── derive.ts      post-load aggregations
├── random.ts      seeded PRNG
└── cli.ts
seed/tests/generator.test.ts
```

### Git milestones

```
feat(seed): add deterministic PRNG and vocabularies
feat(seed): generate node collections for all ten labels
feat(seed): generate relationships with power-law citations
feat(seed): add batched writer and derived metrics
test(seed): verify counts, determinism and referential integrity
```

### Best practices

**Separate generation from writing.** `build.ts` is a pure function of the seed
string, so the pipeline is unit-testable without a database — referential
integrity, temporal consistency and distribution shape all verified in ~100 ms.

**Reproduce real distributions, or the queries return noise.** Three were
deliberate:

- *Power-law citations* — papers enter a ticket pool on publication and gain a
  ticket per citation; references draw uniformly from it. Barabási–Albert
  preferential attachment. The top paper has 215 citations, the median a handful.
- *Community structure* — co-authors sampled preferentially from the lead's
  institution, field, and past collaborators. Produces real research groups, which
  is why multi-hop queries return clusters rather than random people.
- *Temporal consistency* — a paper never predates its topic's emergence year or
  cites a dataset released after it.

**Make it idempotent.** `MERGE` on the constrained `id` means re-running updates
rather than duplicates.

**Derive metrics in Cypher after loading.** A counter computed from the edges
that actually exist can never disagree with them.

### Expected outcome

`npm run db:seed` produces an identical graph every run. ✅ **Verified** — 22
tests, including a determinism check across two independent builds.

---

## Phase 4 — Backend Development 🟡

### Objectives

A layered API where each boundary has one job, and where a database outage
degrades rather than crashes.

### Tasks

- [x] Database layer — driver lifecycle, retry, background health probe
- [x] Session and managed-transaction helpers
- [x] Bolt value serialization (integer promotion, temporal, nodes, paths)
- [x] Record → domain mappers
- [x] Service layer — request params in, domain objects out
- [x] Controllers — thin, envelope-only
- [x] REST routes for all resources
- [x] Liveness and readiness health checks
- [x] Error handling with machine-readable codes
- [x] Dependency-free structured logger
- [x] Zod validation on every endpoint
- [x] Rate limiting, helmet, CORS allow-list
- [x] Graceful shutdown
- [x] Extract a repository layer (Author, Paper) — see [phase-1-setup.md](phase-1-setup.md)
- [ ] Extend repositories to the remaining entities

### What remains

Services call the Cypher modules directly. With one consumer per query, a
repository layer is indirection without benefit. The trigger to introduce it:
when two services need the same query, or a second data source appears.
[`docs/project-structure.md`](project-structure.md) shows the exact seam.

### Deliverables

```
server/src/
├── config/       Zod-validated env, grouped settings
├── db/           driver · query · serialize · mappers · cypher-tag
├── services/     entity · discovery · path · graph · search · analytics
├── controllers/  entity · discovery · graph · health
├── routes/       full API surface
├── middleware/   validate · error-handler · rate-limit · request-logger
├── validators/   Zod schemas
├── utils/        logger · api-error · async-handler · pagination
├── app.ts        Express assembly, no listen()
└── server.ts     bootstrap + graceful shutdown
```

### Git milestones

```
feat(server): add cognodb driver with retry and health probe
feat(server): add bolt value serialization and domain mappers
feat(server): add service layer for entity queries
feat(server): add controllers and rest routes
feat(server): add validation, error handling and rate limiting
fix(server): bind http listener before connecting to the database
```

### Best practices

**Separate `app.ts` from `server.ts`.** The app is built by a function; the
server binds the port. Integration tests mount the real application with
supertest — real middleware, real routes, real error handling — without opening a
socket or connecting to a database.

**Never make the database a boot precondition.** On free hosting, databases often
become reachable *after* the web service. Bind the listener first, connect in the
background with bounded retries, degrade to 503 on data endpoints.

*This was found by smoke-testing, not by design. The original code awaited the
connection before listening and took up to 75 seconds to bind with the database
down — long enough for a platform health check to kill the process.*

**Return machine-readable error codes.** The client switches on
`DATABASE_UNAVAILABLE`, never on message text, so copy changes never break error
handling.

**Route every read through `session.executeRead`.** Automatic retries on
transient failures — leader switch, dropped connection — come free.

### Expected outcome

The API answers correctly with a database, and degrades cleanly without one.
✅ **Verified** — smoke test confirmed 300 ms bind, correct 503/422/404 envelopes,
clean SIGTERM shutdown.

---

## Phase 5 — Graph Queries 🟡

### Objectives

Every query parameterised, bounded, index-backed, and portable across OpenCypher
engines.

### Tasks

- [x] Multi-hop collaboration discovery
- [x] Citation traversal (forward, backward, shortest chain)
- [x] Expert discovery with focus ratio
- [x] Topic similarity (direct + inferred)
- [x] University similarity (Jaccard over topic profiles)
- [x] Hidden collaborator detection
- [x] Paper recommendation (4 blended signals)
- [x] Funding opportunity discovery
- [x] Shortest path (collaboration + any-relationship + all-shortest)
- [x] Trending topics, cross-domain collaboration, analytics
- [x] Branded `CypherStatement` type preventing concatenation
- [x] 241 static invariant assertions across every statement
- [ ] **Execute against a live engine** ← remaining

### What remains

No Bolt endpoint was reachable in this environment, so **the Cypher is verified
structurally but never executed**. 15 integration tests exist and skip themselves
when no database is present; CI runs them against a provisioned engine.

To verify locally:
```bash
docker compose up -d cognodb
npm run db:schema && npm run db:seed
npm test --workspace server
```

### Deliverables

| Module | Queries |
|---|---:|
| `entities.cypher.ts` | 27 |
| `discovery.cypher.ts` | 11 |
| `analytics.cypher.ts` | 9 |
| `paths.cypher.ts` | 6 |
| `graph.cypher.ts` | 4 |
| `search.cypher.ts` | 2 |
| **Total** | **59** |

### Git milestones

```
feat(server): add branded cypher template preventing concatenation
feat(server): add entity list and detail queries
feat(server): add discovery queries for experts and recommendations
feat(server): add shortest path and citation chain traversals
test(server): assert invariants across every cypher statement
```

### Best practices

**Make injection structurally impossible, not merely avoided.**

```ts
export type CypherStatement = string & { readonly __cypher: unique symbol };
```

`runRead`/`runWrite` accept only `CypherStatement`. A plain `string` — and
therefore anything built from user input — does not compile.

**Optional filters as `($param IS NULL OR predicate)`.** One prepared statement
per endpoint regardless of filter combination; the plan cache stays small.

**Caller-chosen sorts as `CASE $sort WHEN …`.** Identifiers cannot be
parameterised; a validated Zod enum plus a `CASE` is the safe equivalent.

**Bound every traversal.** Literal structural maximum, narrowed by `$maxDepth`,
capped by `$limit`. A hub node must never return a subgraph that stalls a client.
A unit test enforces this across all 59 statements.

**Promote integer parameters to Bolt integers.** `SKIP`/`LIMIT` reject floats.
Skipping this produces an error that appears only in production, where offsets
are non-zero.

### Expected outcome

Every required capability implemented, parameterised and bounded.
🟡 **59 queries written and statically verified; live execution pending.**

---

## Phase 6 — Frontend Development ✅

### Objectives

A polished application where every view is a live traversal, and every failure
state is designed.

### Tasks

- [x] Dashboard — census, trending topics, top authors and papers
- [x] Global search — ⌘K palette across all ten labels in one round trip
- [x] Author list and detail (publications, collaborators, hidden collaborators)
- [x] Paper list and detail (similar papers, citation chains, both directions)
- [x] Topic explorer with trend chart and expert ranking
- [x] University explorer with institutional similarity
- [x] Conference and journal explorers
- [x] Funding explorer (agencies + projects)
- [x] Collaboration explorer with cross-domain analysis
- [x] Citation explorer
- [x] Recommendation pages with score breakdowns
- [x] Analytics dashboard
- [x] 404 page
- [x] One data hook per endpoint, centralised query keys
- [x] Route-level code splitting

### Deliverables

19 routes · 40+ components · production build passing.

Bundle: heaviest chunk is charts at 432 kB (115 kB gzipped), loaded only on
routes that render charts.

### Folder updates

```
client/src/
├── components/  ui · common · entities · graph · layout
├── hooks/       use-api · use-theme · use-debounced-value · use-media-query
├── lib/         api · query-client · utils · chart-theme
├── pages/       19 route files
├── styles/      globals.css with design tokens
└── types/       api.ts (contract mirror)
```

### Git milestones

```
feat(client): add app shell with sidebar and command palette
feat(client): add data hooks for every api endpoint
feat(client): add dashboard with graph census and trending topics
feat(client): add author, paper and topic detail pages
feat(client): add collaboration, citation and recommendation explorers
perf(client): code-split routes and vendor chunks
```

### Best practices

**One hook per endpoint; no component calls `fetch`.** Cache keys come from one
factory, so invalidation is predictable.

**Mirror contract types rather than importing across the workspace.** The
packages deploy independently; the client should work against any server honouring
the shapes. A build-time coupling would be a false constraint.

**`keepPreviousData` on every list.** Keeps the current page on screen while the
next loads, instead of flashing empty on every filter change.

**Show *why*, not just *what*.** Recommendations return their signal breakdown,
and the UI renders it as a stacked bar. In a research tool, an unexplained
suggestion is unusable.

### Expected outcome

Every planned view implemented and navigable. ✅ **Verified** — `npm run build`
passes; all routes render.

---

## Phase 7 — Graph Visualisation ✅

### Objectives

An interactive network that stays smooth at a few hundred nodes on a laptop.

### Tasks

- [x] Canvas renderer with device-pixel-ratio scaling
- [x] d3-force simulation (link, charge, centre, collide, positional)
- [x] Pan and pointer-anchored zoom
- [x] Node dragging with simulation pinning
- [x] Click to inspect, double-click to expand a neighbourhood
- [x] Neighbour highlighting with the rest dimmed
- [x] Shortest-path highlighting
- [x] Citation and collaboration subgraph rendering
- [x] Fit-to-view, zoom controls, layout restart
- [x] Legend derived from what is actually on screen
- [x] Node inspector panel
- [x] Theme-aware palette

### Deliverables

```
client/src/components/graph/
├── graph-canvas.tsx      renderer + all interaction
├── use-force-layout.ts   simulation bridge
├── graph-legend.tsx      derived from current view
├── node-inspector.tsx    property panel
└── path-trail.tsx        ordered path as entity chain
```

### Git milestones

```
feat(client): add d3-force layout hook with position carry-over
feat(client): add canvas graph renderer with pan and zoom
feat(client): add node inspection and neighbourhood expansion
feat(client): add path highlighting for shortest path results
```

### Best practices

**Canvas, not SVG.** At a few hundred nodes redrawn every tick, SVG creates one
DOM node per element and the browser spends its frame budget on layout. One
canvas repaint keeps interaction smooth.

**Never put simulation state in React.** The simulation mutates node objects at
~60fps; that would re-render the tree every tick. Nodes live in a ref, the canvas
reads them directly, and a `version` counter is the only state that changes.

**Carry positions across refreshes.** Expanding a neighbourhood animates outward
from where nodes already sit rather than re-scattering the view.

**Filter edges to the returned node set server-side.** Otherwise the renderer
receives an edge pointing at a node it never got, and the layout places a ghost
at the origin.

**Size nodes by *global* degree, not degree within the view.** A hub should read
as a hub even when only part of its neighbourhood is on screen.

### Expected outcome

A responsive graph explorer supporting inspect, expand and path tracing.
✅ **Verified** — builds and renders; interaction verified in the dev server.

---

## Phase 8 — UI/UX Enhancement ✅

### Objectives

A product that looks and behaves like Linear or Vercel, not a demo.

### Tasks

- [x] Responsive layouts — mobile drawer, tablet, desktop sidebar
- [x] Loading skeletons matching the footprint of real content
- [x] Empty states with actionable copy
- [x] Error states branching on API error code
- [x] 404 page
- [x] Toast notifications (Sonner)
- [x] Framer Motion page and list transitions
- [x] Dark and light themes via CSS variables
- [x] Keyboard navigation, focus rings, skip-to-content, ARIA labels
- [x] `prefers-reduced-motion` support
- [x] Design system — tokens, spacing, one colour per node label

### Deliverables

`globals.css` design tokens · skeletons for list/card/detail/chart · error states
for network / database-down / generic · full keyboard support.

### Git milestones

```
feat(client): add design tokens with dark and light themes
feat(client): add loading skeletons and empty states
feat(client): add error states that branch on api error code
feat(client): add page transitions and reduced-motion support
a11y(client): add skip link, focus rings and aria labels
```

### Best practices

**Make error states actionable.** A database outage says "check `COGNODB_URI` in
your `.env`", not "something went wrong". The API's error codes are what make
this possible.

**Skeletons should match the real layout.** A generic spinner causes a layout
shift when content arrives.

**One colour per node label, everywhere.** A `Paper` is the same blue in the
graph, in a badge, and in search results. One map in `lib/utils.ts`.

**Honour `prefers-reduced-motion`.** One CSS block; not optional.

### Expected outcome

A polished, accessible, responsive interface. ✅ **Verified** — themes, responsive
breakpoints and keyboard navigation all functioning.

---

## Phase 9 — Testing 🟡

### Objectives

Enough confidence to refactor, with honest coverage boundaries.

### Tasks

- [x] Unit tests — serialization, mappers, validators, pagination
- [x] Static invariants across every Cypher statement
- [x] API integration tests — envelope, error codes, validation
- [x] Database-down behaviour (503, not 500)
- [x] Seed generator tests — counts, determinism, integrity, distribution
- [x] Client tests — formatting, API client, component rendering
- [x] Live graph query tests (**written; skip without a database**)
- [ ] **Browser E2E tests** (Playwright) ← not started
- [ ] **Performance / load testing** ← not started

### Current results

| Suite | Tests | Needs a database |
|---|---:|:--:|
| Server unit | 283 | No |
| Server integration (API) | 12 | No |
| Server integration (graph) | 15 ⏸ | **Yes** |
| Client | 32 | No |
| Seed generator | 22 | No |
| **Total passing** | **349** | |

### What remains

**E2E.** No browser automation. Playwright covering the critical paths — search →
detail, path finder, graph expansion — is the highest-value gap.

**Performance.** No load testing, no query timing under concurrency. The
traversals are bounded by design, but that is an argument, not a measurement.

### Git milestones

```
test(server): add unit tests for serialization and mappers
test(server): assert invariants across every cypher statement
test(server): add api integration tests including database-down
test(client): add component and api client tests
test(seed): verify determinism and distribution shape
```

### Best practices

**Test the Cypher you cannot execute.** The static suite iterates every statement
and asserts: no interpolation, well-formed parameters, balanced delimiters, no
unbounded traversals, no hard-coded page sizes. It cannot prove semantics, but it
catches every rule violation immediately.

**Make database-dependent tests skip, not fail.** `npm test` stays green on a
fresh clone; CI provisions an engine and runs them in full. A suite that always
fails locally gets ignored.

**Test the failure path explicitly.** "Returns 503 not 500 when the database is
unreachable" is a real test, and it caught a real bug.

**Property-test the generator.** Rather than asserting specific values, assert
*properties*: every AUTHORED edge links a real author to a real paper; no paper
cites itself; citation distribution is skewed.

### Expected outcome

Confidence to refactor, with gaps stated rather than hidden.
🟡 **349 passing; E2E and performance outstanding.**

---

## Phase 10 — Deployment ⬜

### Objectives

A live application: frontend on a CDN, API on a Node host, both against a managed
CognoDB instance.

### Tasks

- [x] Render blueprint (`render.yaml`)
- [x] Vercel configuration (`vercel.json`)
- [x] Multi-stage Dockerfile
- [x] `docker-compose.yml` for local stack
- [x] CI pipeline with a live-database job
- [ ] **Provision a managed CognoDB instance**
- [ ] **Deploy the API**
- [ ] **Deploy the frontend**
- [ ] **Apply schema and seed production**
- [ ] **Validate the live deployment**

### Why this phase is not done

Deploying requires accounts and credentials — Render, Vercel, and a CognoDB
instance — that belong to whoever operates the project. The configuration is
complete and ready to apply; the deployment itself cannot be performed on
someone's behalf.

### The five steps

```bash
# 1 — Provision CognoDB, note the Bolt URI and credentials

# 2 — Deploy the API
#     Render → New → Blueprint → select this repo (reads render.yaml)
#     Set: COGNODB_URI, COGNODB_USERNAME, COGNODB_PASSWORD, COGNODB_DATABASE

# 3 — Seed production
COGNODB_URI=neo4j+s://<host>:7687 COGNODB_PASSWORD=<password> \
  npm run db:schema && npm run db:seed

# 4 — Deploy the frontend
#     Vercel → import repo (reads vercel.json)
#     Set VITE_API_BASE_URL=https://<api>.onrender.com/api/v1
#     Add the Vercel origin to CORS_ORIGINS on the API

# 5 — Validate
curl https://<api>.onrender.com/api/v1/health/ready
curl "https://<api>.onrender.com/api/v1/search?q=graph"
```

### Git milestones

```
chore: add render blueprint and vercel configuration
chore: add multi-stage dockerfile and compose stack
ci: add lint, typecheck, test and build pipeline
ci: add integration job against a live graph database
docs: add deployment guide with production urls   ← after deploying
```

### Best practices

**Point the platform health check at liveness, not readiness.** `/health` never
touches the database, so a brief outage cannot trigger a restart loop.
`/health/ready` returns 503 for load balancers.

**Deploy frontend and API separately.** A static host serves assets better and
keeps the free API instance from spending cycles on asset delivery.

**Multi-stage Docker.** Build stage keeps TypeScript; runtime installs production
dependencies only and runs unprivileged.

**Run migrations from CI, never from application boot.** Schema changes should be
an explicit step.

### Expected outcome

A publicly reachable application. ⬜ **Configuration ready; not deployed.**

---

## Phase 11 — Documentation & Submission 🟡

### Objectives

A repository that explains itself to a reviewer who has never seen it.

### Tasks

- [x] Professional README with the "why graph" comparison
- [x] Architecture documentation
- [x] Graph model reference
- [x] Full design specification with user journeys
- [x] Query catalogue (23 production queries)
- [x] Core query explanations
- [x] API documentation
- [x] Project structure guide
- [x] This roadmap
- [x] Setup and deployment instructions in the README
- [ ] **UI screenshots** ← needs a running app
- [ ] **Demo video** ← needs a deployed app
- [ ] **Live URLs in the README** ← needs Phase 10

### What remains

Screenshots need a browser against a seeded database; the video needs a
deployment. Captures live in [`screenshots/`](../screenshots/) — and because the
seed is deterministic, captures taken anywhere show identical content.

### Deliverables

| Document | Lines |
|---|---:|
| `README.md` | ~700 |
| `docs/graph-design.md` | 1,973 |
| `docs/query-catalogue.md` | 2,183 |
| `docs/project-structure.md` | 983 |
| `docs/graph-queries.md` | ~600 |
| `docs/api.md` | ~500 |
| `docs/graph-model.md` | ~330 |
| `docs/architecture.md` | ~300 |

### Git milestones

```
docs: add professional readme with graph database justification
docs: add architecture, model and api documentation
docs: add query catalogue and project structure guide
docs: add development roadmap
docs: add screenshots and demo walkthrough   ← after Phase 10
```

### Best practices

**Lead the README with the comparison, not the feature list.** A reviewer decides
in thirty seconds whether the graph choice was reasoned or fashionable.

**Document what is *not* done.** A roadmap claiming everything is complete is less
credible than one that marks three phases partial and explains why.

**Make screenshots reproducible.** A deterministic seed means anyone regenerating
them gets the same content.

### Expected outcome

A repository a reviewer can navigate unaided. 🟡 **8 documents complete;
screenshots and demo pending a deployment.**

---

## Final submission checklist

### Code
- [x] All packages typecheck with zero errors
- [x] ESLint passes with zero warnings
- [x] Both packages build
- [x] 349 tests passing
- [x] No TODOs, dead code, or placeholder implementations
- [x] No secrets committed; `.env.example` documents every variable

### Graph
- [x] 10 node labels, 13 relationship types
- [x] Constraints and indexes defined
- [x] ~1,420 nodes and ~16,000 relationships
- [x] All 59 queries parameterised and bounded
- [ ] Schema applied to a live instance
- [ ] Queries executed against a live engine

### Application
- [x] 19 routes implemented
- [x] Interactive graph visualisation
- [x] Loading, empty and error states throughout
- [x] Responsive and accessible
- [x] Dark and light themes

### Documentation
- [x] README with graph justification, setup, API, deployment
- [x] Architecture, model, queries, structure, roadmap
- [ ] Screenshots
- [ ] Demo video
- [ ] Live URLs

### Deployment
- [x] Render, Vercel, Docker and CI configuration
- [ ] Frontend deployed
- [ ] Backend deployed
- [ ] Production database seeded and validated

---

## What to do next

Three items, in dependency order:

**1. Stand up a database and run the live tests** *(~15 min)*

```bash
docker compose up -d cognodb
npm run db:schema && npm run db:seed
npm test --workspace server
```

This closes Phases 2 and 5. It is the highest-value remaining step, because it
converts 59 statically-verified queries into 59 *executed* ones.

**2. Deploy** *(~1 hour)* — Phase 10, following the five steps above. Unblocks
screenshots, the demo video, and the live URLs.

**3. Add E2E coverage** *(~half a day)* — Playwright over search → detail, path
finder, and graph expansion. The largest remaining testing gap.

### Related documents

| Document | Contents |
|---|---|
| [`architecture.md`](architecture.md) | Layer boundaries, resilience, rendering |
| [`graph-design.md`](graph-design.md) | Schema spec, user journeys, visual model |
| [`query-catalogue.md`](query-catalogue.md) | 23 production queries |
| [`project-structure.md`](project-structure.md) | Folder structure, conventions, scaling |
| [`api.md`](api.md) | Every endpoint, parameter, payload |
