import { ChevronRight, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn, formatCompact } from '@/lib/utils';
import type { CitationTreeNode } from '@/types/api';

/** A tree node with its children resolved, ready to render recursively. */
export interface CitationTreeBranch extends CitationTreeNode {
  children: CitationTreeBranch[];
}

/**
 * Rebuilds the hierarchy from the flat, parent-linked rows the API returns.
 *
 * Cypher cannot return a nested structure of arbitrary depth, so the server
 * sends each node with its `depth` and the `parentId` it hangs from. One pass
 * over the list builds an index; a second attaches each node to its parent.
 *
 * Nodes whose parent is absent — possible when `limit` truncates the result
 * mid-branch — are promoted to roots rather than dropped, so a truncated tree
 * still renders everything it received.
 */
export function buildCitationTree(
  nodes: CitationTreeNode[],
  rootId: string,
): CitationTreeBranch[] {
  const branches = new Map<string, CitationTreeBranch>();
  for (const node of nodes) {
    branches.set(node.id, { ...node, children: [] });
  }

  const roots: CitationTreeBranch[] = [];
  for (const node of nodes) {
    const branch = branches.get(node.id);
    if (!branch) continue;

    const parent = node.parentId === rootId ? undefined : branches.get(node.parentId);
    if (parent) {
      parent.children.push(branch);
    } else {
      roots.push(branch);
    }
  }

  const byImpact = (a: CitationTreeBranch, b: CitationTreeBranch) =>
    b.citationCount - a.citationCount;

  const sortDeep = (list: CitationTreeBranch[]) => {
    list.sort(byImpact);
    for (const entry of list) sortDeep(entry.children);
  };
  sortDeep(roots);

  return roots;
}

interface CitationTreeViewProps {
  nodes: CitationTreeNode[];
  rootId: string;
  rootTitle: string;
  direction: 'forward' | 'backward';
}

/**
 * The citation tree, rendered as a collapsible outline.
 *
 * An outline rather than a node-link diagram: a citation tree is deep and
 * narrow, so a vertical hierarchy reads far better than a force layout at this
 * shape — and it stays usable on a phone, which the graph canvas does not.
 */
export function CitationTreeView({
  nodes,
  rootId,
  rootTitle,
  direction,
}: CitationTreeViewProps) {
  const roots = useMemo(() => buildCitationTree(nodes, rootId), [nodes, rootId]);

  return (
    <div className="surface-gradient rounded-lg border border-border p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <FileText className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium">{rootTitle}</p>
          <p className="text-2xs text-muted-foreground">
            {direction === 'forward'
              ? 'Papers this work builds on, and what those build on in turn'
              : 'Papers citing this work, and what cites those in turn'}
          </p>
        </div>
      </div>

      <ul className="space-y-0.5" role="tree" aria-label="Citation tree">
        {roots.map((branch) => (
          <TreeBranch key={branch.id} branch={branch} />
        ))}
      </ul>
    </div>
  );
}

function TreeBranch({ branch }: { branch: CitationTreeBranch }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = branch.children.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className="group flex items-center gap-1.5 rounded-md py-1 pr-2 transition-colors hover:bg-accent/60"
        // Indentation encodes depth; each level steps in by a fixed amount.
        style={{ paddingLeft: `${(branch.depth - 1) * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-label={expanded ? 'Collapse branch' : 'Expand branch'}
            className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground transition-transform hover:text-foreground"
          >
            <ChevronRight
              className={cn('size-3 transition-transform', expanded && 'rotate-90')}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-4 shrink-0" aria-hidden />
        )}

        <Link to={`/papers/${branch.id}`} className="min-w-0 flex-1 py-0.5">
          <span className="line-clamp-1 text-xs transition-colors group-hover:text-primary">
            {branch.title}
          </span>
        </Link>

        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{branch.year}</span>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {formatCompact(branch.citationCount)}
        </Badge>
      </div>

      {hasChildren && expanded ? (
        <ul className="space-y-0.5" role="group">
          {branch.children.map((child) => (
            <TreeBranch key={child.id} branch={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
