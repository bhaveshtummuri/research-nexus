import neo4j, { type Driver, type QueryResult, type Session } from 'neo4j-driver';

import { seedEnv } from '../config/index.js';

let driver: Driver | null = null;

function schemeCarriesTls(uri: string): boolean {
  return uri.includes('+s://') || uri.includes('+ssc://');
}

export function getDriver(): Driver {
  if (driver) return driver;

  const tls = schemeCarriesTls(seedEnv.COGNODB_URI)
    ? {}
    : { encrypted: seedEnv.COGNODB_ENCRYPTED ? ('ENCRYPTION_ON' as const) : ('ENCRYPTION_OFF' as const) };

  driver = neo4j.driver(
    seedEnv.COGNODB_URI,
    neo4j.auth.basic(seedEnv.COGNODB_USERNAME, seedEnv.COGNODB_PASSWORD),
    {
      connectionTimeout: seedEnv.COGNODB_CONNECTION_TIMEOUT_MS,
      connectionAcquisitionTimeout: seedEnv.COGNODB_CONNECTION_TIMEOUT_MS,
      maxConnectionPoolSize: 20,
      userAgent: 'research-nexus-seed/1.0.0',
      ...tls,
    },
  );
  return driver;
}

export function openSession(): Session {
  return getDriver().session(
    seedEnv.COGNODB_DATABASE ? { database: seedEnv.COGNODB_DATABASE } : undefined,
  );
}

/** Fails fast with an actionable message rather than a raw socket error. */
export async function verifyConnection(): Promise<void> {
  try {
    await getDriver().verifyConnectivity(
      seedEnv.COGNODB_DATABASE ? { database: seedEnv.COGNODB_DATABASE } : undefined,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach CognoDB at ${seedEnv.COGNODB_URI}.\n` +
        `  ${reason}\n` +
        '  Check that the instance is running and that COGNODB_URI, COGNODB_USERNAME and ' +
        'COGNODB_PASSWORD in your .env are correct.',
    );
  }
}

/**
 * Bolt separates 64-bit integers from doubles while JavaScript has only
 * `number`. Clauses such as `LIMIT` reject floats, so integer-valued numbers are
 * promoted to driver integers before they leave the process.
 */
function toDriverParameters(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? neo4j.int(value) : value;
  }
  if (Array.isArray(value)) return value.map(toDriverParameters);
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toDriverParameters(entry),
      ]),
    );
  }
  return value;
}

/**
 * Runs a write query. Every statement in the seed pipeline is parameterised and
 * batched via UNWIND, so this is the only place a Cypher string is executed.
 */
export async function write(
  statement: string,
  parameters: Record<string, unknown> = {},
): Promise<QueryResult> {
  const session = openSession();
  const driverParameters = toDriverParameters(parameters) as Record<string, unknown>;
  try {
    return await session.executeWrite((tx) => tx.run(statement, driverParameters));
  } finally {
    await session.close();
  }
}

export async function read(
  statement: string,
  parameters: Record<string, unknown> = {},
): Promise<QueryResult> {
  const session = openSession();
  const driverParameters = toDriverParameters(parameters) as Record<string, unknown>;
  try {
    return await session.executeRead((tx) => tx.run(statement, driverParameters));
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/** Splits a `.cypher` file into individual statements, ignoring `//` comments. */
export function splitStatements(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
