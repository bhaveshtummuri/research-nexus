# Testing Guide

What is tested, how to run it, and — more usefully — what each layer is actually
capable of catching.

---

## Running the suite

```bash
npm test                  # everything: server, client, seed
npm run test:server       # server only
npm run test:client       # client only
npm run test:seed         # seed generator only

npm run test:unit         # server unit tests (no database)
npm run test:integration  # server integration tests
npm run test:perf         # latency smoke tests (needs a database)

npm run verify            # typecheck + lint + build + test — run before pushing
```

Everything passes on a fresh clone with no database. Suites that need real data
skip themselves rather than fail.

To run those too:

```bash
npm run db:schema && npm run db:seed
npm run test:server
```

---

## Layout

```
server/tests/
├── helpers/index.ts          # app builder, request wrapper, availability gate
├── unit/                     # pure logic, no I/O
│   ├── cypher-tag.test.ts        # the tag that makes injection impossible
│   ├── cypher-statements.test.ts # schema-vocabulary drift guards
│   ├── driver.test.ts            # connection state machine, retry, redaction
│   ├── mappers.test.ts           # Neo4j record → domain object
│   ├── pagination.test.ts
│   ├── query-parameters.test.ts  # integer promotion for Bolt
│   ├── serialize.test.ts
│   └── validators.test.ts        # every Zod schema
├── integration/              # through the real Express app
│   ├── api.test.ts               # surface, envelope, security headers
│   ├── failure-scenarios.test.ts # outages, bad input, empty results
│   ├── route-coverage.test.ts    # every registered route, discovered at runtime
│   └── graph-queries.test.ts     # semantic correctness, needs a database
└── performance/
    └── smoke.test.ts             # latency budgets

client/src/test/                  # jsdom, @testing-library/react
seed/tests/                       # generator invariants
```

---

## What each layer can catch

This is the part worth reading, because the layers differ sharply in what they
can prove.

| Layer | Catches | Cannot catch |
| ----- | ------- | ------------ |
| Unit | Logic errors, mapping mistakes, validation gaps | Anything about Cypher semantics |
| Drift guards | A query naming a label or relationship the schema does not have | A query that is valid but wrong |
| Route coverage | Mis-wired routes, unhandled exceptions, envelope inconsistency | Whether the data returned is correct |
| Graph queries | **Cypher syntax and semantics** — the only layer that can | Anything without a live database |
| Performance | A query plan that collapsed into a scan | Real throughput |

### The gap that mattered

Static validation is not enough for Cypher, and this project has a concrete
demonstration.

Seven queries shipped with `WITH … WHERE … ORDER BY … LIMIT`. Cypher parses
`ORDER BY` as part of the projection clause, *before* `WHERE`, so all seven were
syntax errors — rejected outright by the database. They broke ten endpoints,
including author recommendations, similar papers, hidden collaborators and the
collaboration path.

Nothing static caught them. They are well-formed TypeScript template strings that
name only real labels and real relationships. Only execution finds them.

Worse, the suite designed to find them — `graph-queries.test.ts` — was silently
skipping itself. It chose `describe` vs `describe.skip` from a variable that
`beforeAll` filled in, but that choice is made at *collection* time, before any
hook runs, so it read `false` on every run. Twenty-eight tests reported as
"skipped" and nobody looked closer.

Both are fixed. Connectivity is now resolved with top-level await, and
`route-coverage.test.ts` provides an independent check that does not depend on
that suite being correctly wired.

**The lesson encoded in the suite:** a skipped test is not a passing test, and a
test that can only skip is worth no more than the assertion that it might one day
run.

---

## Test utilities

`server/tests/helpers/index.ts`:

| Export | Purpose |
| ------ | ------- |
| `buildApp()` | Constructs the Express app the same way every suite does |
| `api(app, path)` | `GET` against the configured API prefix |
| `databaseAvailable()` | Connects once, caches for the run |
| `expectReadable(status)` | Asserts 200-or-503 with an explanatory failure message |
| `loadFixtures(app)` | Resolves real entity ids from the seeded graph |

`databaseAvailable()` caches deliberately: without it every suite pays the full
retry backoff before concluding there is no database.

---

## Database failure scenarios

Covered in `failure-scenarios.test.ts` and `driver.test.ts`:

| Scenario | Expected behaviour | Where |
| -------- | ------------------ | ----- |
| Database unreachable | 503 `DATABASE_UNAVAILABLE`, never 500 | `failure-scenarios` |
| Invalid credentials | 503 naming the credential variables | `driver` |
| Network timeout | Retry with backoff, then a clean failure | `driver` |
| Connection retry | Succeeds when the database arrives mid-retry | `driver` |
| Recovery after an outage | State returns to `connected` without a restart | `driver` |
| Empty result | 200 with an empty collection, not an error | `failure-scenarios` |
| Invalid parameters | 422 with the offending field named | `failure-scenarios` |
| Unknown route | 404 with a structured envelope | `failure-scenarios` |

Two invariants hold across all of them: the liveness probe stays green during a
database outage — otherwise the host restarts a healthy process and turns a blip
into downtime — and no response ever carries a stack trace or a credential.

The driver is mocked at the `neo4j-driver` boundary rather than the network one,
so failures like a rejected password can be forced without an unreachable host.

---

## Running against a live database

`graph-queries.test.ts` is the only suite that proves the Cypher is correct. It
needs a seeded instance:

```bash
npm run db:schema
npm run db:seed
npm run test:integration
```

### Free-tier throttling

Managed CognoDB free instances rate-limit at the *connection* level. A burst of
back-to-back traversals gets its TLS handshakes reset (`ECONNRESET`), and once
that starts, reconnects are refused too — so the rest of the run fails for a
reason unrelated to the queries under test.

The suite paces itself with a short gap between tests to stay inside the
allowance. If you still see connection resets, the instance needs a few minutes
to clear the limit; a locally hosted database has no such cap.

This also drove a production fix: a dropped connection now triggers an immediate
reconnect, and a request arriving mid-reconnect waits for it rather than
fast-failing. Previously one dropped socket made every subsequent request fail
until the 30-second background probe next ran.

---

## Client tests

jsdom via Vitest, `@testing-library/react`. 105 tests over utilities, API client,
graph geometry and layouts, and component mounting.

Deliberately **not** covered: pixel output and drag feel. Those need a real
browser; the tests here cover the logic that would silently produce a wrong
picture — layout pinning, filter ordering, hit-test geometry, merge
deduplication.

`setup.ts` stubs what jsdom lacks and the app uses: `ResizeObserver`,
`matchMedia`, `localStorage`.

---

## Writing a new test

1. **Pure logic** → `server/tests/unit/`. No app, no database.
2. **A new endpoint** → nothing to do for coverage; `route-coverage.test.ts`
   discovers it from the router automatically and will fail until it responds
   sensibly. Add a `REQUIRED_QUERY` entry if it needs parameters.
3. **New Cypher** → add a case to `graph-queries.test.ts`. Assert on the shape of
   the traversal (path endpoints, hop counts, ordering), not just the status
   code.
4. **A new client component** → `client/src/test/`. Prefer asserting on
   accessible names and roles over class names.

Assert on behaviour that would break a user. A test that pins an implementation
detail costs more at refactor time than it ever returns.
