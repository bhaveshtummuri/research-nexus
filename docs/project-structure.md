# Research Nexus — Project Structure

The reference folder structure for a production full-stack graph application:
complete tree, layer responsibilities, naming conventions, and the architecture
decisions behind each boundary.

> **Two structures are described.** The **target** structure below is the full
> production layout. The **current** structure — what is actually built and
> passing CI — is a deliberate subset. Every difference is recorded in
> [Current vs. target](#current-vs-target), with the reasoning for why a layer
> was or was not introduced yet. Adding folders before they carry weight is how
> codebases become hard to navigate.

---

## Contents

1. [Complete directory tree](#complete-directory-tree)
2. [Folder responsibilities](#folder-responsibilities)
3. [Layer responsibilities](#layer-responsibilities)
4. [Naming conventions](#naming-conventions)
5. [Scaling the structure](#scaling-the-structure)
6. [Architecture decisions](#architecture-decisions)
7. [Current vs. target](#current-vs-target)

---

## Complete directory tree

```
research-nexus/
│
├── client/                              # React + TypeScript + Vite frontend
│   ├── public/
│   │   ├── favicon.svg
│   │   └── og-image.png
│   │
│   ├── src/
│   │   ├── assets/                      # Static files imported by code
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── animations/                  # Shared Framer Motion variants
│   │   │   ├── fade.ts                  #   fadeIn, fadeUp, staggerChildren
│   │   │   ├── slide.ts                 #   drawer + sheet transitions
│   │   │   ├── page-transitions.ts      #   route enter/exit
│   │   │   └── index.ts
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui primitives — no domain knowledge
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── common/                  # App-wide, domain-agnostic composites
│   │   │   │   ├── page-header.tsx
│   │   │   │   ├── stat-card.tsx
│   │   │   │   ├── empty-state.tsx
│   │   │   │   ├── error-state.tsx
│   │   │   │   ├── error-boundary.tsx
│   │   │   │   ├── loading.tsx           #  ListSkeleton, CardGridSkeleton, DetailSkeleton
│   │   │   │   ├── pagination.tsx
│   │   │   │   ├── filter-bar.tsx
│   │   │   │   ├── section.tsx
│   │   │   │   ├── entity-badge.tsx      #  colour-coded node label chip
│   │   │   │   ├── entity-picker.tsx     #  type-ahead entity selector
│   │   │   │   └── score-bar.tsx         #  explainable recommendation breakdown
│   │   │   │
│   │   │   ├── entities/                # Cards — one per node label
│   │   │   │   ├── author-card.tsx
│   │   │   │   ├── paper-card.tsx
│   │   │   │   ├── topic-card.tsx
│   │   │   │   ├── university-card.tsx
│   │   │   │   ├── venue-card.tsx        #  ConferenceCard + JournalCard
│   │   │   │   ├── dataset-card.tsx
│   │   │   │   └── funding-card.tsx
│   │   │   │
│   │   │   ├── graph/                   # ★ Graph visualisation
│   │   │   │   ├── graph-canvas.tsx     #   canvas renderer + pan/zoom/drag
│   │   │   │   ├── use-force-layout.ts  #   d3-force simulation bridge
│   │   │   │   ├── graph-legend.tsx     #   derived from what is on screen
│   │   │   │   ├── graph-controls.tsx   #   depth, node budget, edge filters
│   │   │   │   ├── node-inspector.tsx   #   selected-node property panel
│   │   │   │   ├── path-trail.tsx       #   ordered path as entity chain
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── search/                  # Global search
│   │   │   │   ├── search-dialog.tsx    #   ⌘K command palette
│   │   │   │   ├── search-trigger.tsx   #   topbar affordance
│   │   │   │   ├── search-results.tsx   #   grouped, label-aware results
│   │   │   │   └── search-hit.tsx
│   │   │   │
│   │   │   ├── dashboard/               # Home widgets
│   │   │   │   ├── totals-row.tsx
│   │   │   │   ├── graph-census.tsx     #   "why a graph, in one number"
│   │   │   │   ├── trending-topics.tsx
│   │   │   │   ├── popular-authors.tsx
│   │   │   │   ├── recent-papers.tsx
│   │   │   │   ├── featured-conferences.tsx
│   │   │   │   └── shortcut-grid.tsx
│   │   │   │
│   │   │   ├── analytics/               # Charts and metric tiles
│   │   │   │   ├── publication-trend-chart.tsx
│   │   │   │   ├── relationship-census-chart.tsx
│   │   │   │   ├── node-composition-chart.tsx
│   │   │   │   ├── collaboration-health.tsx
│   │   │   │   └── leaderboard-table.tsx
│   │   │   │
│   │   │   ├── recommendations/         # Explainable ranking surfaces
│   │   │   │   ├── recommendation-card.tsx
│   │   │   │   ├── reason-breakdown.tsx
│   │   │   │   └── weight-legend.tsx
│   │   │   │
│   │   │   ├── collaboration/           # Collaboration explorer
│   │   │   │   ├── collaborator-grid.tsx
│   │   │   │   ├── hidden-collaborators.tsx
│   │   │   │   ├── distance-groups.tsx
│   │   │   │   └── cross-domain-panel.tsx
│   │   │   │
│   │   │   ├── citations/               # Citation explorer
│   │   │   │   ├── citation-chain.tsx
│   │   │   │   ├── direction-toggle.tsx
│   │   │   │   └── citation-network.tsx
│   │   │   │
│   │   │   ├── topics/                  # Topic explorer
│   │   │   │   ├── topic-trend-chart.tsx
│   │   │   │   ├── related-topics-list.tsx
│   │   │   │   └── expert-list.tsx
│   │   │   │
│   │   │   └── paths/                   # Path finder
│   │   │       ├── path-form.tsx
│   │   │       ├── path-result.tsx
│   │   │       └── path-graph.tsx
│   │   │
│   │   ├── layouts/                     # Route-level page frames
│   │   │   ├── app-shell.tsx            #   sidebar + topbar + outlet
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   ├── mobile-nav.tsx
│   │   │   ├── detail-layout.tsx        #   shared header/aside for detail pages
│   │   │   └── nav-config.ts            #   navigation as data, not JSX
│   │   │
│   │   ├── pages/                       # One file per route
│   │   │   ├── dashboard.tsx
│   │   │   ├── analytics.tsx
│   │   │   ├── authors.tsx
│   │   │   ├── author-detail.tsx
│   │   │   ├── papers.tsx
│   │   │   ├── paper-detail.tsx
│   │   │   ├── topics.tsx
│   │   │   ├── topic-detail.tsx
│   │   │   ├── universities.tsx
│   │   │   ├── university-detail.tsx
│   │   │   ├── venues.tsx               #   ConferencesPage + JournalsPage
│   │   │   ├── venue-detail.tsx
│   │   │   ├── funding.tsx
│   │   │   ├── funding-detail.tsx
│   │   │   ├── graph-explorer.tsx
│   │   │   ├── path-finder.tsx
│   │   │   ├── collaboration.tsx
│   │   │   ├── citations.tsx
│   │   │   ├── recommendations.tsx
│   │   │   └── not-found.tsx
│   │   │
│   │   ├── routes/                      # Routing configuration
│   │   │   ├── index.tsx                #   route tree + lazy boundaries
│   │   │   ├── route-paths.ts           #   typed path constants
│   │   │   └── protected-route.tsx      #   auth guard (when auth lands)
│   │   │
│   │   ├── services/                    # API layer — the only place fetch lives
│   │   │   ├── http-client.ts           #   fetch wrapper, envelope unwrap, ApiRequestError
│   │   │   ├── author.service.ts
│   │   │   ├── paper.service.ts
│   │   │   ├── topic.service.ts
│   │   │   ├── university.service.ts
│   │   │   ├── venue.service.ts
│   │   │   ├── funding.service.ts
│   │   │   ├── graph.service.ts
│   │   │   ├── search.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/                       # TanStack Query wrappers + UI hooks
│   │   │   ├── queries/                 #   one hook per endpoint
│   │   │   │   ├── use-authors.ts
│   │   │   │   ├── use-papers.ts
│   │   │   │   ├── use-topics.ts
│   │   │   │   ├── use-graph.ts
│   │   │   │   ├── use-search.ts
│   │   │   │   └── use-analytics.ts
│   │   │   ├── use-debounced-value.ts
│   │   │   ├── use-media-query.ts
│   │   │   ├── use-keyboard-shortcut.ts
│   │   │   └── use-url-state.ts         #   filters synced to the query string
│   │   │
│   │   ├── context/                     # React context providers
│   │   │   ├── theme-context.tsx        #   dark/light, persisted
│   │   │   ├── graph-context.tsx        #   shared selection across graph views
│   │   │   ├── search-context.tsx       #   palette open state, recent queries
│   │   │   └── index.tsx                #   composed AppProviders
│   │   │
│   │   ├── lib/                         # Third-party configuration + pure helpers
│   │   │   ├── query-client.ts          #   TanStack config + query-key factory
│   │   │   ├── utils.ts                 #   cn(), formatters, label styles
│   │   │   ├── chart-theme.ts           #   Recharts tokens from CSS variables
│   │   │   ├── graph-colors.ts          #   node label → colour map
│   │   │   └── format.ts                #   numbers, currency, dates, citations
│   │   │
│   │   ├── constants/                   # Frozen values, no logic
│   │   │   ├── api.ts                   #   endpoint paths, page sizes
│   │   │   ├── graph.ts                 #   node labels, relationship types, depth caps
│   │   │   ├── routes.ts
│   │   │   └── ui.ts                    #   breakpoints, animation durations
│   │   │
│   │   ├── types/                       # Shared TypeScript types
│   │   │   ├── api.ts                   #   contract types, mirrored from server
│   │   │   ├── graph.ts                 #   renderer-specific view models
│   │   │   ├── ui.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/                       # Pure functions, framework-free
│   │   │   ├── array.ts
│   │   │   ├── string.ts
│   │   │   ├── graph-math.ts            #   layout maths, degree scaling
│   │   │   └── validation.ts
│   │   │
│   │   ├── styles/
│   │   │   ├── globals.css              #   Tailwind layers + design tokens
│   │   │   └── graph.css                #   canvas-adjacent styles
│   │   │
│   │   ├── test/
│   │   │   ├── setup.ts                 #   jsdom shims (ResizeObserver, matchMedia)
│   │   │   ├── test-utils.tsx           #   render with providers
│   │   │   └── fixtures/                #   shared mock payloads
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── postcss.config.js
│
├── server/                              # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/                      # Environment and app settings
│   │   │   ├── env.ts                   #   Zod-validated process.env
│   │   │   ├── index.ts                 #   grouped config object
│   │   │   └── cors.ts
│   │   │
│   │   ├── database/                    # ★ CognoDB access layer
│   │   │   ├── driver.ts                #   driver lifecycle, retry, health probe
│   │   │   ├── session.ts               #   session factory, access modes
│   │   │   ├── transaction.ts           #   managed read/write helpers
│   │   │   ├── query-runner.ts          #   runRead / runWrite / param conversion
│   │   │   ├── cypher-tag.ts            #   branded CypherStatement template
│   │   │   ├── serialize.ts             #   Bolt values → plain JSON
│   │   │   ├── mappers.ts               #   records → domain objects
│   │   │   ├── errors.ts                #   driver error → ApiError translation
│   │   │   ├── schema/
│   │   │   │   ├── constraints.ts       #   uniqueness constraint statements
│   │   │   │   ├── indexes.ts           #   secondary index statements
│   │   │   │   └── apply.ts             #   idempotent schema runner
│   │   │   └── index.ts
│   │   │
│   │   ├── graph/                       # ★ Cypher queries, grouped by feature
│   │   │   ├── authors.cypher.ts
│   │   │   ├── papers.cypher.ts
│   │   │   ├── topics.cypher.ts
│   │   │   ├── universities.cypher.ts
│   │   │   ├── venues.cypher.ts
│   │   │   ├── funding.cypher.ts
│   │   │   ├── discovery.cypher.ts      #   recommendations, experts, similarity
│   │   │   ├── paths.cypher.ts          #   shortestPath, citation chains
│   │   │   ├── visualization.cypher.ts  #   subgraph payloads
│   │   │   ├── search.cypher.ts
│   │   │   ├── analytics.cypher.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── repositories/                # Data access — Cypher in, domain out
│   │   │   ├── author.repository.ts
│   │   │   ├── paper.repository.ts
│   │   │   ├── topic.repository.ts
│   │   │   ├── university.repository.ts
│   │   │   ├── venue.repository.ts
│   │   │   ├── funding.repository.ts
│   │   │   ├── graph.repository.ts
│   │   │   ├── search.repository.ts
│   │   │   ├── analytics.repository.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── services/                    # Business logic — no Cypher, no Express
│   │   │   ├── author.service.ts
│   │   │   ├── paper.service.ts
│   │   │   ├── topic.service.ts
│   │   │   ├── university.service.ts
│   │   │   ├── venue.service.ts
│   │   │   ├── funding.service.ts
│   │   │   ├── discovery.service.ts     #   scoring weights live here
│   │   │   ├── path.service.ts
│   │   │   ├── graph.service.ts
│   │   │   ├── search.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── controllers/                 # HTTP handlers — thin by design
│   │   │   ├── author.controller.ts
│   │   │   ├── paper.controller.ts
│   │   │   ├── topic.controller.ts
│   │   │   ├── university.controller.ts
│   │   │   ├── venue.controller.ts
│   │   │   ├── funding.controller.ts
│   │   │   ├── discovery.controller.ts
│   │   │   ├── graph.controller.ts
│   │   │   ├── search.controller.ts
│   │   │   ├── analytics.controller.ts
│   │   │   ├── health.controller.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── routes/                      # API surface
│   │   │   ├── author.routes.ts
│   │   │   ├── paper.routes.ts
│   │   │   ├── topic.routes.ts
│   │   │   ├── university.routes.ts
│   │   │   ├── venue.routes.ts
│   │   │   ├── funding.routes.ts
│   │   │   ├── graph.routes.ts
│   │   │   ├── discovery.routes.ts
│   │   │   ├── search.routes.ts
│   │   │   ├── analytics.routes.ts
│   │   │   ├── health.routes.ts
│   │   │   └── index.ts                 #   mounts all routers under API_PREFIX
│   │   │
│   │   ├── middleware/                  # Cross-cutting request concerns
│   │   │   ├── validate.ts              #   Zod schema → req.validated
│   │   │   ├── error-handler.ts         #   single error envelope
│   │   │   ├── not-found.ts
│   │   │   ├── request-logger.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── security.ts              #   helmet + CORS composition
│   │   │   └── index.ts
│   │   │
│   │   ├── validation/                  # Request schemas
│   │   │   ├── schemas/
│   │   │   │   ├── author.schema.ts
│   │   │   │   ├── paper.schema.ts
│   │   │   │   ├── topic.schema.ts
│   │   │   │   ├── graph.schema.ts
│   │   │   │   ├── search.schema.ts
│   │   │   │   └── common.schema.ts     #   pagination, id params, sort enums
│   │   │   └── index.ts
│   │   │
│   │   ├── types/                       # Domain model + shared aliases
│   │   │   ├── domain.ts                #   Author, Paper, GraphView…
│   │   │   ├── api.ts                   #   envelope, meta, pagination
│   │   │   ├── express.d.ts             #   Request augmentation
│   │   │   └── index.ts
│   │   │
│   │   ├── interfaces/                  # Contracts between layers
│   │   │   ├── repository.interface.ts  #   what every repository must expose
│   │   │   ├── service.interface.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── constants/
│   │   │   ├── node-labels.ts
│   │   │   ├── relationship-types.ts
│   │   │   ├── error-codes.ts
│   │   │   ├── scoring-weights.ts       #   recommendation + expertise tuning
│   │   │   └── index.ts
│   │   │
│   │   ├── helpers/                     # Domain-aware small functions
│   │   │   ├── pagination.helper.ts     #   clamp offset/limit to config bounds
│   │   │   ├── scoring.helper.ts
│   │   │   ├── response.helper.ts       #   success/list envelopes
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/                       # Domain-free pure functions
│   │   │   ├── logger.ts                #   dependency-free structured logger
│   │   │   ├── api-error.ts             #   ApiError + error codes
│   │   │   ├── async-handler.ts         #   promise rejection → next(err)
│   │   │   ├── number.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── health/                      # Liveness and readiness
│   │   │   ├── liveness.ts              #   process is up — never touches the DB
│   │   │   ├── readiness.ts             #   verifies CognoDB connectivity
│   │   │   └── index.ts
│   │   │
│   │   ├── app.ts                       # Express assembly — no listen()
│   │   └── server.ts                    # Bootstrap, graceful shutdown
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── cypher-statements.test.ts   # invariants across every query
│   │   │   ├── mappers.test.ts
│   │   │   ├── serialize.test.ts
│   │   │   ├── validators.test.ts
│   │   │   └── pagination.test.ts
│   │   ├── integration/
│   │   │   ├── api.test.ts                 # envelope + error codes, no DB
│   │   │   └── graph-queries.test.ts       # live engine, skips when absent
│   │   └── fixtures/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── vitest.config.ts
│
├── database/                            # Engine-level schema, versioned as SQL would be
│   ├── schema/
│   │   ├── 01-constraints.cypher
│   │   ├── 02-indexes.cypher
│   │   └── 03-fulltext-optional.cypher
│   ├── migrations/                      # Ordered, idempotent schema changes
│   │   └── 001-initial-schema.cypher
│   ├── queries/                         # Reference Cypher for DBAs / demos
│   │   └── examples.cypher
│   └── README.md
│
├── seed/                                # Deterministic data generator CLI
│   ├── src/
│   │   ├── data/                        # Vocabularies — no logic
│   │   │   ├── people.ts                #   names, titles, statement fragments
│   │   │   ├── institutions.ts          #   universities, funding agencies
│   │   │   ├── research.ts              #   fields, topics, keywords, datasets
│   │   │   ├── venues.ts                #   conferences, journals
│   │   │   └── prose.ts                 #   title patterns, abstract fragments
│   │   │
│   │   ├── generators/
│   │   │   ├── nodes.ts                 #   one generator per label
│   │   │   ├── relationships.ts         #   edges + community/power-law shaping
│   │   │   ├── text.ts                  #   slugify, searchText, abstracts
│   │   │   └── index.ts
│   │   │
│   │   ├── writer.ts                    # Batched UNWIND + MERGE writer
│   │   ├── derive.ts                    # Post-load Cypher aggregations
│   │   ├── build.ts                     # Pure in-memory graph assembly
│   │   ├── random.ts                    # Seeded PRNG (mulberry32)
│   │   ├── config.ts                    # Entity counts, tuning, env
│   │   ├── db.ts                        # Standalone driver for the CLI
│   │   ├── types.ts                     # Row shapes written to the graph
│   │   └── cli.ts                       # schema | seed | reset | stats
│   │
│   ├── tests/
│   │   └── generator.test.ts            # counts, determinism, integrity
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── architecture.md                  # Layers, resilience, rendering strategy
│   ├── graph-model.md                   # As-built node and relationship reference
│   ├── graph-design.md                  # Full schema spec + user journeys
│   ├── graph-queries.md                 # Core queries explained line by line
│   ├── query-catalogue.md               # 23 production queries
│   ├── api.md                           # Every endpoint, parameter, payload
│   ├── project-structure.md             # This document
│   ├── development.md                   # Local setup, conventions, workflows
│   ├── deployment.md                    # Render, Vercel, Docker, CI
│   ├── diagrams/                        # Mermaid sources + exported SVG
│   │   ├── system-architecture.mmd
│   │   ├── graph-model.mmd
│   │   └── request-lifecycle.mmd
│   └── demo/                            # Demo script, walkthrough assets
│       └── walkthrough.md
│
├── screenshots/                         # UI captures referenced from the README
│   ├── dashboard.png
│   ├── graph-explorer.png
│   ├── path-finder.png
│   └── README.md                        # Capture instructions + route map
│
├── .github/
│   └── workflows/
│       └── ci.yml                       # Lint, typecheck, test, build + live DB job
│
├── .env.example                         # Every variable, documented
├── .gitignore
├── .dockerignore
├── .editorconfig
├── .prettierrc.json
├── eslint.config.js                     # Flat config, type-aware, whole workspace
├── tsconfig.base.json                   # Shared compiler options
├── package.json                         # npm workspaces root
├── package-lock.json
├── docker-compose.yml                   # Local database + API
├── Dockerfile                           # Multi-stage API image
├── render.yaml                          # API deployment blueprint
├── vercel.json                          # Frontend deployment
├── LICENSE
└── README.md
```

---

## Folder responsibilities

### Root

| Path | Responsibility |
|---|---|
| `client/` | Browser application. Deployed to a static host. |
| `server/` | HTTP API. Deployed as a Node service. |
| `database/` | Engine-level schema as versioned `.cypher` — the graph equivalent of SQL migrations. |
| `seed/` | Standalone CLI that generates and loads the demo graph. |
| `docs/` | Architecture, model, queries, API, guides. |
| `screenshots/` | UI captures with instructions for regenerating them. |

**Why npm workspaces and not four repositories.** The three packages share a
TypeScript config, a lint config, and a contract. One `npm install`, one CI run,
one atomic commit when the API and the client change together. They still build
and deploy independently — the workspace is a development convenience, not a
runtime coupling.

### Frontend

| Folder | Responsibility | Never contains |
|---|---|---|
| `components/ui/` | Design-system primitives. Radix + CVA + Tailwind. | Domain concepts, API calls |
| `components/common/` | App-wide composites — headers, empty states, pagination. | Feature-specific logic |
| `components/entities/` | One card per node label. Presentational. | Data fetching |
| `components/graph/` | Canvas renderer, force simulation, inspector, legend. | HTTP calls |
| `components/<feature>/` | Feature modules — search, dashboard, analytics, citations… | Cross-feature imports |
| `layouts/` | Page frames: shell, sidebar, topbar, detail scaffold. | Business logic |
| `pages/` | One file per route. Composes features, owns URL state. | Reusable UI |
| `routes/` | Route tree, typed paths, lazy boundaries. | Components |
| `services/` | **The only place `fetch` appears.** Endpoint + envelope handling. | React |
| `hooks/queries/` | One TanStack hook per endpoint. Owns cache keys. | Direct `fetch` |
| `context/` | Cross-cutting client state: theme, graph selection, palette. | Server state |
| `lib/` | Third-party configuration and pure helpers. | Components |
| `constants/` | Frozen values. | Logic |
| `types/` | Contract types mirrored from the server, plus view models. | Runtime code |
| `utils/` | Pure, framework-free functions. | React, DOM |
| `animations/` | Shared Framer Motion variants. | Components |

**The `lib` vs `utils` distinction.** `utils/` is pure functions with no
dependencies — `truncate`, `groupBy`. `lib/` is where third-party libraries are
configured — the query client, the chart theme. If it imports a package, it is
`lib/`.

**Why `services/` and `hooks/` are separate.** `services/` knows *how to call the
API*; `hooks/` knows *how to cache it*. Keeping them apart means the service
layer is testable without React, and swapping TanStack Query for something else
touches one folder.

### Backend

| Folder | Responsibility | Never contains |
|---|---|---|
| `config/` | Zod-validated environment, grouped settings. | Business logic |
| `database/` | Driver lifecycle, sessions, transactions, serialization, mapping. | Domain concepts |
| `graph/` | Cypher statements, grouped by feature. | Runtime values |
| `repositories/` | Execute Cypher, return domain objects. | Business rules, HTTP |
| `services/` | Business logic, scoring, orchestration. | Cypher, Express types |
| `controllers/` | Read validated input → call service → send envelope. | Queries, branching on DB state |
| `routes/` | URL shape + validation middleware wiring. | Logic |
| `middleware/` | Validation, errors, logging, rate limiting, security. | Entity knowledge |
| `validation/` | Zod request schemas. | Business rules |
| `types/` | Domain model and API contract types. | Runtime code |
| `interfaces/` | Contracts between layers. | Implementations |
| `constants/` | Node labels, relationship types, error codes, weights. | Logic |
| `helpers/` | Small domain-aware functions. | Database access |
| `utils/` | Domain-free pure functions — logger, errors, async wrapper. | Domain knowledge |
| `health/` | Liveness and readiness probes. | Business logic |

**`app.ts` vs `server.ts`.** `app.ts` builds the Express application and returns
it. `server.ts` binds the port and installs shutdown handlers. That split is what
lets integration tests mount the real app with supertest without opening a socket
or connecting to a database.

### Database

`.cypher` files are the source of truth for schema, versioned like SQL
migrations. They are plain text so a DBA can paste them into a Cypher shell
without running any of our tooling. `migrations/` holds ordered, idempotent
changes for schema evolution after the initial deploy.

### Seed

| File | Responsibility |
|---|---|
| `data/` | Vocabularies only — no logic, easy to review and extend |
| `generators/nodes.ts` | One generator per label |
| `generators/relationships.ts` | Edges, plus power-law and community shaping |
| `build.ts` | Assembles the whole graph in memory — **pure and deterministic** |
| `writer.ts` | Batched `UNWIND` + `MERGE`, idempotent |
| `derive.ts` | Post-load Cypher aggregations (h-index, counters, `COLLABORATED_WITH`) |
| `cli.ts` | `schema` / `seed` / `reset` / `stats` |

**Why generation is separate from writing.** `build.ts` is a pure function of the
seed string, so the entire pipeline is unit-testable without a database — the
test suite verifies referential integrity, temporal consistency and distribution
shape entirely in memory. The writer stays a thin batching layer.

---

## Layer responsibilities

### Request lifecycle

```
HTTP request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ MIDDLEWARE          security → CORS → logging → rate limit  │
│                     → Zod validation → req.validated        │
│                     ✗ invalid input stops here with 422     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ROUTE               URL shape, attaches validation          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTROLLER          read validated input                    │
│                     call one service                        │
│                     send the envelope                       │
│                     ✗ no queries, no DB-state branching     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVICE             business rules, scoring weights,        │
│                     orchestration of parallel calls         │
│                     ✗ no Cypher, no Express types           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ REPOSITORY          bind parameters, execute, map records   │
│                     ✗ no business rules                     │
└─────────────────────────────────────────────────────────────┘
    │
    ├──▶ graph/*.cypher.ts    branded, parameterised statements
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE            session, managed transaction,           │
│                     Bolt integer promotion,                 │
│                     value serialization, error translation  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
  CognoDB (Bolt)
```

Each layer depends **downward only**. A service never imports Express; a
repository never imports a controller. That is what makes services directly
unit-testable — they take plain arguments and return plain objects.

### What each layer owns

| Layer | Owns | Testable by |
|---|---|---|
| Middleware | Cross-cutting concerns, validation | Supertest, no DB |
| Controller | HTTP shape | Supertest |
| Service | Business rules, scoring | Plain unit test, mock repository |
| Repository | Query execution, mapping | Integration test with a live engine |
| Database | Driver, transactions, conversion | Unit test for conversion, integration for the rest |
| Graph (Cypher) | Query text | Static invariant tests + live execution |

### The repository boundary

The repository is where "get me an author" becomes "execute this Cypher and map
the result". It matters because it is the seam:

```ts
// repositories/author.repository.ts — knows Cypher, knows nothing about rules
export async function findExpertsForTopic(
  topicId: string,
  weights: ExpertiseWeights,
  pagination: Pagination,
): Promise<ExpertSummary[]> {
  return runRead(
    FIND_EXPERTS_FOR_TOPIC,
    { topicId, ...weights, ...pagination },
    (record) => mapExpertSummary(column(record, 'expert')),
  );
}

// services/discovery.service.ts — knows rules, knows nothing about Cypher
export async function findExperts(topicId: string, options: ExpertOptions) {
  const experts = await authorRepository.findExpertsForTopic(
    topicId,
    EXPERTISE_WEIGHTS,        // the business decision lives here
    resolvePagination(options),
  );
  return experts.filter((expert) => expert.focusRatio >= options.minFocus);
}
```

Swapping CognoDB for another engine touches `repositories/` and `graph/`, and
nothing above them.

---

## Naming conventions

### Files

| Kind | Convention | Example |
|---|---|---|
| React component | `kebab-case.tsx` | `author-card.tsx` |
| React hook | `use-<thing>.ts` | `use-debounced-value.ts` |
| Context | `<name>-context.tsx` | `theme-context.tsx` |
| Backend module | `<domain>.<layer>.ts` | `author.repository.ts` |
| Cypher module | `<feature>.cypher.ts` | `discovery.cypher.ts` |
| Zod schema | `<domain>.schema.ts` | `paper.schema.ts` |
| Test | `<subject>.test.ts` | `mappers.test.ts` |
| Type module | `<domain>.ts` | `domain.ts` |

**Why kebab-case everywhere.** macOS and Windows are case-insensitive; Linux is
not. `AuthorCard.tsx` vs `authorCard.tsx` works locally and breaks in CI. Kebab
removes the whole class of bug.

### Code

| Kind | Convention | Example |
|---|---|---|
| Component | `PascalCase` | `AuthorCard` |
| Hook | `camelCase`, `use` prefix | `useAuthors` |
| Function | `camelCase`, verb-first | `findExperts`, `mapAuthorSummary` |
| Type / interface | `PascalCase`, no `I` prefix | `AuthorSummary` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_TRAVERSAL_DEPTH` |
| Cypher statement | `SCREAMING_SNAKE_CASE` | `FIND_EXPERTS_FOR_TOPIC` |
| Cypher parameter | `camelCase` with `$` | `$topicId`, `$maxDepth` |
| Node label | `PascalCase` | `ResearchTopic` |
| Relationship type | `SCREAMING_SNAKE_CASE` | `COLLABORATED_WITH` |

**No `I` prefix on interfaces.** It is a Hungarian-notation holdover; TypeScript
already knows what is a type. `AuthorRepository` reads better than
`IAuthorRepository`.

### Types vs interfaces

One rule, so nobody has to think about it:

- **`type`** for data shapes, unions, and everything returned from a function
- **`interface`** for contracts something *implements*

```ts
// types/domain.ts — data
export type AuthorSummary = { id: string; name: string; hIndex: number };

// interfaces/repository.interface.ts — a contract
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findMany(filters: unknown, pagination: Pagination): Promise<T[]>;
}
```

### Cypher

- One statement per exported constant
- Statement name matches the question: `FIND_HIDDEN_COLLABORATORS`
- Grouped by feature, not by node label — `discovery.cypher.ts` holds every
  discovery query regardless of which labels it touches
- Every runtime value is a `$parameter`, always

### Barrel files

`index.ts` re-exports are used at **folder boundaries only** — `components/ui/`,
`services/`, `repositories/`. Not inside feature folders, where they create
import cycles and defeat tree-shaking.

---

## Scaling the structure

### When a folder gets too big

| Signal | Action |
|---|---|
| A `components/` folder passes ~10 files | Split into a feature subfolder |
| A service passes ~300 lines | Extract a sub-service by concern |
| A Cypher module passes ~10 queries | Split by sub-feature |
| A page passes ~200 lines | Extract feature components |

### Growth path

**Stage 1 — today.** Layer-first: `controllers/`, `services/`, `repositories/`.
Correct while the domain is small and every layer fits on one screen.

**Stage 2 — feature modules.** When the API passes ~15 resources, group by
feature so a change touches one directory:

```
server/src/modules/
├── author/
│   ├── author.controller.ts
│   ├── author.service.ts
│   ├── author.repository.ts
│   ├── author.cypher.ts
│   ├── author.schema.ts
│   ├── author.types.ts
│   └── index.ts
├── discovery/
└── graph/
```

The trade: layer-first makes "how do all controllers work" easy; feature-first
makes "everything about authors" easy. Past a certain size the second question is
asked far more often.

**Stage 3 — extraction.** If graph traversals and CRUD develop different scaling
profiles, `modules/` boundaries are already service boundaries — a module lifts
out with its Cypher intact.

### Frontend growth

Same progression. Today `components/<feature>/` + `pages/`. At scale:

```
client/src/features/
├── authors/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── types.ts
│   └── index.ts
└── graph/
```

**Rule:** a feature may import from `components/ui`, `components/common`, `lib`,
`utils` — never from another feature. Cross-feature needs get promoted to
`common/`.

### Adding a new entity

The structure makes this mechanical — eight files, no existing file restructured:

```
1. database/schema/     constraint + indexes
2. seed/src/data/       vocabulary
3. seed/src/generators/ node + relationship generation
4. server/src/graph/    <entity>.cypher.ts
5. server/src/repositories/  <entity>.repository.ts
6. server/src/services/      <entity>.service.ts
7. server/src/controllers/ + routes/ + validation/
8. client/src/services/ + hooks/queries/ + components/entities/ + pages/
```

---

## Architecture decisions

The reasoning worth being able to explain.

### 1. Cypher lives in its own layer, and cannot be built by concatenation

```ts
export type CypherStatement = string & { readonly __cypher: unique symbol };

export function cypher(strings: TemplateStringsArray, ...values: unknown[]): CypherStatement {
  if (values.length > 0) {
    throw new Error('Cypher templates must not interpolate values.');
  }
  return (strings.raw[0] ?? '').trim() as CypherStatement;
}
```

`runRead`/`runWrite` accept only `CypherStatement`. A plain `string` — and
therefore anything assembled from user input — does not compile.

**Why it matters:** injection is *structurally impossible*, not merely avoided by
review. And because every query is a static constant, a unit test can iterate all
of them and assert invariants: no unbounded traversals, no hard-coded page sizes,
well-formed parameters.

### 2. `app.ts` is separate from `server.ts`

The app is built by a function that returns it; the server binds the port.
Integration tests mount the real application with supertest — real middleware,
real routes, real error handling — without opening a socket. That is why the
suite covers the envelope and every error code with no database at all.

### 3. The database is not a boot precondition

The HTTP server binds first; the connection is established in the background with
bounded retries. On free hosting the database frequently becomes reachable *after*
the web service, and blocking would leave the platform health check timing out
against a process that is otherwise fine.

A failure degrades rather than crashes: `/health` stays green, `/health/ready`
returns 503, data endpoints fail fast with `DATABASE_UNAVAILABLE`, and a
background probe reconnects.

*This one was found by smoke-testing, not by design — the original code awaited
the connection before listening and took up to 75 seconds to bind with the
database down.*

### 4. Contract types are duplicated, not shared

`client/src/types/api.ts` mirrors `server/src/types/domain.ts` rather than
importing it. The packages deploy independently, and the client should work
against any server honouring the shapes. A build-time coupling would be a false
constraint — and a shared package would need its own versioning and release step.

### 5. Seed generation is pure and separate from writing

`build.ts` is a deterministic function of the seed string. The whole pipeline is
unit-testable without a database, which is why the seed suite can verify
referential integrity, temporal consistency and power-law distribution shape in
memory in ~100 ms.

### 6. Exactly two denormalisations, both derived in Cypher

`COLLABORATED_WITH` and the counter properties (`hIndex`, `citationCount`, …) are
computed *after* the edges exist. A counter can never disagree with the
relationships it summarises. The bar for a third is measurable savings on a hot
path plus a deterministic recomputation step.

### 7. Graph rendering is canvas, not SVG

At a few hundred nodes redrawn every simulation tick, SVG creates one DOM node
per element and the browser spends its frame budget on layout. One canvas
repaint keeps interaction smooth.

The simulation mutates node objects at ~60fps; putting them in React state would
re-render the tree every tick. They live in a ref, the canvas reads them
directly, and a `version` counter is the only state that changes.

### 8. The `.cypher` files are plain text

Schema is versioned as `.cypher`, not embedded in TypeScript, so a DBA can paste
it into a shell without running our tooling — the same reason SQL projects keep
migrations as `.sql`.

---

## Current vs. target

What is built today is a deliberate subset. Every difference and its reasoning:

| Target | Current | Why |
|---|---|---|
| `server/src/repositories/` | Services call `graph/` directly | With one consumer per query, the extra layer was indirection without benefit. **Introduce when** two services need the same query, or a second data source appears. |
| `server/src/graph/` | `server/src/cypher/` | Name only. `graph/` is clearer against `database/`. |
| `server/src/database/` | `server/src/db/` | Name only. |
| `server/src/health/` | `controllers/health.controller.ts` | Three probes do not need a folder. **Split when** dependency checks are added. |
| `server/src/interfaces/` | — | Interfaces exist where they earn their place; a folder for two files is premature. |
| `server/src/helpers/` | Merged into `utils/` | The helpers/utils line is genuinely blurry. **Split when** `utils/` exceeds ~10 files. |
| `server/src/constants/` | Inlined in `config/` and services | Scoring weights live next to the code that uses them. **Extract when** shared across modules. |
| `client/src/layouts/` | `components/layout/` | Name only. |
| `client/src/services/` | Merged into `lib/api.ts` + `hooks/` | One HTTP client, thin hooks. **Split when** endpoints need per-resource transformation. |
| `client/src/context/` | `hooks/use-theme.tsx` | Only theme needs cross-tree state today. **Add when** graph selection is shared across routes. |
| `client/src/routes/` | `App.tsx` | The route tree is one readable file. **Extract when** guards and nested layouts arrive. |
| `client/src/animations/` | Inline Framer Motion variants | **Extract when** the same variant appears in three places. |
| `client/src/constants/` | `lib/utils.ts` | **Extract when** values are needed outside `lib/`. |
| `client/src/utils/` | `lib/utils.ts` | **Split when** `lib/` mixes pure helpers with library config. |
| `client/src/components/<feature>/` | `common/`, `entities/`, `graph/`, `layout/` | Feature folders when a feature has ≥3 components. `search/` is the first candidate. |
| `database/migrations/` | — | Nothing to migrate from yet. |
| `docs/diagrams/`, `docs/demo/` | Mermaid inline in docs | Inline diagrams render on GitHub with no build step. |

**The principle.** Every folder should hold at least two or three files that
genuinely belong together. A structure with fifteen single-file directories is
harder to navigate than a flat one — the tree above is where this codebase is
*going*, and the "introduce when" column is the trigger for each move.

### Related documents

| Document | Contents |
|---|---|
| [`architecture.md`](architecture.md) | Layer boundaries, resilience, rendering |
| [`graph-design.md`](graph-design.md) | Schema spec, user journeys, visual model |
| [`query-catalogue.md`](query-catalogue.md) | 23 production queries |
| [`api.md`](api.md) | Every endpoint, parameter, payload |
