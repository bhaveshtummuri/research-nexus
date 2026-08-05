import neo4j, { Neo4jError, type QueryResult, type Record as Neo4jRecord } from 'neo4j-driver';

import { config } from '../config/index.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

import type { CypherStatement } from './cypher-tag.js';
import { ensureDatabaseAvailable, getDriver, reportConnectionFailure } from './driver.js';

const log = logger.child({ scope: 'cypher' });

/** Anything the Bolt protocol can carry as a query parameter. */
export type QueryParameters = Record<string, unknown>;

/** Queries slower than this are logged so regressions surface during review. */
const SLOW_QUERY_THRESHOLD_MS = 400;

/**
 * Bolt distinguishes 64-bit integers from doubles, and Cypher clauses such as
 * `SKIP`/`LIMIT` accept integers only. JavaScript has a single `number` type,
 * so integer-valued numbers are promoted to driver integers before they leave
 * the process. Non-integral numbers stay floats, which is what comparisons
 * against properties like `impactFactor` need.
 */
export function toDriverParameters(parameters: QueryParameters): QueryParameters {
  const converted: QueryParameters = {};
  for (const [key, value] of Object.entries(parameters)) {
    converted[key] = convertParameter(value);
  }
  return converted;
}

function convertParameter(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isInteger(value) && Number.isSafeInteger(value) ? neo4j.int(value) : value;
  }
  if (Array.isArray(value)) return value.map(convertParameter);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return toDriverParameters(value as QueryParameters);
  }
  return value;
}

function sessionOptions(mode: 'READ' | 'WRITE') {
  return {
    defaultAccessMode: mode === 'READ' ? neo4j.session.READ : neo4j.session.WRITE,
    ...(config.database.database ? { database: config.database.database } : {}),
  };
}

async function execute(
  mode: 'READ' | 'WRITE',
  statement: CypherStatement,
  parameters: QueryParameters,
): Promise<QueryResult> {
  await ensureDatabaseAvailable();

  const session = getDriver().session(sessionOptions(mode));
  const startedAt = Date.now();

  try {
    const driverParameters = toDriverParameters(parameters);
    const work = (tx: { run: (q: string, p: QueryParameters) => Promise<QueryResult> }) =>
      tx.run(statement, driverParameters);

    const result =
      mode === 'READ' ? await session.executeRead(work) : await session.executeWrite(work);

    const durationMs = Date.now() - startedAt;
    if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
      log.warn('Slow Cypher query', {
        durationMs,
        rows: result.records.length,
        statement: summarise(statement),
      });
    } else {
      log.debug('Cypher query executed', { durationMs, rows: result.records.length });
    }

    return result;
  } catch (error) {
    throw translateDatabaseError(error, statement);
  } finally {
    await session.close();
  }
}

/**
 * Runs a read query inside a managed read transaction.
 *
 * `executeRead` gives automatic retries on transient failures (leader switch,
 * dropped connection) for free, which is the main reason every read goes
 * through here rather than calling `session.run` directly.
 */
export async function runRead<T>(
  statement: CypherStatement,
  parameters: QueryParameters,
  mapper: (record: Neo4jRecord) => T,
): Promise<T[]> {
  const result = await execute('READ', statement, parameters);
  return result.records.map(mapper);
}

/** Runs a read query expected to produce at most one row. */
export async function runReadOne<T>(
  statement: CypherStatement,
  parameters: QueryParameters,
  mapper: (record: Neo4jRecord) => T,
): Promise<T | null> {
  const result = await execute('READ', statement, parameters);
  const [first] = result.records;
  return first ? mapper(first) : null;
}

/** Runs a write query inside a managed write transaction. */
export async function runWrite<T>(
  statement: CypherStatement,
  parameters: QueryParameters,
  mapper: (record: Neo4jRecord) => T,
): Promise<T[]> {
  const result = await execute('WRITE', statement, parameters);
  return result.records.map(mapper);
}

/** Runs a write query for its side effects and reports the counters. */
export async function runWriteCounters(
  statement: CypherStatement,
  parameters: QueryParameters,
): Promise<{ nodesCreated: number; relationshipsCreated: number; propertiesSet: number }> {
  const result = await execute('WRITE', statement, parameters);
  const counters = result.summary.counters.updates();
  return {
    nodesCreated: counters.nodesCreated,
    relationshipsCreated: counters.relationshipsCreated,
    propertiesSet: counters.propertiesSet,
  };
}

/**
 * Maps driver failures onto the API error vocabulary.
 *
 * Client-side Cypher problems (a syntax error, a bad parameter type) are server
 * bugs and are reported as 500 without leaking the statement; availability
 * problems become 503 so clients know a retry is worthwhile.
 */
export function translateDatabaseError(error: unknown, statement?: CypherStatement): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof Neo4jError) {
    const code = error.code ?? '';

    if (code.includes('ServiceUnavailable') || code.includes('SessionExpired')) {
      // The connection itself is gone, not just this query. Recording it starts
      // an immediate reconnect, so the next request has a chance of succeeding
      // rather than fast-failing until the background probe next runs.
      reportConnectionFailure(error);
      return ApiError.databaseUnavailable(
        'CognoDB is temporarily unreachable. Please retry in a moment.',
        error,
      );
    }
    if (code.includes('AuthenticationRateLimit') || code.includes('Unauthorized')) {
      return ApiError.databaseUnavailable(
        'CognoDB rejected the configured credentials. Check COGNODB_USERNAME and COGNODB_PASSWORD.',
        error,
      );
    }
    if (code.includes('TransactionTimedOut') || code.includes('Timeout')) {
      return ApiError.queryTimeout('The graph traversal took too long and was cancelled.', error);
    }

    log.error('CognoDB rejected a query', {
      code,
      error: error.message,
      statement: statement ? summarise(statement) : undefined,
    });
    return ApiError.databaseError('The graph query could not be executed.', error);
  }

  if (error instanceof Error && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/.test(error.message)) {
    return ApiError.databaseUnavailable(
      'CognoDB is not accepting connections at the configured URI.',
      error,
    );
  }

  return ApiError.internal('An unexpected database failure occurred.', error);
}

/** First line of a statement, for log correlation without dumping full Cypher. */
function summarise(statement: string): string {
  const firstLine = statement
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('//'));
  return (firstLine ?? statement).slice(0, 120);
}
