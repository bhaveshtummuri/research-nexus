import type * as Neo4j from 'neo4j-driver';
import type { Driver } from 'neo4j-driver';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { redactUri } from '../../src/database/driver.js';

/**
 * Connection-layer behaviour that must hold with or without a live database.
 *
 * The driver is mocked at the `neo4j-driver` boundary rather than at the network
 * one, so these tests can force the failure modes that matter — bad credentials,
 * a socket timeout, a database that comes back mid-retry — without needing an
 * unreachable host to produce them.
 */

vi.mock('neo4j-driver', async () => {
  const actual: typeof Neo4j = await vi.importActual('neo4j-driver');
  return {
    ...actual,
    default: {
      ...actual.default,
      driver: vi.fn(() => mockDriver),
      auth: actual.default.auth,
    },
  };
});

const verifyConnectivity = vi.fn();
const close = vi.fn(async () => {});
const mockDriver = { verifyConnectivity, close } as unknown as Driver;

/**
 * The driver module holds connection state in module scope, so each test needs a
 * fresh copy. Importing through `vi.resetModules` is the only way to get one.
 */
async function freshDriverModule() {
  vi.resetModules();
  return import('../../src/database/driver.js');
}

afterEach(() => {
  verifyConnectivity.mockReset();
  close.mockClear();
});

describe('credential redaction', () => {
  it('strips the userinfo segment from a Bolt URI', () => {
    // This string reaches both the logs and the /health response body; a
    // password leaking into either is a disclosure, not a cosmetic issue.
    expect(redactUri('bolt://neo4j:hunter2@db.example.com:7687')).toBe(
      'bolt://***@db.example.com:7687',
    );
  });

  it('leaves a URI without credentials untouched', () => {
    expect(redactUri('neo4j+s://db.example.com')).toBe('neo4j+s://db.example.com');
  });

  it('redacts a password containing URL-ish characters', () => {
    expect(redactUri('bolt://user:p%3Ass-word@host:7687')).toBe('bolt://***@host:7687');
  });
});

describe('connect', () => {
  it('reports success and marks the connection available', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });

    await expect(driver.connect()).resolves.toBe(true);
    expect(driver.isDatabaseAvailable()).toBe(true);
    expect(driver.getConnectionStatus().state).toBe('connected');

    await driver.closeDriver();
  });

  it('retries a failing connection before giving up', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(driver.connect()).resolves.toBe(false);

    // Retrying matters on free hosting tiers, where the database routinely boots
    // slower than the web service that depends on it.
    expect(verifyConnectivity.mock.calls.length).toBeGreaterThan(1);
    expect(driver.getConnectionStatus().state).toBe('unavailable');

    await driver.closeDriver();
  }, 30_000);

  it('succeeds on a later attempt when the database arrives mid-retry', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });

    await expect(driver.connect()).resolves.toBe(true);
    expect(verifyConnectivity).toHaveBeenCalledTimes(2);

    await driver.closeDriver();
  }, 30_000);

  it('never throws on a failed connection, so the API still starts', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockRejectedValue(new Error('Neo.ClientError.Security.Unauthorized'));

    // A process that exits on a database outage cannot serve its own health
    // endpoint, which is exactly what an operator needs during that outage.
    await expect(driver.connect()).resolves.toBe(false);
    await driver.closeDriver();
  }, 30_000);

  it('records the failure reason for the health endpoint to report', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockRejectedValue(new Error('The client is unauthorized due to authentication failure.'));

    await driver.connect();

    expect(driver.getConnectionStatus().lastError).toMatch(/unauthorized/i);
    expect(driver.getConnectionStatus().lastCheckedAt).not.toBeNull();

    await driver.closeDriver();
  }, 30_000);
});

describe('assertDatabaseAvailable', () => {
  it('throws a 503-carrying error when the database is down', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockRejectedValue(new Error('ECONNREFUSED'));
    await driver.connect();

    // Failing fast here is what stops a request queueing behind a socket
    // timeout: the state is already known, so there is nothing to wait for.
    expect(() => driver.assertDatabaseAvailable()).toThrowError(/not reachable/i);

    await driver.closeDriver();
  }, 30_000);

  it('permits a query while a connection is still being established', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });
    await driver.connect();

    expect(() => driver.assertDatabaseAvailable()).not.toThrow();

    await driver.closeDriver();
  });
});

describe('checkConnectivity', () => {
  it('recovers the connection state once the database returns', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockRejectedValue(new Error('ECONNREFUSED'));
    await driver.connect();
    expect(driver.isDatabaseAvailable()).toBe(false);

    // The background probe uses this path; without recovery the API would stay
    // in a 503 state until someone restarted it.
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });
    const status = await driver.checkConnectivity();

    expect(status.state).toBe('connected');
    expect(status.lastError).toBeNull();

    await driver.closeDriver();
  }, 30_000);

  it('degrades cleanly when a healthy connection drops', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });
    await driver.connect();

    verifyConnectivity.mockRejectedValue(new Error('Connection timed out'));
    const status = await driver.checkConnectivity();

    expect(status.state).toBe('unavailable');
    expect(status.lastError).toMatch(/timed out/i);

    await driver.closeDriver();
  });

  it('reports a redacted URI, never the configured one', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });
    await driver.connect();

    expect(driver.getConnectionStatus().uri).not.toMatch(/:[^/@]+@/);

    await driver.closeDriver();
  });
});

describe('closeDriver', () => {
  it('closes the underlying driver and resets state', async () => {
    const driver = await freshDriverModule();
    verifyConnectivity.mockResolvedValue({ protocolVersion: 5.0, address: 'localhost:7687' });
    await driver.connect();

    await driver.closeDriver();

    expect(close).toHaveBeenCalled();
    expect(driver.getConnectionStatus().state).toBe('disconnected');
  });

  it('is safe to call when no driver was ever created', async () => {
    // Shutdown runs on every exit path, including one where startup failed
    // before the driver existed.
    const driver = await freshDriverModule();
    await expect(driver.closeDriver()).resolves.toBeUndefined();
  });
});
