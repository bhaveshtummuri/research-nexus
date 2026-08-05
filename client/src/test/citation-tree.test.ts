import { describe, expect, it } from 'vitest';

import { buildCitationTree, type CitationTreeBranch } from '@/components/graph/citation-tree';
import type { CitationTreeNode } from '@/types/api';

/**
 * The API returns the citation tree flat, because Cypher cannot return a nested
 * structure of arbitrary depth. Rebuilding it is the one piece of real logic on
 * the client, so it is tested directly rather than through the component.
 */
const ROOT = 'paper-root';

function node(
  id: string,
  parentId: string,
  depth: number,
  citationCount = 0,
): CitationTreeNode {
  return { id, parentId, depth, citationCount, title: id, year: 2020 };
}

function ids(branches: CitationTreeBranch[]): string[] {
  return branches.flatMap((branch) => [branch.id, ...ids(branch.children)]);
}

describe('buildCitationTree', () => {
  it('attaches depth-1 nodes as roots', () => {
    const tree = buildCitationTree([node('a', ROOT, 1), node('b', ROOT, 1)], ROOT);

    expect(tree).toHaveLength(2);
    expect(tree.every((branch) => branch.children.length === 0)).toBe(true);
  });

  it('nests children under the parent named by parentId', () => {
    const tree = buildCitationTree(
      [node('a', ROOT, 1), node('b', 'a', 2), node('c', 'b', 3)],
      ROOT,
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('a');
    expect(tree[0]?.children[0]?.id).toBe('b');
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('c');
  });

  it('sorts siblings by citation count at every level', () => {
    const tree = buildCitationTree(
      [
        node('low', ROOT, 1, 5),
        node('high', ROOT, 1, 90),
        node('child-low', 'high', 2, 1),
        node('child-high', 'high', 2, 40),
      ],
      ROOT,
    );

    expect(tree.map((branch) => branch.id)).toEqual(['high', 'low']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['child-high', 'child-low']);
  });

  it('promotes orphans to roots rather than dropping them', () => {
    // `limit` can truncate a result mid-branch, leaving a node whose parent was
    // never returned. Dropping it would silently lose data the server did send.
    const tree = buildCitationTree([node('a', ROOT, 1), node('orphan', 'missing-parent', 3)], ROOT);

    expect(ids(tree).sort()).toEqual(['a', 'orphan']);
  });

  it('returns every input node exactly once', () => {
    const nodes = [
      node('a', ROOT, 1),
      node('b', 'a', 2),
      node('c', 'a', 2),
      node('d', 'b', 3),
    ];

    const flattened = ids(buildCitationTree(nodes, ROOT));
    expect(flattened).toHaveLength(nodes.length);
    expect(new Set(flattened).size).toBe(nodes.length);
  });

  it('handles an empty result', () => {
    expect(buildCitationTree([], ROOT)).toEqual([]);
  });
});
