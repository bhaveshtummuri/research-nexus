import {
  EXPAND_NEIGHBOURHOOD,
  NODE_DEGREES,
  SAMPLE_GRAPH,
  SUBGRAPH_FOR_IDS,
} from '../cypher/index.js';
import { column } from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  GraphEdgeView,
  GraphNodeView,
  GraphView,
  NodeLabel,
  RelationshipType,
} from '../types/domain.js';

interface RawGraph {
  nodes: unknown[];
  edges: unknown[];
}

function readGraph(value: unknown): RawGraph {
  const source = (value ?? {}) as Record<string, unknown>;
  return {
    nodes: Array.isArray(source.nodes) ? source.nodes : [],
    edges: Array.isArray(source.edges) ? source.edges : [],
  };
}

function toNodeView(value: unknown, degrees: Map<string, number>): GraphNodeView {
  const source = (value ?? {}) as Record<string, unknown>;
  const id = String(source.id ?? '');
  return {
    elementId: String(source.elementId ?? ''),
    id,
    label: String(source.label ?? 'Author') as NodeLabel,
    name: String(source.name ?? ''),
    caption: String(source.caption ?? ''),
    degree: degrees.get(id) ?? 0,
    properties: (source.properties ?? {}) as Record<string, unknown>,
  };
}

function toEdgeView(value: unknown): GraphEdgeView {
  const source = (value ?? {}) as Record<string, unknown>;
  return {
    elementId: String(source.elementId ?? ''),
    type: String(source.type ?? 'RELATED_TO') as RelationshipType,
    source: String(source.source ?? ''),
    target: String(source.target ?? ''),
    properties: (source.properties ?? {}) as Record<string, unknown>,
  };
}

/**
 * Assembles the payload the force-directed renderer consumes.
 *
 * Edges are filtered against the node set before they are returned. Without
 * that step a relationship could reference an endpoint the client never
 * received, and the layout would place an invisible node at the origin.
 */
function assemble(raw: RawGraph, degrees: Map<string, number>, requestedLimit: number): GraphView {
  const nodes = raw.nodes.map((node) => toNodeView(node, degrees));
  const elementIds = new Set(nodes.map((node) => node.elementId));
  const edges = raw.edges
    .map(toEdgeView)
    .filter((edge) => elementIds.has(edge.source) && elementIds.has(edge.target));

  const labelCounts = new Map<NodeLabel, number>();
  for (const node of nodes) {
    labelCounts.set(node.label, (labelCounts.get(node.label) ?? 0) + 1);
  }

  const relationshipCounts = new Map<RelationshipType, number>();
  for (const edge of edges) {
    relationshipCounts.set(edge.type, (relationshipCounts.get(edge.type) ?? 0) + 1);
  }

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      truncated: nodes.length >= requestedLimit,
      labelCounts: [...labelCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      relationshipCounts: [...relationshipCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

/**
 * Degree is fetched separately from the subgraph.
 *
 * A node's importance comes from its degree in the *whole* graph, not from how
 * many of its edges happen to be inside the current view, so a hub still renders
 * as a hub even when only part of its neighbourhood is on screen.
 */
async function fetchDegrees(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const rows = await runRead(NODE_DEGREES, { ids }, (record) => {
    const source = column(record, 'row') as Record<string, unknown>;
    return { id: String(source.id ?? ''), degree: toNumber(source.degree) };
  });

  return new Map(rows.map((row) => [row.id, row.degree]));
}

async function buildView(raw: RawGraph, requestedLimit: number): Promise<GraphView> {
  const ids = raw.nodes
    .map((node) => String(((node ?? {}) as Record<string, unknown>).id ?? ''))
    .filter((id) => id.length > 0);
  const degrees = await fetchDegrees(ids);
  return assemble(raw, degrees, requestedLimit);
}

export async function expandNeighbourhood(options: {
  startId: string;
  depth: number;
  limit: number;
  relationshipTypes?: string[] | undefined;
}): Promise<GraphView> {
  const raw = await runReadOne(
    EXPAND_NEIGHBOURHOOD,
    {
      startId: options.startId,
      maxDepth: options.depth,
      limit: options.limit,
      relationshipTypes:
        options.relationshipTypes && options.relationshipTypes.length > 0
          ? options.relationshipTypes
          : null,
    },
    (record) => readGraph(column(record, 'graph')),
  );

  return buildView(raw ?? { nodes: [], edges: [] }, options.limit);
}

/**
 * The graph explorer's opening view: the most connected authors, papers, topics
 * and institutions, plus every relationship between them.
 */
export async function sampleGraph(limit: number): Promise<GraphView> {
  const raw = await runReadOne(
    SAMPLE_GRAPH,
    {
      authorLimit: Math.max(Math.round(limit * 0.35), 5),
      paperLimit: Math.max(Math.round(limit * 0.35), 5),
      topicLimit: Math.max(Math.round(limit * 0.2), 3),
      universityLimit: Math.max(Math.round(limit * 0.1), 3),
    },
    (record) => readGraph(column(record, 'graph')),
  );

  return buildView(raw ?? { nodes: [], edges: [] }, limit);
}

export async function subgraphForIds(ids: string[]): Promise<GraphView> {
  if (ids.length === 0) {
    return {
      nodes: [],
      edges: [],
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        truncated: false,
        labelCounts: [],
        relationshipCounts: [],
      },
    };
  }

  const raw = await runReadOne(SUBGRAPH_FOR_IDS, { ids }, (record) =>
    readGraph(column(record, 'graph')),
  );

  return buildView(raw ?? { nodes: [], edges: [] }, ids.length);
}
