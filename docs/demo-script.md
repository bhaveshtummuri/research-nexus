# Demo Video Script

Target length **2:45**. Written to be read aloud at a normal pace — roughly 150
words per minute, with pauses where the interface needs a beat to land.

**Before recording:** hit `/health` a minute early to wake the Render instance,
seed the graph, set the theme to dark, and close every other tab. Record at
1920×1080.

---

## 0:00 – 0:20 · Introduction

> "This is Research Nexus — a research collaboration and knowledge discovery
> platform built on a property graph.
>
> The dataset is about fourteen hundred researchers, papers, topics, institutions
> and funders, connected by roughly sixteen thousand relationships. Every panel
> you're about to see is a live Cypher traversal against CognoDB. There's no
> reporting table, no materialised view, no nightly aggregation — the graph *is*
> the query engine."

**On screen:** the dashboard, already loaded.

---

## 0:20 – 0:40 · Dashboard

> "The dashboard is computed entirely at query time. Totals, trending topics,
> most-cited papers, funding by field — all of it is aggregation over the live
> graph.
>
> Trending is the interesting one: it compares publication counts across two time
> windows in a single traversal. In a relational schema that's a self-join over a
> derived table. Here it's one pattern match."

**On screen:** scroll slowly through the stat tiles into the trending panel.

---

## 0:40 – 0:58 · Global search

> "Search is a command palette — Command-K from anywhere."

*(press ⌘K, type "learning" deliberately)*

> "One request covers all ten entity types; the server unions them, so the
> palette stays responsive without a round trip per type. Results are grouped by
> type, and the matched text is highlighted — you can see *why* each row
> matched, not just that it did."

**On screen:** ⌘K, type slowly, let results settle before selecting.

---

## 0:58 – 1:20 · Author profile

> "Opening an author assembles their whole profile in a single request —
> publications, collaborators, topics, institution, funding.
>
> That's the shape of the argument for a graph database. This is one traversal
> from a single node. The relational equivalent is five or six joins across
> junction tables, and it gets worse with every hop you add."

**On screen:** the author page; scroll to collaborators, then topics.

---

## 1:20 – 1:36 · Paper explorer

> "Papers carry their citation context — who cites them, what they cite, and the
> topics and keywords that connect them to the rest of the corpus."

**On screen:** open a highly cited paper; hover the citation counts.

---

## 1:36 – 1:52 · Topic explorer

> "Topics rank their experts by output, impact *and* focus — not just paper
> count, which would reward volume over relevance.
>
> Similar topics come from keyword overlap, scored with Jaccard similarity
> computed in the query itself."

**On screen:** a topic page; experts, then similar topics.

---

## 1:52 – 2:12 · Collaboration explorer

> "This is where the graph earns its place. Hidden collaborators are researchers
> two hops away working on your topics whom you've *never* co-authored with —
> the people you should probably know.
>
> That question has no answer stored anywhere. It only exists as a traversal."

*(switch tab)*

> "And shortest path finds how any two researchers are connected, returning every
> equally short route rather than an arbitrary one."

**On screen:** pick a researcher, show hidden collaborators, then the path finder
with two names.

---

## 2:12 – 2:28 · Citation explorer

> "Citation chains run in both directions across multiple hops — ancestry
> backwards, influence forwards — and the influential-path ranking accumulates
> citation weight along each route to find the lineage that actually mattered."

**On screen:** pick a paper, toggle direction, expand a chain.

---

## 2:28 – 2:48 · Interactive graph visualization

> "And this is the whole thing, rendered directly.
>
> It's a canvas renderer driving a d3-force simulation — not a graph library.
> Nodes are shaped as well as coloured, so the encoding survives greyscale and
> low zoom."

*(double-click a node)*

> "Double-clicking expands a neighbourhood, merging it into what's already there.
> Collapse removes exactly that expansion and leaves everything else intact.
>
> Five layouts, viewport culling, level-of-detail — it stays smooth well past the
> point where a DOM-per-node renderer stops being usable."

**On screen:** pan and zoom, expand a node, switch to radial, click an edge to
show the relationship inspector.

---

## 2:48 – 3:00 · Recommendations and close

> "Recommendations blend shared topics, keywords, co-citation and bibliographic
> coupling — and every result explains its own score, because an unexplained
> recommendation is one nobody acts on.
>
> The whole stack is TypeScript end to end, deployed on Vercel and Render against
> a managed CognoDB instance, with the full test suite and documentation in the
> repository. Thanks for watching."

**On screen:** recommendations with reasons expanded, then cut to the deployed
URL in the address bar.

---

## Recording notes

- **Do not narrate loading.** Pre-warm every route you'll visit so panels are
  populated before you land on them.
- **Let the graph settle** before speaking over it — the force simulation needs
  about two seconds to stop moving.
- **Slow down for ⌘K.** Typing faster than the debounce makes the search look
  broken.
- **Show one error state if you have a spare five seconds** — stopping the API
  and showing the database-unavailable panel demonstrates the failure handling,
  which most submissions skip entirely.
- If you overrun, cut the paper explorer (1:36) first — it is the least
  graph-specific segment.
