# Database

Schema definitions for the Research Nexus property graph.

## Files

| File                          | Applied by default | Purpose                                     |
| ----------------------------- | :----------------: | ------------------------------------------- |
| `schema/01-constraints.cypher` |        Yes        | Uniqueness constraints on ids and natural keys |
| `schema/02-indexes.cypher`     |        Yes        | Search, ranking, range and composite indexes |
| `schema/03-fulltext-optional.cypher` |   No        | Optional full-text acceleration              |

## Applying

```bash
npm run db:schema                      # constraints and indexes
npm run db:schema -- --with-fulltext   # additionally apply full-text indexes
```

Files are applied in filename order. Statements in the optional file are allowed
to fail, so running it against an engine without full-text support is a no-op
rather than an error.

Everything is idempotent — `IF NOT EXISTS` on every statement — so re-running the
command is always safe.

## Applying by hand

The files are plain Cypher and can be pasted into any Cypher shell or browser:

```bash
cat database/schema/01-constraints.cypher | cypher-shell -u neo4j -p <password>
```

## Full-text is optional on purpose

Global search runs on a portable strategy: every searchable node carries a
lowercased `searchText` property, indexed as a range index, matched with
`CONTAINS`. That works on any OpenCypher engine.

The full-text indexes in `03-fulltext-optional.cypher` are an accelerator for
deployments that support them. No application code depends on their presence.

See [`../docs/graph-model.md`](../docs/graph-model.md) for the full model.
