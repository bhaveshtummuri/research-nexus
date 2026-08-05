# Deployment Runbook

Frontend on Vercel, API on Render, graph on a managed CognoDB instance. Follow
top to bottom; every command is copy-pasteable.

Estimated time: **25 minutes**, most of it waiting for builds.

---

## Topology

```
Browser ──HTTPS──> Vercel (static SPA)
                      │
                      └──HTTPS──> Render (Express API)
                                     │
                                     └──Bolt+TLS──> CognoDB
```

The client is a static bundle with no server runtime, so it goes to a CDN. The
API is the only thing holding database credentials — the browser never sees them
and never speaks Bolt.

---

## 1. Provision CognoDB

1. Create an instance in the CognoDB console.
2. Record the four values it gives you:

   | Value | Looks like |
   | ----- | ---------- |
   | Connection URI | `bolt+s://db-xxxxxxxx.databases.cognodb.com` |
   | Username | `neo4j` |
   | Password | *(generated)* |
   | Database | usually blank — leave unset unless the console names one |

**Use the `bolt+s://` scheme for a managed instance.** It carries the TLS policy
in the URI, which is what the driver expects; a plain `bolt://` against a managed
host fails the handshake.

---

## 2. Apply schema and seed

Run locally against the managed instance — there is no need to seed from CI.

```bash
git clone <your-repo-url> && cd research-nexus
npm ci
cp .env.example .env
```

Edit `.env`:

```dotenv
COGNODB_URI=bolt+s://db-xxxxxxxx.databases.cognodb.com
COGNODB_USERNAME=neo4j
COGNODB_PASSWORD=your-password
```

Then:

```bash
npm run db:schema     # constraints and indexes
npm run db:seed       # ~1,420 nodes, ~16,000 relationships
npm run db:validate   # confirms counts and referential integrity
```

`db:validate` must report every check green before you continue. Deploying
against an unseeded graph produces an app where every page is an empty state.

---

## 3. Deploy the API to Render

The blueprint is committed at [`render.yaml`](../render.yaml).

1. Push the repository to GitHub.
2. Render → **New → Blueprint** → select the repository.
3. Render reads `render.yaml` and pre-fills the build. Supply the five values
   marked `sync: false`:

   | Key | Value |
   | --- | ----- |
   | `COGNODB_URI` | from step 1 |
   | `COGNODB_USERNAME` | from step 1 |
   | `COGNODB_PASSWORD` | from step 1 |
   | `COGNODB_DATABASE` | leave empty unless the console named one |
   | `CORS_ORIGINS` | *leave empty for now* — filled in at step 5 |

4. Deploy, and wait for the health check at `/api/v1/health` to go green.

Verify:

```bash
curl https://research-nexus-api.onrender.com/api/v1/health
curl https://research-nexus-api.onrender.com/api/v1/health/ready
```

`/health` must return `200` immediately. `/health/ready` returning `503` means
the API is up but cannot reach the database — check the three `COGNODB_*` values
before going further.

> **Free tier:** Render idles a free service after 15 minutes without traffic.
> The next request pays a 30–50 second cold start. This is expected, and worth
> mentioning if you demo it.

---

## 4. Deploy the frontend to Vercel

Configuration is committed at [`vercel.json`](../vercel.json).

1. Vercel → **Add New → Project** → select the repository.
2. Leave the framework preset as **Other** — `vercel.json` supplies the build.
3. Add one environment variable:

   | Key | Value |
   | --- | ----- |
   | `VITE_API_BASE_URL` | `https://research-nexus-api.onrender.com/api/v1` |

4. Deploy.

The variable is read at **build** time, not runtime. Changing it later requires a
redeploy, not just a restart.

---

## 5. Close the CORS loop

The API refuses cross-origin requests from unlisted origins, so it must be told
the frontend's URL — which did not exist until step 4.

In Render, set:

```
CORS_ORIGINS=https://your-project.vercel.app
```

Add any custom domain as a comma-separated second entry. Save; Render restarts
the service automatically.

---

## 6. Verify the deployment

Work through this list against the live URLs. Each line is a distinct failure
mode, not busywork.

### API

```bash
API=https://research-nexus-api.onrender.com/api/v1

curl -s $API/health | jq .data.status              # "ok"
curl -s $API/health/ready | jq .data.database      # state: "connected"
curl -s "$API/authors?limit=3" | jq '.data | length'
curl -s "$API/search?q=learning" | jq .data.totalHits
curl -s "$API/graph?limit=40" | jq '.data.nodes | length'
curl -s $API/analytics/dashboard | jq .data.totals
```

### CORS

```bash
curl -sI -H "Origin: https://your-project.vercel.app" \
  $API/authors | grep -i access-control-allow-origin
```

An empty result means `CORS_ORIGINS` is wrong, and the browser will fail every
request while `curl` keeps working — the most confusing failure in this stack.

### Frontend

| Check | Where | Passing looks like |
| ----- | ----- | ------------------ |
| Dashboard loads | `/` | Stat tiles show real numbers, not dashes |
| Global search | `⌘K`, type "learning" | Grouped results with highlighted matches |
| Author profile | `/authors` → any row | Collaborators, papers, topics all populated |
| Paper explorer | `/papers` → any row | Citation counts, authors, venue |
| Topic explorer | `/topics` → any row | Experts and similar topics listed |
| Collaboration | `/collaboration` | Pick a researcher — network renders |
| Citations | `/citations` | Pick a paper — chains render in both directions |
| Graph explorer | `/graph` | Canvas paints; double-click expands a node |
| Recommendations | `/recommendations` | Scored results with reasons |
| Path finder | `/paths` | Two researchers — a path or a clean "none found" |
| 404 | `/nonsense` | Styled not-found page, not a blank screen |

### End-to-end workflow

The single pass worth doing before submitting:

1. Open the dashboard; confirm totals are non-zero.
2. `⌘K` → search an author → open their profile.
3. From the profile, open a collaborator.
4. Switch to the graph explorer with that author focused.
5. Expand a node; confirm new neighbours merge in.
6. Open recommendations for the same author; confirm the reasons make sense.
7. Toggle the theme; confirm the canvas re-paints in the new palette.

If all seven work against the deployed URLs, the deployment is sound.

---

## Environment variables

### API (Render)

| Key | Required | Default | Notes |
| --- | -------- | ------- | ----- |
| `COGNODB_URI` | ✅ | — | `bolt+s://` for managed instances |
| `COGNODB_USERNAME` | ✅ | — | |
| `COGNODB_PASSWORD` | ✅ | — | |
| `COGNODB_DATABASE` | | *(unset)* | Only if the console names one |
| `CORS_ORIGINS` | ✅ | — | Comma-separated; no trailing slash |
| `NODE_ENV` | | `production` | Set by the blueprint |
| `PORT` | | `4000` | Render overrides this |
| `LOG_LEVEL` | | `info` | `debug` prints every query |
| `MAX_PAGE_SIZE` | | `100` | |
| `MAX_GRAPH_NODES` | | `400` | Ceiling on one traversal |
| `RATE_LIMIT_MAX_REQUESTS` | | `300` | Per window, per IP |

### Frontend (Vercel)

| Key | Required | Notes |
| --- | -------- | ----- |
| `VITE_API_BASE_URL` | ✅ | Include `/api/v1`. Build-time only. |

---

## Production hardening already in place

| Concern | Handling |
| ------- | -------- |
| Credentials in logs | Bolt URIs are redacted before logging or reaching `/health` |
| CORS | Allow-list only; no wildcard in production |
| Headers | Helmet on the API; CSP-adjacent headers on Vercel |
| Rate limiting | Per-IP window, advertised in response headers |
| Payload size | Traversals capped at `MAX_GRAPH_NODES` server-side |
| Error leakage | No stack traces in responses; request ids for correlation |
| Database outage | 503 with a machine-readable code, never a 500 |
| Connection loss | Immediate reconnect; requests mid-reconnect wait rather than fail |
| Liveness vs readiness | Separate probes, so an outage does not trigger a restart loop |
| Cold start | Health check path configured so Render warms the instance |

---

## Troubleshooting

**`/health/ready` returns 503 but `/health` is fine.**
The API is up and the database is not. Check the three `COGNODB_*` values in
Render. The most common cause is a `bolt://` scheme against a managed instance
that requires `bolt+s://`.

**Frontend loads but every panel shows "Cannot reach the API".**
`VITE_API_BASE_URL` is wrong or was changed without redeploying. It is baked in
at build time. Confirm it ends in `/api/v1`.

**`curl` works but the browser gets network errors.**
CORS. `CORS_ORIGINS` must match the browser's origin exactly — scheme included,
no trailing slash.

**First request after idle takes ~40 seconds.**
Render free-tier cold start. Expected. Hit `/health` a minute before demoing.

**Connection resets under load (`ECONNRESET`).**
Free-tier CognoDB rate-limits at the connection level. Space out requests, or
move to a paid tier. The API already recovers automatically once the limit
clears.

**Everything is empty but nothing errors.**
The graph was never seeded, or was seeded into a different database. Run
`npm run db:validate` against the same URI the API is using.

**Build fails on Render with a workspace error.**
The build must run from the repository root — `npm ci && npm run build:server`.
Running it from inside `server/` cannot resolve the npm workspace.
