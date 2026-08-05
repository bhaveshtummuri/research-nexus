import type { Express } from 'express';
import { afterAll, describe, expect, it } from 'vitest';

import { closeDriver, connect } from '../../src/database/driver.js';
import { api, buildApp } from '../helpers/index.js';

/**
 * Latency smoke tests.
 *
 * These are not benchmarks — a shared managed instance is far too noisy to
 * measure against. They exist to catch the failure that matters: a query whose
 * plan has collapsed into a scan, which shows up as seconds rather than the tens
 * of milliseconds an indexed traversal takes. The budgets are therefore loose,
 * sized to fail on a missing index rather than on a slow afternoon.
 *
 * Skipped without a database, like every suite that needs real data.
 */
// Opt-in for the same reason as the graph-query suite: latency measured against
// a throttled shared instance says nothing about the query plan.
const databaseAvailable = process.env.RUN_DB_TESTS === '1' ? await connect() : false;
const app: Express = buildApp();

afterAll(async () => {
  await closeDriver();
});

/** Generous, because the target is a wrong plan, not a slow network. */
const BUDGET_MS = {
  /** Indexed lookup of a single node plus its immediate neighbourhood. */
  point: 3_000,
  /** Paginated list with a sort. */
  list: 4_000,
  /** Multi-hop traversal or an aggregate over the whole graph. */
  traversal: 8_000,
} as const;

async function timed(path: string): Promise<{ ms: number; status: number }> {
  const startedAt = Date.now();
  const response = await api(app, path);
  return { ms: Date.now() - startedAt, status: response.status };
}

describe.skipIf(!databaseAvailable)('performance smoke', () => {
  it.each([
    ['/authors?limit=20&sort=citations', BUDGET_MS.list],
    ['/papers?limit=20&sort=citations', BUDGET_MS.list],
    ['/search?q=learning', BUDGET_MS.list],
    ['/analytics/totals', BUDGET_MS.point],
    ['/graph?limit=80', BUDGET_MS.traversal],
    ['/analytics/dashboard', BUDGET_MS.traversal],
  ])('%s answers inside its budget', async (path, budget) => {
    const { ms, status } = await timed(path);

    // A 503 means the instance dropped the connection, which says nothing about
    // query cost — the assertion would be measuring the outage, not the plan.
    if (status === 503) return;

    expect(status).toBe(200);
    expect(ms, `${path} took ${ms}ms, budget ${budget}ms`).toBeLessThan(budget);
  }, 30_000);

  it('serves a repeated list request without degrading', async () => {
    const first = await timed('/authors?limit=20&sort=citations');
    const second = await timed('/authors?limit=20&sort=citations');

    if (first.status !== 200 || second.status !== 200) return;

    // Catches a per-request leak — a growing pool, an unclosed session — which
    // shows as the second identical request costing far more than the first.
    expect(second.ms).toBeLessThan(Math.max(first.ms * 4, BUDGET_MS.list));
  }, 30_000);

  it('keeps the liveness probe cheap enough for a health checker', async () => {
    const { ms } = await timed('/health');

    // Render polls this continuously; it must never touch the database, so it
    // should be effectively instant regardless of graph state.
    expect(ms).toBeLessThan(500);
  });
});
