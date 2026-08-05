# Graph Visualization Architecture

How the interactive knowledge graph is built, why it renders the way it does,
and what happens as the graph grows.

Everything described here lives in
[`client/src/components/graph/`](../client/src/components/graph/).

---

## Why a canvas renderer rather than React Flow, Cytoscape or Sigma

The renderer is ~500 lines of immediate-mode canvas driven by
[`d3-force`](https://github.com/d3/d3-force), not a graph library. That was a
deliberate choice, and it is the first thing worth defending.

| Option | Rendering model | Cost at ~2,000 nodes |
| ------ | --------------- | -------------------- |
| **React Flow** | One DOM element per node | Layout and paint dominate the frame; unusable |
| **Cytoscape.js** | Canvas, with its own scene graph | Workable, but carries a style engine and selector layer this app does not use |
| **Sigma.js** | WebGL / canvas | Closest fit — essentially the model implemented here |
| **This renderer** | Single canvas, one repaint per frame | One `clearRect` plus N draw calls |

The decisive constraint is that the simulation mutates node positions at ~60fps.
Any renderer that maps a node to a retained object — a DOM element, or a scene
node with its own dirty tracking — pays per-element bookkeeping on every tick.
Immediate-mode canvas has no retained state to reconcile: the frame is thrown
away and repainted, so cost scales with *what is visible*, not with what exists.

React Flow was rejected outright. Its DOM-per-node model is excellent for
node-based editors of tens of nodes, and directly contradicts the requirement to
stay smooth at thousands.

Cytoscape.js was the closest real contender, mainly because it ships the layouts
(force, dagre, concentric, circle, grid) that would otherwise need writing. That
turned out to be ~250 lines — [`layouts.ts`](../client/src/components/graph/layouts.ts) —
against a full rewrite of working, tested interaction code plus a dependency
larger than the renderer it replaced.

**The honest caveat:** a library would win on breadth. Cytoscape has edge
bundling, compound nodes and a mature selector API that this renderer does not.
The choice here optimises for one interaction — explore a research neighbourhood
at speed — rather than for a general graph toolkit.

---

## Module layout

```
components/graph/
├── graph-canvas.tsx     # renderer, interaction, viewport, export/fullscreen
├── use-force-layout.ts  # d3-force simulation, positions held in a ref
├── layouts.ts           # static layout algorithms (pure functions)
├── node-shapes.ts       # shape vocabulary + geometry helpers (pure)
├── graph-minimap.tsx    # overview map with viewport rectangle
├── graph-controls.tsx   # search, filters, layout picker, depth
├── node-inspector.tsx   # selected node details
├── edge-inspector.tsx   # selected relationship details
└── citation-tree.tsx    # flattened tree view (Phase 6)
```

The split is along one axis: **pure geometry and data transforms are separated
from rendering**, so `layouts.ts`, `node-shapes.ts` and the filter reducer are
unit-testable without a canvas or a DOM. That is where the test suite lives.

---

## The render loop

React never renders a node. The simulation mutates plain objects held in a
`ref`, and a monotonic `version` counter is the only state that changes per
tick — just enough to trigger the effect that repaints.

```
d3 tick → mutate node.x/.y in ref → bump version → effect repaints canvas
```

Putting node objects in React state would reconcile the tree 60 times a second
for a graph that draws in a single call.

### Draw order and culling

Each frame:

1. Compute `visibleBounds` — the viewport in graph coordinates, plus a margin so
   partly-visible nodes and their labels do not pop in at the edge.
2. Draw edges, skipping any whose bounding box misses the viewport.
3. Draw nodes, skipping any outside the bounds.

Culling matters more than it first appears. The canvas would clip off-screen
elements anyway, but clipping still costs a path construction and a
rasterisation attempt per element. Rejecting with four comparisons first is what
keeps a pan smooth when the user has expanded well past the viewport.

### Level of detail

Detail is dropped as the view zooms out, because none of it is legible there:

| Zoom | Rendered |
| ---- | -------- |
| `> 1.35` | Relationship labels on engaged edges |
| `> 0.75` | Node labels |
| `> 0.40` | Entity shapes |
| `≤ 0.40` | Coloured dots only — the graph reads as a density map |

---

## Node and edge encoding

### Shapes carry meaning, not just colour

Every entity type has both a colour and a shape
([`node-shapes.ts`](../client/src/components/graph/node-shapes.ts)):

| Group | Types | Shape |
| ----- | ----- | ----- |
| People & organisations | Author | circle |
| | University, Dataset | hexagon |
| | FundingAgency, Project | pentagon |
| Documents | Paper, Journal, Conference | square |
| Abstractions | ResearchTopic | diamond |
| | Keyword | triangle |

Colour alone is not a sufficient encoding. Roughly one in twelve men has a
colour-vision deficiency, and ten hues at 12px are hard for *anyone* to separate.
Shape is redundant encoding: it survives greyscale, low zoom, and a dim screen.
A unit test asserts every label has a shape, because a missing entry would
silently fall back to a circle and collide with Author.

### Relationship labels

Drawn only for edges the user is engaged with — adjacent to the hovered or
selected node, on the selected edge, or on a highlighted path — and only above
1.35× zoom. Labelling every edge at once is unreadable at any zoom level. Each
label gets a filled pill behind it so it survives over dense edge bundles.

---

## Layouts

Five layouts, switchable at runtime
([`layouts.ts`](../client/src/components/graph/layouts.ts)):

| Layout | Algorithm | Reads best for |
| ------ | --------- | -------------- |
| **Force-directed** | d3-force: link, charge, collide, weak centring | Community structure — clusters emerge from the data |
| **Hierarchical** | BFS layering from a root, each layer a centred row | Citation and funding chains |
| **Radial** | Concentric rings by hop distance | Degrees of separation, readable at a glance |
| **Circular** | Single ring ordered by entity type | Cross-type density — chords through the middle are cross-type edges |
| **Grid** | Even rows and columns | Scanning a set rather than reading its structure |

Three decisions worth stating:

**Static layouts pin with `fx`/`fy`, not just `x`/`y`.** The simulation stays
alive so nodes remain draggable; pinning is what stops its forces pulling
everything back into a force arrangement on the next tick. Switching to `force`
clears the pins and hands control back. A dragged node in a static layout keeps
its new pin rather than springing back.

**The simulation starts cold under a static layout** (`alpha(0)`), because the
positions are already final and any alpha above zero would visibly unsettle
them.

**Unreached nodes are appended as a final layer.** BFS from a root cannot reach a
disconnected component; dropping those nodes would hide real data, so they get
placed rather than left at the origin. There is a test for this.

The rooted layouts (hierarchical, radial) default to the highest-degree node,
and use the selected node when there is one — so selecting a paper and switching
to hierarchical re-roots the tree on it.

---

## Interaction

### Hit-testing

Nodes are tested in reverse draw order, so the node painted on top receives the
click. Edges are only tested when no node was hit — an edge must never steal a
click from a node sitting on it.

Edge picking uses squared point-to-segment distance. Squared because the result
is only ever compared against a threshold, and this runs once per edge per
pointer move; skipping the square root is measurable at a few thousand edges.
The threshold is divided by zoom so the target stays a constant size on screen.

### Highlighting

Hovering or selecting a node dims everything that is not the node, its direct
neighbours, or the edges between them. Dimming rather than hiding keeps the
graph's overall shape visible as context.

### Keyboard

The canvas is focusable and supports:

| Key | Action |
| --- | ------ |
| Arrow keys | Step to the nearest node in that direction |
| Enter / Space | Expand the selected node |
| Escape | Clear the selection |

Arrows move *spatially*, not through a list: in a spatial layout, "the node to
the right" is what a keyboard user means, and list order is arbitrary. The
scoring penalises lateral drift so a node straight ahead beats one off to the
side at equal distance. Stepping to an off-screen node recentres the view.

The canvas carries `role="application"` rather than `role="img"`, which tells a
screen reader to pass arrow keys through instead of using them for its own
virtual cursor.

---

## Expansion and collapse

The displayed graph is a **merge of a base sample plus a stack of expansions**,
each stored under the node that produced it:

```ts
interface Expansion { id: string; name: string; view: GraphView }
```

Keeping expansions separate rather than flattening into one accumulated blob is
what makes collapse possible. Collapsing drops one entry and re-merges the rest,
which restores exactly the graph that existed before — with no bookkeeping about
which node arrived from where. A node shared with another expansion survives
automatically, because it is still present in that expansion's own view. No
reference counting.

`mergeViews` deduplicates on `elementId`, so a node reached from two directions
is drawn once rather than twice at different coordinates, and edges left
dangling by a merge are dropped so the renderer never resolves a missing
endpoint.

Expanding a node already expanded is a no-op with a toast, rather than a
duplicate fetch.

---

## Filtering

`applyGraphFilters` is a pure reducer, and **order is load-bearing**:

1. Filter nodes by type and by the search query.
2. Drop edges whose endpoints are gone — a dangling edge would reference a node
   the renderer cannot resolve.
3. *Then* judge isolation, because removing nodes is what makes their former
   neighbours isolated in the first place.

Doing isolation first would hide the wrong nodes. There is a test that pins this
ordering.

Filter options are derived from the loaded graph rather than the full schema, so
the panel never offers a type that would return nothing; the list shrinks as the
view narrows, which is itself information.

---

## Scalability

### What is bounded, and where

| Bound | Where | Value |
| ----- | ----- | ----- |
| Nodes per traversal | Server (`MAX_GRAPH_NODES`) | 400 |
| Nodes per request | Client node budget | 50–250 |
| Expansion depth | Server-validated | 1–3 hops |
| Rendered elements | Viewport culling | Whatever is on screen |

The server-side bound is the important one: a hub node like a prolific author
can have thousands of neighbours, and the traversal is capped before any of it
reaches the browser. The client budget narrows that further.

### Where this renderer would stop

Honest limits, in the order they would be hit:

1. **~5,000 nodes** — the force simulation becomes the bottleneck, not the
   renderer. `forceManyBody` is O(n log n) per tick with the default
   Barnes–Hut approximation. Fix: run the simulation in a Web Worker, or
   pre-compute positions server-side.
2. **~20,000 edges** — per-edge draw calls dominate. Fix: batch edges into a
   single path per style bucket, cutting `beginPath`/`stroke` pairs to a handful
   per frame.
3. **~50,000+** — canvas 2D runs out. This is the point where the WebGL renderer
   in Sigma.js becomes the right answer, and the encoding work here
   (shapes, colours, LOD thresholds) ports over.

None of these are reached by the current API bounds, which is why the simpler
renderer is the correct choice *today* rather than permanently.

### Performance techniques in use

- **Viewport culling** — cost tracks visible elements, not total.
- **Level of detail** — text and shapes drop out as zoom decreases.
- **Positions in a ref** — no React reconciliation per simulation tick.
- **Memoised transforms** — `applyGraphFilters` and the merge run under
  `useMemo`, keyed on the inputs that actually change them.
- **Squared-distance hit tests** — no square roots in the pointer-move path.
- **Minimap repaint at 1px scale** — cheap enough to redraw per tick.
- **Incremental expansion** — new neighbourhoods merge into existing positions,
  so the view animates outward instead of re-scattering.

---

## Testing

Pure logic is tested without a canvas
([`client/src/test/graph-visualization.test.ts`](../client/src/test/graph-visualization.test.ts)):

- Every static layout positions and pins every node, including disconnected ones.
- `force` releases pins.
- Rooted layouts centre the correct node and honour an explicit root.
- Filter ordering — the isolation-after-edges rule.
- Point-to-segment distance, including clamping past endpoints.
- Culling bounds under pan and zoom.
- Every node label has a shape.
- Merge deduplication and dangling-edge removal.

What is **not** covered: pixel output, and the feel of dragging. Those need a
human or a visual regression harness; the tests here cover the logic that would
silently produce a wrong picture.
