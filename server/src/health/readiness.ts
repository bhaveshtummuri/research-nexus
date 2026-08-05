import { checkConnectivity, getConnectionStatus, type ConnectionStatus } from '../database/driver.js';
import { runReadOne } from '../database/query.js';
import { HEALTH_PROBE } from '../cypher/analytics.cypher.js';
import { toNumber } from '../database/serialize.js';
import { config } from '../config/index.js';

import { uptimeSeconds } from './liveness.js';

export interface ReadinessReport {
  ready: boolean;
  status: 'ready' | 'degraded';
  database: ConnectionStatus;
  checks: {
    driverActive: boolean;
    connectivity: boolean;
    queryExecution: boolean;
    queryLatencyMs: number | null;
  };
  environment: {
    nodeEnv: string;
    apiPrefix: string;
    nodeVersion: string;
    maxPageSize: number;
    maxGraphNodes: number;
    corsOrigins: number;
  };
  uptimeSeconds: number;
}

/**
 * Readiness: can this process serve data?
 *
 * Connectivity alone is not enough — a driver can hold an open socket to an
 * instance that rejects queries. The probe therefore executes a trivial
 * statement and times it, so the report distinguishes "connected" from
 * "actually answering".
 */
export async function checkReadiness(): Promise<ReadinessReport> {
  const database = await checkConnectivity();
  const connectivity = database.state === 'connected';

  let queryExecution = false;
  let queryLatencyMs: number | null = null;

  if (connectivity) {
    const startedAt = Date.now();
    try {
      const value = await runReadOne(HEALTH_PROBE, {}, (record) => toNumber(record.get('ok')));
      queryExecution = value === 1;
      queryLatencyMs = Date.now() - startedAt;
    } catch {
      // A failure here is the signal itself; the connectivity state already
      // carries the reason, so the error is not rethrown.
      queryExecution = false;
      queryLatencyMs = Date.now() - startedAt;
    }
  }

  const ready = connectivity && queryExecution;

  return {
    ready,
    status: ready ? 'ready' : 'degraded',
    database,
    checks: {
      driverActive: database.state !== 'disconnected',
      connectivity,
      queryExecution,
      queryLatencyMs,
    },
    environment: {
      nodeEnv: config.env,
      apiPrefix: config.http.apiPrefix,
      nodeVersion: process.version,
      maxPageSize: config.limits.maxPageSize,
      maxGraphNodes: config.limits.maxGraphNodes,
      corsOrigins: config.http.corsOrigins.length,
    },
    uptimeSeconds: uptimeSeconds(),
  };
}

/** Cached status without issuing a fresh probe — cheap enough to poll. */
export function currentDatabaseStatus(): ConnectionStatus {
  return getConnectionStatus();
}
