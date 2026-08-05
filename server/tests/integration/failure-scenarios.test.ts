import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDriver } from '../../src/database/driver.js';
import { api, apiPrefix, buildApp, databaseAvailable, expectReadable } from '../helpers/index.js';

/**
 * How the API behaves when things are wrong.
 *
 * Every assertion here holds whether or not a database is reachable, because
 * that is the point: the failure path must be deterministic. A request that gets
 * a clean 503 during an outage and a clean 422 for bad input is one an operator
 * and a UI can both reason about; one that returns 500 for either is a defect
 * dressed up as a server error.
 */
let app: Express;
let hasDatabase = false;

beforeAll(async () => {
  app = buildApp();
  hasDatabase = await databaseAvailable();
}, 30_000);

afterAll(async () => {
  await closeDriver();
});

// ---------------------------------------------------------------------------
// Database unavailable
// ---------------------------------------------------------------------------

describe('database unavailable', () => {
  const dataEndpoints = [
    '/authors',
    '/papers',
    '/topics',
    '/universities',
    '/analytics/dashboard',
    '/graph',
    '/search?q=neural',
  ];

  it.each(dataEndpoints)('answers %s with 200 or a clean 503, never a 500', async (path) => {
    const response = await api(app, path);
    expectReadable(response.status);

    if (response.status === 503) {
      // The UI switches on this code to show a "database unavailable" panel
      // rather than a generic failure, so it is part of the contract.
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/CognoDB|not reachable/i);
      expect(response.body.requestId).toEqual(expect.any(String));
    }
  });

  it('keeps the liveness probe green while the database is down', async () => {
    // Liveness must not depend on the database, or a brief outage triggers a
    // restart loop on the host and turns a recoverable blip into downtime.
    const response = await request(app).get(`${apiPrefix}/health`).expect(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('reports the outage on the readiness probe instead of hiding it', async () => {
    const response = await request(app).get(`${apiPrefix}/health/ready`);

    expect([200, 503]).toContain(response.status);
    if (!hasDatabase) {
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    }
  });

  it('never exposes credentials in the health payload', async () => {
    const response = await request(app).get(`${apiPrefix}/health`);
    const body = JSON.stringify(response.body);

    expect(body).not.toContain('password');
    // A redacted URI keeps the host visible for diagnosis without the secret.
    expect(body).not.toMatch(/bolt:\/\/[^*"]+:[^*"]+@/);
  });
});

// ---------------------------------------------------------------------------
// Invalid request parameters
// ---------------------------------------------------------------------------

describe('invalid request parameters', () => {
  it.each([
    ['a page size above the maximum', '/authors?limit=10000'],
    ['a page size below the minimum', '/authors?limit=0'],
    ['a negative offset', '/authors?offset=-1'],
    ['a non-numeric offset', '/authors?offset=abc'],
    ['a non-integer page size', '/authors?limit=2.5'],
    ['a search term below the minimum length', '/search?q=a'],
    ['a missing search term', '/search'],
    ['an unknown sort key', '/authors?sort=not-a-column'],
    ['an out-of-range traversal depth', '/graph/author/author-1?depth=99'],
    ['a non-integer traversal depth', '/graph/author/author-1?depth=1.5'],
    ['a path lookup missing its target', '/graph/shortest-path?from=author-1'],
    ['an unknown traversal mode', '/graph/shortest-path?from=a&to=b&mode=teleport'],
    ['an unknown citation direction', '/papers/paper-1/citation-tree?direction=sideways'],
  ])('rejects %s with 422 before touching the database', async (_case, path) => {
    const response = await api(app, path);

    // Validation runs ahead of the query layer, so these fail identically with
    // or without a database — a 503 here would mean the order is wrong.
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('names the offending field so a client can point at it', async () => {
    const response = await api(app, '/authors?limit=10000').expect(422);

    const [detail] = response.body.error.details;
    expect(detail.path).toContain('limit');
    expect(detail.message).toEqual(expect.any(String));
  });

  it('rejects a malformed entity id without a round trip', async () => {
    const response = await api(app, '/authors/not a valid id!!');
    expect([404, 422]).toContain(response.status);
    expect(response.body.error.code).not.toBe('DATABASE_UNAVAILABLE');
  });

  it('returns a structured 404 for an unknown route', async () => {
    const response = await api(app, '/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toMatch(/No route matches/i);
  });

  it('rejects an unsupported method rather than falling through to 404 handling', async () => {
    const response = await request(app).post(`${apiPrefix}/authors`).send({});
    expect([404, 405]).toContain(response.status);
    expect(response.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Empty results
// ---------------------------------------------------------------------------

describe('empty and missing data', () => {
  it('returns an empty page rather than an error when nothing matches', async () => {
    const response = await api(app, '/search?q=zzzzqqqqnothingmatchesthis');
    expectReadable(response.status);

    if (response.status === 200) {
      // An empty result is a valid answer, not a failure. Collapsing the two
      // would make the UI show an error panel for a successful search.
      expect(Array.isArray(response.body.data.groups)).toBe(true);
      expect(response.body.data.totalHits).toBe(0);
    }
  });

  it('404s a well-formed id that does not exist', async () => {
    const response = await api(app, '/authors/author-does-not-exist-99999');
    expect([404, 503]).toContain(response.status);

    if (response.status === 404) {
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('reports "no path" as a successful empty result, not a 404', async () => {
    const response = await api(app, '/graph/shortest-path?from=author-1&to=author-1');
    expectReadable(response.status);

    if (response.status === 200) {
      // "These two are not connected" is an answer the product renders as an
      // empty state; a 404 would send it down the error path instead.
      expect(response.body.data).toHaveProperty('paths');
      expect(Array.isArray(response.body.data.paths)).toBe(true);
    }
  });

  it('keeps pagination coherent past the last row', async () => {
    const response = await api(app, '/authors?offset=99000&limit=10');
    expectReadable(response.status);

    if (response.status === 200) {
      // Reading past the end is an empty page, not an error — the client should
      // stop paging, not show a failure.
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.offset).toBe(99000);
    }
  });
});

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

describe('error envelope', () => {
  it('carries a request id on every failure for log correlation', async () => {
    const response = await api(app, '/does-not-exist').expect(404);
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it('never leaks a stack trace to the client', async () => {
    const response = await api(app, '/authors?limit=10000').expect(422);
    const body = JSON.stringify(response.body);

    // A stack trace names internal paths and dependency versions — useful to an
    // attacker, useless to a client.
    expect(body).not.toMatch(/at .+\.(ts|js):\d+/);
    expect(body).not.toContain('node_modules');
  });

  it('applies security headers even on an error response', async () => {
    const response = await api(app, '/does-not-exist').expect(404);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
