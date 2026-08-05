import { seedEnv } from '../config/index.js';
import { write } from '../utils/db.js';
import type { EdgeRow } from '../types.js';

export type ProgressReporter = (label: string, written: number, total: number) => void;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Writes node rows in UNWIND batches.
 *
 * `MERGE` on the constrained `id` property makes the whole seed idempotent:
 * running it twice updates the same nodes instead of duplicating them. `SET n +=
 * row` applies every remaining property in one operation, so adding a field to a
 * row type never requires touching this function.
 */
export async function writeNodes(
  label: string,
  rows: readonly object[],
  onProgress?: ProgressReporter,
): Promise<number> {
  if (rows.length === 0) return 0;

  // The label cannot be a parameter in Cypher, so it is validated against a
  // strict pattern and inserted only from this module's own call sites.
  assertSafeLabel(label);
  const statement = `
    UNWIND $rows AS row
    MERGE (n:${label} {id: row.id})
    SET n += row
  `;

  let written = 0;
  for (const batch of chunk(rows, seedEnv.SEED_BATCH_SIZE)) {
    await write(statement, { rows: batch });
    written += batch.length;
    onProgress?.(label, written, rows.length);
  }
  return written;
}

export interface EdgeSpec {
  type: string;
  fromLabel: string;
  toLabel: string;
}

/**
 * Writes relationship rows in UNWIND batches.
 *
 * Both endpoints are matched by their indexed `id`, which turns each row into
 * two index seeks plus a MERGE rather than a scan. `MERGE` on the relationship
 * keeps re-runs idempotent for edges as well as nodes.
 */
export async function writeEdges(
  spec: EdgeSpec,
  rows: readonly EdgeRow<Record<string, unknown>>[],
  onProgress?: ProgressReporter,
): Promise<number> {
  if (rows.length === 0) return 0;

  assertSafeLabel(spec.fromLabel);
  assertSafeLabel(spec.toLabel);
  assertSafeRelationshipType(spec.type);

  const statement = `
    UNWIND $rows AS row
    MATCH (from:${spec.fromLabel} {id: row.from})
    MATCH (to:${spec.toLabel} {id: row.to})
    MERGE (from)-[rel:${spec.type}]->(to)
    SET rel += row.props
  `;

  let written = 0;
  for (const batch of chunk(rows, seedEnv.SEED_BATCH_SIZE)) {
    await write(statement, { rows: batch });
    written += batch.length;
    onProgress?.(spec.type, written, rows.length);
  }
  return written;
}

/**
 * Labels and relationship types are structural: Cypher has no parameter form
 * for them. They therefore never originate from user input, and this guard
 * makes that invariant explicit and enforced.
 */
function assertSafeLabel(label: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(label)) {
    throw new Error(`Unsafe node label: "${label}"`);
  }
}

function assertSafeRelationshipType(type: string): void {
  if (!/^[A-Z][A-Z0-9_]*$/.test(type)) {
    throw new Error(`Unsafe relationship type: "${type}"`);
  }
}
