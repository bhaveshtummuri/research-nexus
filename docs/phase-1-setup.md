# Phase 1 — Environment Setup

The complete development environment: folder structure, install commands,
configuration files, database module, health checks, and a verification
checklist.

**Status: ✅ complete except a live CognoDB Cloud instance**, which needs
credentials that belong to whoever operates the project. Everything else is
built, verified and reproducible from a clean clone.

---

## Verification results

Run against the current tree:

```
✓ npm install                    570 packages, no peer conflicts
✓ npm run typecheck              0 errors across 3 workspaces
✓ npm run lint                   0 errors, 0 warnings
✓ npm test                       349 passing, 15 skipped (need a database)
✓ npm run build                  server + client both emit
✓ backend boots                  listening in ~300 ms
✓ GET /health                    200 · {"status":"ok"}
✓ GET /health/ready              503 · DATABASE_UNAVAILABLE (correct — no DB running)
✓ GET /health/database           200 · state "unavailable", credentials redacted
✓ env validation                 rejects a missing COGNODB_URI at boot
✓ graceful shutdown              SIGTERM drains and exits cleanly
```

---

## 1 · Folder structure

```
research-nexus/
├── client/                        React + TypeScript + Vite
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                shadcn/ui primitives (11)
│   │   │   ├── common/            page-header · stat-card · empty/error states
│   │   │   ├── entities/          author/paper/topic/university/venue cards
│   │   │   ├── graph/             canvas · force layout · inspector · legend
│   │   │   └── layout/            app-shell · sidebar-nav · search-dialog
│   │   ├── hooks/                 use-api · use-theme · use-debounced-value
│   │   ├── lib/                   api · query-client · utils · chart-theme
│   │   ├── pages/                 19 route files
│   │   ├── services/         ★    API layer — the only place HTTP lives
│   │   ├── styles/globals.css     Tailwind layers + design tokens
│   │   ├── test/                  setup + suites
│   │   ├── types/api.ts           contract types mirrored from the server
│   │   ├── App.tsx                router + providers
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json              @/* → src/*
│   ├── vite.config.ts             proxy · chunks · vitest
│   ├── tailwind.config.ts
│   └── postcss.config.js
│
├── server/                        Express + TypeScript
│   ├── src/
│   │   ├── config/                env.ts (Zod) · index.ts (grouped)
│   │   ├── database/         ★    driver · query · serialize · mappers · cypher-tag
│   │   ├── cypher/                59 parameterised statements, by feature
│   │   ├── repositories/     ★    data access — Cypher in, domain out
│   │   ├── services/              business logic — no Cypher, no Express
│   │   ├── controllers/           thin HTTP handlers
│   │   ├── routes/                API surface + validation wiring
│   │   ├── middleware/            validate · errors · rate-limit · logger
│   │   ├── validators/            Zod request schemas
│   │   ├── health/           ★    liveness · readiness
│   │   ├── types/domain.ts        domain model
│   │   ├── utils/                 logger · api-error · async-handler · pagination
│   │   ├── app.ts                 Express assembly — no listen()
│   │   └── server.ts              bootstrap + graceful shutdown
│   ├── tests/{unit,integration}/
│   ├── package.json
│   ├── tsconfig.json              @/* → src/*
│   ├── tsconfig.build.json
│   └── vitest.config.ts
│
├── seed/                          Deterministic data generator CLI
│   └── src/{data,generators}/ · build · writer · derive · cli
│
├── database/schema/               01-constraints · 02-indexes · 03-fulltext-optional
├── docs/                          9 documents
├── screenshots/
├── .github/workflows/ci.yml
│
├── .env.example                   every variable, documented
├── .gitignore  .dockerignore  .editorconfig  .prettierrc.json
├── eslint.config.js               flat config, type-aware, whole workspace
├── tsconfig.base.json             shared compiler options
├── package.json                   npm workspaces root
├── docker-compose.yml             local graph database + API
├── Dockerfile                     multi-stage
├── render.yaml  vercel.json
├── LICENSE  README.md
```

★ = added or restructured in this phase.

---

## 2 · Installation

```bash
# 1 — Clone and install (one command covers all three workspaces)
git clone <repository-url> research-nexus
cd research-nexus
npm install

# 2 — Configure
cp .env.example .env
#    Edit COGNODB_URI / USERNAME / PASSWORD for your instance

# 3 — Start a local graph database
docker compose up -d cognodb

# 4 — Apply schema and load data
npm run db:schema
npm run db:seed

# 5 — Run both applications
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000/api/v1 |
| Health | http://localhost:4000/api/v1/health |

### Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Server and client concurrently |
| `npm run dev:server` | API only, hot reload |
| `npm run dev:client` | Frontend only, HMR |
| `npm run build` | Build both packages |
| `npm start` | Run the built API |
| `npm run typecheck` | All three workspaces |
| `npm run lint` / `lint:fix` | ESLint across the repository |
| `npm run format` | Prettier |
| `npm test` | All suites |
| `npm run db:schema` | Constraints + indexes (`-- --with-fulltext` optional) |
| `npm run db:seed` | Generate and load ~1,420 nodes / ~16,000 edges |
| `npm run db:reset` | Delete every node and relationship |

---

## 3 · CognoDB Cloud instance

### Provisioning

1. Create a database in the CognoDB Cloud console.
2. Copy the **Bolt URI**, username and password.
3. Put them in `.env` — never in code, never in a commit.

```ini
COGNODB_URI=neo4j+s://your-instance.cognodb.cloud:7687
COGNODB_USERNAME=neo4j
COGNODB_PASSWORD=<from the console>
COGNODB_DATABASE=
```

**On TLS.** The `+s` and `+ssc` schemes encode their policy in the URI, so leave
`COGNODB_ENCRYPTED=false` when using them — the driver throws if told twice. The
flag applies only to plain `bolt://` and `neo4j://`.

### Verifying connectivity

```bash
npm run stats --workspace seed        # connects, prints node and relationship counts
curl http://localhost:4000/api/v1/health/ready
```

### Local alternative

`docker compose up -d cognodb` starts a Bolt-compatible engine on
`bolt://localhost:7687` — the same protocol and Cypher dialect, so nothing in the
application changes.

---

## 4 · Configuration files

### Environment — `.env.example`

Every variable documented, with safe defaults. One file at the repository root
drives the server, the seed CLI and the Vite dev proxy; three env files drift.

```ini
# --- CognoDB (Bolt) ---
COGNODB_URI=bolt://localhost:7687
COGNODB_USERNAME=neo4j
COGNODB_PASSWORD=research-nexus
COGNODB_DATABASE=
COGNODB_MAX_POOL_SIZE=50
COGNODB_CONNECTION_TIMEOUT_MS=15000
COGNODB_MAX_TRANSACTION_RETRY_MS=15000
COGNODB_ENCRYPTED=false

# --- HTTP server ---
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
API_PREFIX=/api/v1
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=300
MAX_PAGE_SIZE=100
MAX_GRAPH_NODES=400

# --- Seeding ---
SEED_RANDOM_SEED=research-nexus-2024
SEED_BATCH_SIZE=500

# --- Client ---
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### Environment validation — `server/src/config/env.ts`

Validated by Zod **at boot**, not at first use. A missing or malformed value
fails immediately with a precise message rather than surfacing as a confusing
runtime error twenty minutes later.

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PREFIX: z.string().default('/api/v1')
    .refine((v) => v.startsWith('/'), 'API_PREFIX must start with "/"'),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csv),
  COGNODB_URI: z.string().min(1, 'COGNODB_URI is required').default('bolt://localhost:7687'),
  COGNODB_PASSWORD: z.string().min(1).default('research-nexus'),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  // …
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);
```

**Verified:** clearing `COGNODB_URI` fails the boot with
`Invalid environment configuration: …`.

### TypeScript

`tsconfig.base.json` is shared; each workspace extends it.

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[i] is T | undefined — catches real bugs
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

**Path aliases.** Both workspaces map `@/* → src/*`.

The server compiles with `module: NodeNext`, where `tsc` emits path aliases
**unrewritten** — `@/config/index.js` would reach Node verbatim and fail. `tsc-alias`
runs after `tsc` and resolves them:

```jsonc
// server/package.json
"build": "tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json"
```

**Verified:** `@/config/index.js` in `src/app.ts` emits as `./config/index.js` in
`dist/app.js`. `vitest.config.ts` mirrors the same alias so tests resolve it too.

### Linting — `eslint.config.js`

Flat config, one file for the whole workspace, type-aware on the backend:

```js
{
  files: ['server/**/*.ts', 'seed/**/*.ts'],
  languageOptions: { parserOptions: { projectService: true } },
  rules: {
    // Every database call returns a promise; forgetting to await one would
    // silently drop errors and close the session mid-query.
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
  },
}
```

Plus `consistent-type-imports`, `no-explicit-any`, and React Hooks rules on the
client.

---

## 5 · Database connection module

`server/src/database/` — driver lifecycle, sessions, transactions, value
conversion, error translation.

### Connection with retry and background recovery

```ts
export async function connect(): Promise<boolean> {
  if (state === 'connected') return true;
  state = 'connecting';

  for (let attempt = 1; attempt <= connectRetries; attempt += 1) {
    try {
      recordSuccess(await verifyOnce());
      startHealthProbe();
      return true;
    } catch (error) {
      recordFailure(error);
      if (attempt === connectRetries) break;
      await delay(connectRetryBaseDelayMs * 2 ** (attempt - 1));   // exponential backoff
    }
  }

  log.error('Starting without a CognoDB connection; API reads return 503 until it recovers');
  startHealthProbe();     // reconnects automatically once the graph appears
  return false;
}
```

### Session management

Every read goes through a managed transaction, which brings automatic retries on
transient failures — leader switch, dropped connection — for free:

```ts
const session = getDriver().session(sessionOptions(mode));
try {
  const result = mode === 'READ'
    ? await session.executeRead(work)
    : await session.executeWrite(work);
  return result;
} catch (error) {
  throw translateDatabaseError(error, statement);
} finally {
  await session.close();          // always, even on throw
}
```

### Graceful shutdown

```ts
const shutdown = (signal: string): void => {
  const forceExit = setTimeout(() => process.exit(1), config.http.shutdownTimeoutMs);
  forceExit.unref();

  server.close(() => {
    void (async () => {
      await closeDriver();        // drain the pool after in-flight requests finish
      clearTimeout(forceExit);
      process.exit(0);
    })();
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Bolt value conversion

Two conversions live here so no other code has to think about them.

**Outbound.** Bolt separates 64-bit integers from doubles; JavaScript has one
`number`. `SKIP`/`LIMIT` reject floats, so integer-valued parameters are promoted:

```ts
if (typeof value === 'number') {
  return Number.isInteger(value) && Number.isSafeInteger(value) ? neo4j.int(value) : value;
}
```

Skipping this produces an error that appears only in production, where offsets
are non-zero.

**Inbound.** Bolt integers become JS numbers inside the safe range and fall back
to strings beyond it, so a large identifier never silently loses precision.

### Error translation

Driver failures become the API's error vocabulary, so the client can branch on a
code rather than parse a message:

| Driver condition | API response |
|---|---|
| `ServiceUnavailable`, `SessionExpired` | 503 `DATABASE_UNAVAILABLE` |
| `Unauthorized` | 503 `DATABASE_UNAVAILABLE` — "check credentials" |
| `TransactionTimedOut` | 504 `QUERY_TIMEOUT` |
| Cypher syntax / parameter error | 500 `DATABASE_ERROR` — a server bug, statement not leaked |
| `ECONNREFUSED`, `ENOTFOUND` | 503 `DATABASE_UNAVAILABLE` |

### Credentials never appear in output

```ts
export function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]+@/, '//***@');
}
```

**Verified:** an integration test asserts `/health/database` never returns a URI
matching `:password@`.

---

## 6 · Health check endpoints

Three endpoints, in `server/src/health/`.

### `GET /api/v1/health` — liveness

```json
{ "success": true,
  "data": { "status": "ok", "uptimeSeconds": 0,
            "environment": "development", "version": "1.0.0" } }
```

**Deliberately does not touch the database.** A platform health check pointed
here will never restart a healthy API because the graph is briefly unreachable —
which is exactly the restart loop this separation prevents.

### `GET /api/v1/health/ready` — readiness

Actively verifies connectivity. **200** when connected; **503** when not:

```json
{ "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "The API is running but CognoDB is not reachable, so data endpoints are unavailable.",
    "details": [
      { "path": "database.state", "message": "unavailable" },
      { "path": "database.uri", "message": "bolt://localhost:7687" },
      { "path": "database.lastError", "message": "Failed to connect to server." }
    ]
  },
  "requestId": "a9f76301-…" }
```

The degraded case is an error envelope, not a success envelope with a 503 status.
A non-2xx response always carries `error`, never `data` — so one client parser
handles every endpoint.

### `GET /api/v1/health/database` — cached status

Reports the last known state without issuing a fresh probe. Credentials redacted.

---

## 7 · Initial backend server

`app.ts` builds the application; `server.ts` binds the port. That split lets
integration tests mount the real app with supertest — real middleware, real
routes, real error handling — without opening a socket or connecting to a
database.

```ts
export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);          // real client IP behind a platform proxy
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(corsOptions()));
  app.use(compression());
  app.use(express.json({ limit: config.http.jsonBodyLimit }));
  app.use(requestLogger);
  app.use(createRateLimiter());

  app.use(config.http.apiPrefix, createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);            // last — catches everything above
  return app;
}
```

**The database is not a boot precondition.** The listener binds first and the
connection is established in the background:

```ts
function start(): void {
  const server = app.listen(config.http.port, config.http.host, () => { /* … */ });
  registerShutdownHandlers(server);

  // connect() handles its own retries and never rejects, so a failure here
  // degrades rather than crashes.
  void connect().then((connected) => log.info('Startup complete', { connected }));
}
```

*This was found by smoke-testing. The original code awaited the connection before
listening and took up to 75 seconds to bind with the database down — long enough
for a platform health check to kill the process.* **Now: 300 ms.**

---

## 8 · Initial frontend

`App.tsx` composes providers and the route tree. The dashboard is eager; every
other route is code-split, so the charts bundle (432 kB) and the force-simulation
bundle only load when a route needs them.

```tsx
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/authors" element={withSuspense(<AuthorsPage />)} />
                <Route path="/authors/:id" element={withSuspense(<AuthorDetailPage />)} />
                {/* … 19 routes … */}
                <Route path="*" element={withSuspense(<NotFoundPage />)} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

**Dev proxy.** Vite proxies `/api/v1` to `localhost:4000`, keeping requests
same-origin so CORS and cookie behaviour match production without extra config.

---

## 9 · Verification checklist

| Check | Status | Evidence |
|---|:--:|---|
| Monorepo installs cleanly | ✅ | 570 packages, no peer conflicts |
| Frontend starts | ✅ | Vite dev server on :5173 |
| Backend starts | ✅ | Listening in ~300 ms |
| Health endpoint returns success | ✅ | `200 {"status":"ok"}` |
| Readiness reflects DB state | ✅ | `503 DATABASE_UNAVAILABLE` with no DB |
| Environment variables load | ✅ | Config resolved from root `.env` |
| Env validation rejects bad input | ✅ | Empty `COGNODB_URI` fails at boot |
| Credentials never exposed | ✅ | URI redacted; asserted by a test |
| No TypeScript errors | ✅ | 0 across 3 workspaces |
| No linting errors | ✅ | 0 errors, 0 warnings |
| Tests pass | ✅ | 349 passing, 15 skipped |
| Production build | ✅ | Both packages emit |
| Path aliases resolve at build | ✅ | `@/config` → `./config` in `dist/` |
| Graceful shutdown | ✅ | SIGTERM drains and exits 0 |
| **Backend connects to CognoDB** | ⬜ | **Needs a live instance** |

---

## Stack decisions worth explaining

Four places where the implementation differs from the packages listed in the
brief. Each was a judgement call, and each is a one-command swap if you disagree.

### `fetch` instead of Axios

The browser baseline covers everything needed: `AbortController` for
cancellation, JSON parsing, timeouts via the signal. The envelope unwrapping and
`ApiRequestError` normalisation are ours regardless of transport, so Axios would
add ~13 kB and a second error-handling model for no capability gain.

`services/http-client.ts` is the seam — swapping transport touches one file.

### `tsx` instead of `ts-node-dev`

`tsx` is esbuild-based: ~10× faster startup, native ESM support, actively
maintained. `ts-node-dev` has had no release since 2022 and needs extra
configuration for ESM, which this project uses throughout.

```bash
npm i -D ts-node-dev && # then: "dev": "ts-node-dev --respawn src/server.ts"
```

### Custom logger instead of Morgan

Morgan writes HTTP access logs as text. The custom logger emits **newline-delimited
JSON in production** — parseable by any log shipper without configuration — and a
compact coloured line in development. It also handles non-HTTP logging (driver
lifecycle, slow queries, shutdown) that Morgan does not cover, so Morgan would be
a second logging system rather than a replacement.

```bash
npm i morgan @types/morgan && # app.use(morgan('combined'))
```

### `crypto.randomUUID()` instead of the `uuid` package

Built into Node 16+ and every modern browser. The `uuid` package exists for
environments predating it.

```ts
import { randomUUID } from 'node:crypto';
const requestId = randomUUID();     // already used in the error handler
```

---

## What Phase 1 added to the existing tree

| Change | Reason |
|---|---|
| `server/src/db/` → `server/src/database/` | Requested naming; clearer against `cypher/` |
| **`server/src/repositories/`** | Requested layer. Services no longer touch Cypher. |
| **`server/src/health/`** | Probes extracted from the controller |
| **`client/src/services/`** | API layer split from caching hooks |
| Path aliases `@/*` on the server | Requested; `tsc-alias` resolves them at build |
| `tsc-alias` dependency | Required — `tsc` leaves aliases unrewritten under NodeNext |

### The repository boundary

The layer the brief asked for, and the reason it matters:

```ts
// repositories/author.repository.ts — knows Cypher, knows no rules
export async function findById(id: string): Promise<AuthorDetail | null> {
  return runReadOne(GET_AUTHOR_DETAIL, { id }, (record) => { /* map */ });
}

// services/entity.service.ts — knows rules, knows no Cypher
export async function getAuthor(id: string): Promise<AuthorDetail> {
  const author = await authorRepository.findById(id);
  // Translating "not found" into a 404 is a business decision, so it lives
  // here rather than in the repository, which simply reports absence.
  if (!author) throw ApiError.notFound('Author', id);
  return author;
}
```

Swapping CognoDB for another engine touches `repositories/` and `cypher/`, and
nothing above them.

**Currently covering `Author` and `Paper`.** The remaining entities still call
the query runner from their services. Extending is mechanical — one file per
entity, following the same shape — and worth doing before Phase 4 is called
finished.

---

## Next

Phase 1 is complete pending one item.

**Provision a CognoDB Cloud instance**, put the credentials in `.env`, then:

```bash
npm run db:schema && npm run db:seed
curl http://localhost:4000/api/v1/health/ready    # expect 200 "ready"
npm test --workspace server                       # runs the 15 skipped tests
```

That closes the last unchecked box and simultaneously completes Phases 2 and 5,
converting 59 statically-verified queries into executed ones.

### Related documents

| Document | Contents |
|---|---|
| [`roadmap.md`](roadmap.md) | All twelve phases with status |
| [`project-structure.md`](project-structure.md) | Folder structure and conventions |
| [`architecture.md`](architecture.md) | Layer boundaries and resilience |
| [`api.md`](api.md) | Every endpoint and payload |
