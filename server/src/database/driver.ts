import neo4j, { type Driver, type ServerInfo } from 'neo4j-driver';

import { config } from '../config/index.js';
import { ApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ scope: 'cognodb' });

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'unavailable';

export interface ConnectionStatus {
  state: ConnectionState;
  uri: string;
  database: string | null;
  serverVersion: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

let driver: Driver | null = null;
let state: ConnectionState = 'disconnected';
let serverVersion: string | null = null;
let lastCheckedAt: string | null = null;
let lastError: string | null = null;
let probeTimer: NodeJS.Timeout | null = null;

/**
 * Encryption is configured explicitly only for plain `bolt://` / `neo4j://`
 * URIs. The `+s` and `+ssc` variants encode the TLS policy in the scheme, and
 * the driver throws if both are supplied.
 */
function schemeCarriesTlsConfig(uri: string): boolean {
  return /\+s{1,2}c?:\/\//.test(uri) || uri.includes('+ssc://') || uri.includes('+s://');
}

function createDriver(): Driver {
  const { uri, username, password, maxPoolSize, connectionTimeoutMs, maxTransactionRetryTimeMs } =
    config.database;

  const baseConfig = {
    maxConnectionPoolSize: maxPoolSize,
    connectionAcquisitionTimeout: connectionTimeoutMs,
    connectionTimeout: connectionTimeoutMs,
    maxTransactionRetryTime: maxTransactionRetryTimeMs,
    disableLosslessIntegers: false,
    /** Recycle sockets before most cloud load balancers drop them. */
    maxConnectionLifetime: 60 * 60 * 1000,
    userAgent: 'research-nexus/1.0.0',
  } as const;

  const tlsConfig = schemeCarriesTlsConfig(uri)
    ? {}
    : { encrypted: config.database.encrypted ? ('ENCRYPTION_ON' as const) : ('ENCRYPTION_OFF' as const) };

  return neo4j.driver(uri, neo4j.auth.basic(username, password), { ...baseConfig, ...tlsConfig });
}

/** Returns the live driver, creating it lazily on first use. */
export function getDriver(): Driver {
  if (!driver) {
    driver = createDriver();
    log.debug('Driver instantiated', { uri: config.database.uri });
  }
  return driver;
}

export function getConnectionStatus(): ConnectionStatus {
  return {
    state,
    uri: redactUri(config.database.uri),
    database: config.database.database ?? null,
    serverVersion,
    lastCheckedAt,
    lastError,
  };
}

export function isDatabaseAvailable(): boolean {
  return state === 'connected';
}

/**
 * Thrown by the query helpers when the database is known to be down, so that
 * requests fail fast with a 503 instead of waiting for a socket timeout.
 */
export function assertDatabaseAvailable(): void {
  if (state === 'connected' || state === 'connecting') return;
  throw ApiError.databaseUnavailable(
    'The CognoDB instance is not reachable. Verify COGNODB_URI and credentials, then retry.',
  );
}

async function verifyOnce(): Promise<ServerInfo> {
  const options = config.database.database ? { database: config.database.database } : undefined;
  return getDriver().verifyConnectivity(options);
}

function recordSuccess(info: ServerInfo): void {
  const previous = state;
  state = 'connected';
  serverVersion = info.protocolVersion ? `Bolt ${info.protocolVersion}` : (info.address ?? null);
  lastCheckedAt = new Date().toISOString();
  lastError = null;
  if (previous !== 'connected') {
    log.info('Connected to CognoDB', {
      uri: redactUri(config.database.uri),
      database: config.database.database ?? 'default',
      protocol: info.protocolVersion,
    });
  }
}

function recordFailure(error: unknown): void {
  state = 'unavailable';
  lastCheckedAt = new Date().toISOString();
  lastError = error instanceof Error ? error.message : String(error);
}

let recovering: Promise<void> | null = null;

/**
 * Reports a connection-level failure observed while running a query, and starts
 * recovering immediately.
 *
 * Without this, a single dropped socket — a TLS reset from a throttling managed
 * instance, a load balancer recycling a connection — leaves the process fast
 * failing every subsequent request until the background probe next fires. That
 * turns a blip lasting milliseconds into up to a full probe interval of hard
 * 503s, and in test runs, where the probe is disabled, into a permanent outage.
 *
 * The in-flight promise is shared so a burst of failing requests triggers one
 * reconnection attempt between them rather than one each.
 */
export function reportConnectionFailure(error: unknown): void {
  recordFailure(error);

  recovering ??= checkConnectivity()
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      recovering = null;
    });
}

/**
 * Gate every query passes through.
 *
 * Where `assertDatabaseAvailable` decides from the current state alone, this
 * waits for a reconnection that is already under way before giving up. That is
 * the difference between one dropped socket failing a single request and it
 * failing every request that arrives during the reconnect — which, on a managed
 * instance that recycles connections under load, is most of them.
 */
export async function ensureDatabaseAvailable(): Promise<void> {
  if (state === 'connected' || state === 'connecting') return;

  if (recovering) {
    await recovering;
    // `state` is reassigned by the recovery above, which TypeScript cannot see
    // through the await, so the check is made against a fresh read.
    if (isDatabaseAvailable()) return;
  }

  assertDatabaseAvailable();
}

/**
 * Verifies connectivity with bounded exponential backoff.
 *
 * A failure here never terminates the process: the API keeps serving, the
 * health endpoint reports `unavailable`, and a background probe reconnects as
 * soon as the database comes back. That behaviour matters on free hosting
 * tiers where the database frequently boots slower than the web service.
 */
export async function connect(): Promise<boolean> {
  if (state === 'connected') return true;
  state = 'connecting';

  const { connectRetries, connectRetryBaseDelayMs } = config.database;

  for (let attempt = 1; attempt <= connectRetries; attempt += 1) {
    try {
      recordSuccess(await verifyOnce());
      startHealthProbe();
      return true;
    } catch (error) {
      recordFailure(error);
      const isLastAttempt = attempt === connectRetries;
      log.warn('CognoDB connectivity check failed', {
        attempt,
        of: connectRetries,
        error: lastError,
      });
      if (isLastAttempt) break;
      await delay(connectRetryBaseDelayMs * 2 ** (attempt - 1));
    }
  }

  log.error('Starting without a CognoDB connection; API reads will return 503 until it recovers', {
    uri: redactUri(config.database.uri),
    error: lastError,
  });
  startHealthProbe();
  return false;
}

/** Single connectivity check used by the health endpoint and the probe timer. */
export async function checkConnectivity(): Promise<ConnectionStatus> {
  try {
    recordSuccess(await verifyOnce());
  } catch (error) {
    recordFailure(error);
  }
  return getConnectionStatus();
}

function startHealthProbe(): void {
  if (probeTimer || config.isTest) return;
  probeTimer = setInterval(() => {
    void checkConnectivity();
  }, config.database.healthProbeIntervalMs);
  /** Never hold the event loop open just to run the probe. */
  probeTimer.unref();
}

export async function closeDriver(): Promise<void> {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (driver) {
    await driver.close();
    driver = null;
  }
  state = 'disconnected';
  serverVersion = null;
  log.info('CognoDB driver closed');
}

/** Strips credentials from a Bolt URI before it reaches logs or API responses. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]+@/, '//***@');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
