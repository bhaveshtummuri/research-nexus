import neo4j from 'neo4j-driver';

/**
 * A CognoDB node flattened into the shape the HTTP layer returns.
 * `elementId` is kept because the graph visualisation needs a stable handle
 * that is independent of the business `id` property.
 */
export interface SerializedNode {
  elementId: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface SerializedRelationship {
  elementId: string;
  type: string;
  startElementId: string;
  endElementId: string;
  properties: Record<string, unknown>;
}

export interface SerializedPath {
  length: number;
  nodes: SerializedNode[];
  relationships: SerializedRelationship[];
}

function isNeo4jNode(value: object): value is InstanceType<typeof neo4j.types.Node> {
  return value instanceof neo4j.types.Node;
}

function isNeo4jRelationship(
  value: object,
): value is InstanceType<typeof neo4j.types.Relationship> {
  return value instanceof neo4j.types.Relationship;
}

function isNeo4jPath(value: object): value is InstanceType<typeof neo4j.types.Path> {
  return value instanceof neo4j.types.Path;
}

/**
 * Temporal and spatial values arrive as driver classes. They all implement a
 * lossless `toString()`, which is exactly the ISO-8601 / WKT representation we
 * want to hand to the browser.
 */
function isDriverValueObject(value: object): boolean {
  return (
    neo4j.isDate(value) ||
    neo4j.isDateTime(value) ||
    neo4j.isLocalDateTime(value) ||
    neo4j.isTime(value) ||
    neo4j.isLocalTime(value) ||
    neo4j.isDuration(value) ||
    neo4j.isPoint(value)
  );
}

/**
 * Converts any value returned by the Bolt driver into plain JSON.
 *
 * Bolt integers are 64-bit and arrive as `Integer` instances. They become JS
 * numbers while they fit in the safe range and fall back to strings beyond it,
 * so a large identifier never silently loses precision on the wire.
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }

  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) return value.map(serializeValue);

  if (isNeo4jNode(value)) return serializeNode(value);
  if (isNeo4jRelationship(value)) return serializeRelationship(value);
  if (isNeo4jPath(value)) return serializePath(value);
  if (isDriverValueObject(value)) return value.toString();
  if (value instanceof Date) return value.toISOString();

  return serializeProperties(value as Record<string, unknown>);
}

export function serializeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(properties)) {
    result[key] = serializeValue(raw);
  }
  return result;
}

export function serializeNode(node: InstanceType<typeof neo4j.types.Node>): SerializedNode {
  return {
    elementId: node.elementId,
    labels: [...node.labels],
    properties: serializeProperties(node.properties as Record<string, unknown>),
  };
}

export function serializeRelationship(
  relationship: InstanceType<typeof neo4j.types.Relationship>,
): SerializedRelationship {
  return {
    elementId: relationship.elementId,
    type: relationship.type,
    startElementId: relationship.startNodeElementId,
    endElementId: relationship.endNodeElementId,
    properties: serializeProperties(relationship.properties as Record<string, unknown>),
  };
}

export function serializePath(path: InstanceType<typeof neo4j.types.Path>): SerializedPath {
  const nodes: SerializedNode[] = [serializeNode(path.start)];
  const relationships: SerializedRelationship[] = [];

  for (const segment of path.segments) {
    relationships.push(serializeRelationship(segment.relationship));
    nodes.push(serializeNode(segment.end));
  }

  return { length: path.length, nodes, relationships };
}

/** Narrowing helper for numeric aggregates that may arrive as `Integer`. */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (neo4j.isInt(value)) return value.inSafeRange() ? value.toNumber() : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
