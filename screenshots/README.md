# Screenshots

UI captures referenced from the main [README](../README.md). Filenames below are
linked from there — keep them exact.

## Regenerating

The seed is deterministic, so the same `SEED_RANDOM_SEED` always produces the
same data — screenshots taken from different machines show identical content.

```bash
npm run db:schema
npm run db:seed
npm run db:validate   # must be green before capturing
npm run dev
```

## Capture settings

| Setting | Value |
| ------- | ----- |
| Viewport | 1440 × 900 |
| Theme | Dark, except where the table says otherwise |
| Format | PNG, compressed (`pngquant`, or squoosh.app) |
| Target size | Under 500 KB each |

Capture the viewport only — no desktop, no bookmarks bar, no notifications.

For the graph explorer, let the force simulation settle before capturing, then
press fit-to-view so the whole subgraph is in frame.

## Required

| # | File | Route | Must show |
| - | ---- | ----- | --------- |
| 1 | `dashboard.png` | `/` | Stat tiles with real numbers, trending topics |
| 2 | `search.png` | any route, ⌘K | Grouped results, highlighted matched text |
| 3 | `author-detail.png` | `/authors/author-0001` | Collaborators, papers, topics populated |
| 4 | `paper-detail.png` | `/papers/paper-0001` | Citation counts, authors, venue |
| 5 | `topic-detail.png` | `/topics/topic-0001` | Ranked experts, similar topics |
| 6 | `collaboration.png` | `/collaboration` | Hidden collaborators with their reasons |
| 7 | `citations.png` | `/citations` | A citation chain expanded |
| 8 | `graph-explorer.png` | `/graph` | Canvas mid-exploration, node inspector open |
| 9 | `graph-layouts.png` | `/graph` | A non-force layout — radial reads best |
| 10 | `recommendations.png` | `/recommendations` | Scored results with reasons visible |
| 11 | `path-finder.png` | `/paths` | A found path between two researchers |
| 12 | `analytics.png` | `/analytics` | Charts and the institution table |
| 13 | `mobile-dashboard.png` | `/` at 390 × 844 | Sidebar collapsed to the drawer |
| 14 | `light-theme.png` | any detail page | Same layout, light palette |
| 15 | `error-state.png` | any page, API stopped | Database-unavailable panel with recovery actions |

Shots 13–15 are the ones most submissions omit, and they are exactly the ones
that demonstrate responsive design, theming and failure handling actually work.

## Optional

| File | Shows |
| ---- | ----- |
| `graph-edge-inspector.png` | Relationship details after clicking an edge |
| `empty-state.png` | A no-results state with its suggested next action |
| `health-ready.png` | `/api/v1/health/ready` JSON in a browser |

## After capturing

1. Compress every file.
2. Confirm each renders in the README preview.
3. Commit them — these are part of the submission, not build artefacts, which is
   why they are deliberately not gitignored.
