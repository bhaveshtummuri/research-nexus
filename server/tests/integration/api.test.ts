import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';
import { closeDriver } from '../../src/database/driver.js';

/**
 * HTTP-layer integration tests.
 *
 * These mount the real Express app but do not require a database. Their job is
 * to prove the contract the client depends on: the envelope shape, the error
 * codes, validation rejection, and - importantly - that a missing database
 * degrades to a clean 503 rather than a hang or a stack trace.
 */
describe('API surface', () => {
  let app: Express;
  const api = config.http.apiPrefix;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await closeDriver();
  });

  it('serves a service description at the root', async () => {
    const response = await request(app).get('/').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Research Nexus API');
    expect(response.body.data.apiPrefix).toBe(api);
  });

  it('answers the liveness probe without touching the database', async () => {
    const response = await request(app).get(`${api}/health`).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(typeof response.body.data.uptimeSeconds).toBe('number');
  });

  it('reports the database status on the readiness probe', async () => {
    const response = await request(app).get(`${api}/health/ready`);

    // Either outcome is valid depending on whether CognoDB is running; what
    // matters is that each answers with the envelope its status implies.
    expect([200, 503]).toContain(response.status);

    if (response.status === 200) {
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ready');
      expect(response.body.data.database.state).toBe('connected');
    } else {
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    }
  });

  it('never leaks credentials in the reported connection URI', async () => {
    const response = await request(app).get(`${api}/health/database`).expect(200);

    expect(response.body.data.uri).not.toMatch(/:[^/@]+@/);
  });

  it('lists the available resources at the API index', async () => {
    const response = await request(app).get(`${api}/`).expect(200);

    expect(response.body.data.resources).toEqual(expect.arrayContaining(['authors', 'graph']));
  });

  it('returns a structured 404 for an unknown route', async () => {
    const response = await request(app).get(`${api}/does-not-exist`).expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.requestId).toBeTruthy();
  });

  it('rejects a malformed entity id before reaching the database', async () => {
    const response = await request(app).get(`${api}/authors/not%20a%20valid%20id`).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects an out-of-range page size', async () => {
    const response = await request(app).get(`${api}/authors?limit=100000`).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a search term below the minimum length', async () => {
    const response = await request(app).get(`${api}/search?q=a`).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503, not 500, when the graph database is unreachable', async () => {
    const response = await request(app).get(`${api}/authors`);

    // With a live database this is a 200; without one it must be a clean 503
    // carrying the actionable error code the UI switches on.
    expect([200, 503]).toContain(response.status);
    if (response.status === 503) {
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
      expect(response.body.error.message).toMatch(/CognoDB/i);
    }
  });

  /**
   * The spec-shaped routes are aliases onto the same handlers as the nested
   * ones, so the risk they carry is a wiring mistake rather than a logic bug:
   * a typo'd path, a missing schema, or a handler bound to the wrong route.
   * Each of these must therefore reach a handler - anything but a 404.
   */
  it.each([
    '/recommendations/papers/paper-1',
    '/recommendations/authors/author-1',
    '/collaboration/researchers',
    '/collaboration/researchers/author-1',
    '/collaboration/path?from=author-1&to=author-2',
    '/citations/path?from=paper-1&to=paper-2',
    '/citations/paper-1',
    '/analytics/dashboard',
    '/analytics/trending-topics',
    '/analytics/popular-authors',
    '/graph',
    '/graph/author/author-1',
    '/graph/paper/paper-1',
    '/papers/paper-1/citation-tree',
    '/papers/paper-1/influential-citations',
    '/topics/topic-1/similar',
    '/analytics/most-cited-papers',
    '/analytics/connected-keywords',
    '/analytics/funded-areas',
    '/analytics/collaborative-institutions',
  ])('routes %s to a handler', async (path) => {
    const response = await request(app).get(`${api}${path}`);

    expect(response.status).not.toBe(404);
    // Without a database these resolve to 503; the point is that validation and
    // routing both passed, so the request got as far as the query layer.
    expect([200, 503]).toContain(response.status);
  });

  it('requires both endpoints on a path lookup', async () => {
    const response = await request(app).get(`${api}/citations/path?from=paper-1`).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown traversal mode on a path lookup', async () => {
    const response = await request(app)
      .get(`${api}/collaboration/path?from=author-1&to=author-2&mode=teleport`)
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies security headers and disables the framework fingerprint', async () => {
    const response = await request(app).get(`${api}/health`);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('advertises the rate limit on every response', async () => {
    const response = await request(app).get(`${api}/health`);

    expect(response.headers['ratelimit-limit']).toBe(String(config.rateLimit.maxRequests));
    expect(Number(response.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
  });
});
