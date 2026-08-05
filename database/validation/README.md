# Validation

Reusable checks over a loaded graph.

| File | Purpose |
|---|---|
| `01-integrity.cypher` | Node/relationship presence, orphans, required relationships, endpoint labels, duplicates, temporal consistency, derived-counter accuracy |
| `02-schema-objects.cypher` | Constraint and index verification (advisory) |

```bash
npm run db:validate
```

Every check returns `check`, `status` (`PASS`/`FAIL`) and enough context to act.
The runner exits non-zero if any check fails, so it can gate a deployment.

## What these catch that constraints cannot

Constraints prevent duplicates **at write time**. These detect the failures a
constraint cannot express:

- **Orphan nodes** — a node with no relationships contributes to no traversal
- **Missing required relationships** — a paper with no author, a project with no funder
- **Wrong endpoint labels** — the most damaging modelling error, because queries
  silently return nothing rather than failing
- **Derived-counter drift** — `citationCount` disagreeing with the `CITES` edges
  it summarises, which means the derivation pass did not run
- **Reciprocal undirected edges** — `COLLABORATED_WITH` stored twice, where the
  two copies can disagree about `paperCount`

## When to run

| Moment | Why |
|---|---|
| After `db:seed` | Confirms the load produced a coherent graph |
| In CI, after seeding | Gates a merge on graph integrity |
| Before a production deploy | Catches a skipped schema step |
| After any ingestion job | Detects drift introduced by new data |
