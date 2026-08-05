import {
  ALL_SHORTEST_COLLABORATION_PATHS,
  BUILD_CITATION_TREE_BACKWARD,
  BUILD_CITATION_TREE_FORWARD,
  CITATION_CHAINS_BACKWARD,
  CITATION_CHAINS_FORWARD,
  FIND_INFLUENTIAL_CITATION_PATH,
  MULTI_HOP_NEIGHBOURHOOD,
  SHORTEST_ANY_PATH,
  SHORTEST_CITATION_PATH,
  SHORTEST_COLLABORATION_PATH,
} from '../cypher/index.js';
import type { CypherStatement } from '../database/cypher-tag.js';
import {
  column,
  mapCitationChain,
  mapCitationTreeNode,
  mapGraphPath,
  mapInfluentialCitationPath,
} from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  CitationChain,
  CitationTreeNode,
  GraphPath,
  InfluentialCitationPath,
  NodeLabel,
} from '../types/domain.js';

export type PathMode = 'collaboration' | 'citation' | 'any';

export interface ShortestPathResult {
  found: boolean;
  paths: GraphPath[];
}

/**
 * One prepared statement per mode, selected here.
 *
 * Cypher cannot parameterise a relationship type inside a pattern, so the
 * alternative to this lookup would be building query text from a request value.
 * Selecting from a fixed table keeps the statements static and the input inert.
 */
const PATH_STATEMENTS: Record<PathMode, CypherStatement> = {
  collaboration: SHORTEST_COLLABORATION_PATH,
  citation: SHORTEST_CITATION_PATH,
  any: SHORTEST_ANY_PATH,
};

/** Shortest path between two entities, restricted to the requested edge type. */
export async function findShortestPath(options: {
  fromId: string;
  toId: string;
  mode: PathMode;
  maxDepth: number;
  all: boolean;
}): Promise<ShortestPathResult> {
  const { fromId, toId, mode, maxDepth, all } = options;

  if (fromId === toId) {
    return { found: false, paths: [] };
  }

  if (all && mode === 'collaboration') {
    const paths = await runRead(
      ALL_SHORTEST_COLLABORATION_PATHS,
      { fromId, toId, maxDepth, limit: 5 },
      (record) => mapGraphPath(column(record, 'path')),
    );
    return { found: paths.length > 0, paths };
  }

  const path = await runReadOne(PATH_STATEMENTS[mode], { fromId, toId, maxDepth }, (record) =>
    mapGraphPath(column(record, 'path')),
  );

  return { found: path !== null, paths: path ? [path] : [] };
}

/**
 * Citation lineages reachable from a paper.
 *
 * `forward` follows what the paper cites (its intellectual ancestry);
 * `backward` follows what cites it (its influence).
 */
export async function findCitationChains(options: {
  paperId: string;
  direction: 'forward' | 'backward';
  depth: number;
  limit: number;
}): Promise<CitationChain[]> {
  const statement =
    options.direction === 'backward' ? CITATION_CHAINS_BACKWARD : CITATION_CHAINS_FORWARD;

  return runRead(
    statement,
    { paperId: options.paperId, maxDepth: options.depth, limit: options.limit },
    (record) => mapCitationChain(column(record, 'chain')),
  );
}

/**
 * The citation tree rooted at a paper, returned flat with `parentId` links.
 *
 * The service does not assemble the hierarchy: the client renders a tree from
 * the parent pointers directly, and a flat list is also what a graph view wants.
 */
export async function findCitationTree(options: {
  paperId: string;
  direction: 'forward' | 'backward';
  depth: number;
  limit: number;
}): Promise<CitationTreeNode[]> {
  const statement =
    options.direction === 'backward' ? BUILD_CITATION_TREE_BACKWARD : BUILD_CITATION_TREE_FORWARD;

  return runRead(
    statement,
    { paperId: options.paperId, maxDepth: options.depth, limit: options.limit },
    (record) => mapCitationTreeNode(column(record, 'node')),
  );
}

/** Citation lineages ranked by accumulated influence rather than by length. */
export async function findInfluentialCitationPaths(options: {
  paperId: string;
  depth: number;
  limit: number;
}): Promise<InfluentialCitationPath[]> {
  return runRead(
    FIND_INFLUENTIAL_CITATION_PATH,
    { paperId: options.paperId, maxDepth: options.depth, limit: options.limit },
    (record) => mapInfluentialCitationPath(column(record, 'path')),
  );
}

export interface NeighbourResult {
  id: string;
  label: NodeLabel;
  name: string;
  distance: number;
  metric: number;
}

/** Everything reachable from an entity within N hops, grouped by distance. */
export async function findMultiHopNeighbourhood(options: {
  startId: string;
  depth: number;
  limit: number;
  labels?: string[] | undefined;
}): Promise<NeighbourResult[]> {
  return runRead(
    MULTI_HOP_NEIGHBOURHOOD,
    {
      startId: options.startId,
      maxDepth: options.depth,
      limit: options.limit,
      labels: options.labels && options.labels.length > 0 ? options.labels : null,
    },
    (record) => {
      const source = column(record, 'neighbour') as Record<string, unknown>;
      return {
        id: String(source.id ?? ''),
        label: String(source.label ?? 'Author') as NodeLabel,
        name: String(source.name ?? ''),
        distance: toNumber(source.distance),
        metric: toNumber(source.metric),
      };
    },
  );
}
