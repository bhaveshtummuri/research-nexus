# Repositories

The data-access layer. A repository binds parameters to a Cypher statement,
executes it, and maps driver records into domain objects.

**Repositories know Cypher and know nothing about business rules.**
**Services know business rules and know nothing about Cypher.**

That boundary is the seam: swapping CognoDB for another engine touches
`repositories/` and `cypher/`, and nothing above them.

```
controller  →  service  →  repository  →  cypher  →  database
                  ↑            ↑
          business rules   query execution
          scoring weights  record mapping
```

A repository must never:
- apply business rules or filter on domain policy
- import Express types
- decide scoring weights

A service must never:
- import a Cypher statement
- call `runRead` / `runWrite` directly
