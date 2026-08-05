# Design System & UX Architecture

The rules that keep fifteen pages looking like one product, and the reasoning
behind the ones that are not obvious.

Everything here lives under [`client/src/`](../client/src/).

---

## Tokens

No component names a colour. Every value resolves through a CSS custom property
declared in [`globals.css`](../client/src/styles/globals.css) and exposed to
Tailwind through [`tailwind.config.ts`](../client/tailwind.config.ts).

That indirection is what makes the light theme possible. A single `light` class
on `<html>` re-points every variable; there is no second set of Tailwind colours
to keep in sync, so the two themes cannot drift.

| Group | Tokens | Notes |
| ----- | ------ | ----- |
| Surfaces | `background`, `surface`, `surface-muted`, `surface-raised` | Four depths. Anything needing a fifth is a sign the hierarchy is wrong. |
| Text | `foreground`, `muted-foreground` | Two weights. Tertiary text is `muted-foreground` at reduced opacity. |
| Line | `border`, `input`, `ring` | `ring` is also the primary hue, so focus always reads as interactive. |
| Intent | `primary`, `destructive`, `success`, `warning` | Each with a `-foreground` pair, so contrast is guaranteed at the point of use. |
| Entities | `graph-author`, `graph-paper`, … (10) | One hue per node label, shared by the canvas, badges and legends. |

**Radius** is derived, not enumerated: `--radius` is the large value and `md`/`sm`
are computed from it. Changing one number rescales the whole product.

**Shadows** are three named elevations (`subtle`, `raised`, `overlay`) tinted with
`--shadow` rather than black — a neutral-black shadow over a blue-grey surface
reads as dirt.

### Typography

Inter, with `cv02/cv03/cv04/ss01` enabled — those features give a single-storey
`a` and a straight-tailed `l`, which is what stops `Il1` ambiguity in author
names and identifiers. The scale is Tailwind's default plus one addition, `2xs`
(0.6875rem), for metadata lines. Numeric columns use `tabular-nums` so digits do
not jitter as values change.

---

## Component layers

```
components/
├── ui/         # unstyled-ish primitives: button, input, select, table, dialog…
├── common/     # app-level patterns: empty states, error states, skeletons
├── entities/   # one card per node label
├── graph/      # canvas renderer and its controls
└── layout/     # shell, sidebar, breadcrumbs, command palette
```

The rule is one-directional: `entities` and `graph` may use `common` and `ui`;
`ui` uses nothing above it. A primitive that reaches back up for an app concept
is no longer reusable.

---

## The four states of any view

Every data surface handles all four. Skipping one is the most common way a UI
feels unfinished.

| State | Component | Rule |
| ----- | --------- | ---- |
| Loading | `*Skeleton` | Shape must match the content, or arrival causes a layout jump. |
| Empty | `EmptyState` + preset | Must say *why* it is empty and offer a next action. |
| Error | `ErrorState` / `ErrorScreen` | Must name the cause and offer recovery. |
| Loaded | the page | — |

### Loading

[`loading.tsx`](../client/src/components/common/loading.tsx) exports a skeleton
per layout: list, card grid, table, detail, list page, chart, graph.

Two decisions worth stating:

**Skeletons are `aria-hidden` behind a single live-region announcement.** A
screen reader gains nothing from twelve grey rectangles; it needs the sentence
"Loading table". Every skeleton is wrapped in a `role="status"` region that says
that once.

**The graph skeleton draws a graph.** Nodes and edges rather than a grey box,
because it sets the expectation for a surface whose first paint can genuinely
take a second. The coordinates are fixed rather than random so the placeholder
does not reshuffle on every re-render while the query is in flight.

For data arriving *on top of* data already on screen, `RefreshingOverlay` dims
the existing content instead of replacing it with a skeleton — a paginated list
that blanks between pages reads as "starting over" rather than "updating".

### Empty

`EmptyState` takes a title, a description, an icon and an action. The presets in
[`empty-state.tsx`](../client/src/components/common/empty-state.tsx) —
`NoResults`, `NoPathFound`, `NoCitations`, `NoRecommendations`, `NoGraphData`,
`AwaitingSelection` — exist so the same condition is worded the same way
everywhere.

The description carries the *why*, and this matters more in a graph product than
most: "no collaboration path found" is ambiguous between "these two have never
been connected" and "your hop limit was too low". The first is a fact about the
data, the second is a setting the user can change, and only one of them deserves
a retry button. The presets say which.

### Error

One diagnosis function, `describeFailure`, backs both the inline `ErrorState`
panel and the full-page `ErrorScreen`. Two wordings for one condition is how an
interface starts feeling incoherent, so a database outage reads identically
whether it takes down one card or the whole route.

It switches on the API's machine-readable `code`, never on message text:

| Condition | Code | Advice given |
| --------- | ---- | ------------ |
| Network unreachable | `NETWORK_ERROR` | Check the connection and that the API is running |
| Request stalled | `TIMEOUT` | Narrow the depth or result limit |
| Graph down | `DATABASE_UNAVAILABLE` | Check `COGNODB_URI` and credentials |
| Server fault | `>= 500` | Report the request id, which is shown |
| Render crash | *(not an API error)* | Reload; technical detail collapsed below |

---

## Error boundaries

React unmounts the whole tree when a render throws and nothing catches it. Before
this phase the app had no boundary at all, so any render-time exception produced
a white page with no route back.

[`ErrorBoundary`](../client/src/components/common/error-boundary.tsx) is the
codebase's one class component — there is still no hook equivalent for this.

**`resetKey` is what makes it usable.** A boundary that latches stays latched:
every subsequent route would render the error screen instead of the page.
`RouteBoundary` passes the pathname, so navigating away clears the error.

The subtle part is *when* to clear. Comparing `resetKey` against the previous
render's value resets the boundary on the very render that caught the error, and
loops. So the key is snapshotted at throw time and compared against that. There
is a test pinning this exact behaviour.

`PanelBoundary` wraps the graph canvas specifically — the one surface doing
enough per frame to be worth isolating. A failure there costs the canvas, not the
controls and inspectors the user needs to recover.

---

## Notifications

All toasts go through [`notify.ts`](../client/src/lib/notify.ts) rather than
calling `sonner` directly.

**One meaning per level.** Success confirms something finished; info reports a
fact the user did not ask about; warning flags a degraded result they can still
use; error means the action did not happen. Call sites choosing freely is how a
product ends up with red toasts for non-failures.

**Durations follow severity** — 3s success through 8s error. An error needs to
survive being read twice.

**Dedup ids.** A query retried three times must produce one toast, not three.

The load-bearing distinction: **toasts are for transitions, panels are for
conditions.** Something *happened* → toast. Something *is wrong* → an
`ErrorState` that stays visible. This is why a failing query renders a panel but
does not toast, with one exception: infrastructure failures are toasted globally
from the `QueryCache`, because "the backend is unreachable" is the single cause
behind every panel on the page failing at once, and saying it once is clearer
than saying it eight times.

The truncation warning on the graph explorer is the clearest case for a toast: a
graph silently cut to the node budget looks like a complete answer, and a user
drawing conclusions from a partial neighbourhood has no other way to tell.

---

## Search

The command palette ([`search-dialog.tsx`](../client/src/components/layout/search-dialog.tsx))
is the primary way through the product.

- **Debounced at 220ms** — fast enough to feel live, slow enough that typing a
  ten-character name is one request rather than ten.
- **Matched text is marked.** Highlighting turns a result list into an
  explanation: seeing *why* a row matched is the difference between trusting the
  ranking and re-reading every entry. Rendered as `<mark>`, so the emphasis is
  announced rather than carried by colour alone.
- **Terms match independently.** The server does not require an exact phrase, so
  the highlight must not either — a two-word query highlights both words in
  whatever order the result puts them. Overlapping terms merge into one run
  rather than nesting marks.
- **History stores what was opened, not what was typed.** A half-finished query
  is rarely worth re-running; a paper looked at yesterday usually is.
- **Suggestions on first open**, so an empty palette is never a dead end.
- `⌘K` from anywhere, arrows to move, `↵` to open, `esc` to close — listed in the
  footer, because a shortcut nobody can discover is not a feature.

---

## Motion

Framer Motion for orchestration, CSS transitions for hover and focus.

Animation is used for three things only: **continuity** (page transitions),
**arrival** (staggered card entry) and **spatial explanation** (the mobile drawer
sliding from the edge it belongs to). Durations sit at 150–280ms with a
`cubic-bezier(0.16, 1, 0.3, 1)` ease — fast out, settled in.

**`prefers-reduced-motion` is honoured in both systems.** The CSS media query
already collapsed transitions, but framer-motion drives animations in JavaScript
and ignored it entirely — vestibular-disorder users were still getting every
slide and stagger. `<MotionConfig reducedMotion="user">` in `App.tsx` fixes that
globally: transforms are dropped and opacity is kept, so the interface still
communicates change without moving.

---

## Accessibility

Targeting WCAG 2.1 AA.

| Area | What is done |
| ---- | ------------ |
| Focus | Global `:focus-visible` ring with a background-coloured offset, on every interactive element. Never removed. |
| Skip link | First tab stop, jumps to `#main-content`. |
| Landmarks | One `<main>`, one `<nav>`, one `<header>`. |
| Tables | `<th scope>` by default in the primitive; a visually-hidden `<caption>`; the scroll container is focusable so it can be scrolled without a mouse. |
| Live regions | Skeletons announce loading once; search announces its result count. |
| Dialogs | Radix — focus trap, restore, `esc`, and `aria-modal` come with it. |
| Canvas | `role="application"` so arrow keys reach the app rather than the screen reader's virtual cursor. |
| Colour | Never the only encoding: node types carry a shape as well as a hue, and errors carry an icon and a heading. |
| Motion | Respected in CSS *and* JS. |

The one thing colour still does alone is the entity badge, where the label text
is adjacent — the hue is reinforcement, not the message.

---

## Responsiveness

Breakpoints are Tailwind's defaults. The layout changes at two of them:

| Width | Layout |
| ----- | ------ |
| `< 640px` | Single column; stat grids stack; the graph inspector moves below the canvas |
| `640–1024px` | Two-column grids; sidebar still a drawer |
| `≥ 1024px` | Fixed 16rem sidebar; three- and four-column grids; inspector returns to a side panel |

Two rules that are easy to get wrong:

**Tables scroll inside their own container.** A data table cannot reflow below
about 600px. Without a bounded scroll region the *page* scrolls sideways and the
entire layout — sidebar included — drifts off screen.

**Nothing depends on hover.** Every hover affordance has a tap or focus
equivalent, because a touch device has no hover state to reveal it.

---

## Performance

| Technique | Where |
| --------- | ----- |
| Route-level code splitting | Every route but the dashboard is `lazy()` |
| Route-shaped Suspense fallbacks | A list route falls back to a list skeleton, not a detail one |
| Vendor chunking | Charts, motion and the query client split out — the graph route never downloads Recharts |
| Query caching | 60s stale time, focus refetch off: the graph changes only when re-seeded |
| Retry policy | Only retryable failures; a 404 or validation error is not retried |
| Request timeout | 20s ceiling, so a stalled connection fails instead of spinning forever |
| Canvas rendering | Positions in a ref, viewport culling, level-of-detail — see [graph-visualization.md](./graph-visualization.md) |

The timeout deserves a note. `fetch` has no native one, and without a ceiling a
stalled connection leaves a spinner running indefinitely, which reads as a frozen
app rather than a failure worth retrying. The implementation merges the timer's
signal with the caller's own, and keeps the two distinguishable: a caller abort
is a cancelled query — React Query unmounting a component — and must propagate
untouched, while a timeout becomes an error the user sees. Both arrive as the
same `AbortError`, which is the trap.

---

## Testing

[`polish.test.tsx`](../client/src/test/polish.test.tsx) covers the logic that
would silently produce a wrong experience:

- The error boundary catches, does not self-clear on the catching render, clears
  on a key change, and recovers through its reset callback.
- Failure diagnosis distinguishes timeout, database, network and server faults.
- A stalled request becomes `TIMEOUT`; a caller cancellation stays an abort.
- Highlighting is case-insensitive, order-independent, merges overlaps, and does
  not treat query punctuation as a regular expression.
- Table headers carry `scope`; the caption is exposed; the scroll region is
  focusable.
- Skeletons announce once and hide their shapes.

Not covered: how any of it looks. Visual regression needs a real browser.
