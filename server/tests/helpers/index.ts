import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { config } from '../../src/config/index.js';
import { connect } from '../../src/database/driver.js';

/**
 * Shared test utilities.
 *
 * Two things live here rather than in each suite: building the app the same way
 * every time, and the database-availability gate. The gate is what lets one test
 * file serve both a fresh clone with no database and a fully seeded local
 * machine — the same assertions run in both, with the ones that need real data
 * skipping themselves rather than failing.
 */

export const apiPrefix = config.http.apiPrefix;

export function buildApp(): Express {
  return createApp();
}

/** `GET` against the API prefix, so suites never repeat the prefix. */
export function api(app: Express, path: string) {
  return request(app).get(`${apiPrefix}${path}`);
}

/**
 * Attempts a connection once and caches the result for the whole run.
 *
 * Without the cache every suite would pay the full retry backoff — five attempts
 * at exponential delay — before deciding the database is absent.
 */
let availability: Promise<boolean> | null = null;

export function databaseAvailable(): Promise<boolean> {
  availability ??= connect();
  return availability;
}

/**
 * Status codes a read endpoint may legitimately return.
 *
 * `200` with a database, `503` without one. Anything else — a 500 from an
 * unhandled throw, a 404 from a mis-wired route — is a defect, which is why
 * assertions use this set rather than skipping the check when data is absent.
 */
export const READ_OK_OR_UNAVAILABLE = [200, 503] as const;

export function expectReadable(status: number): void {
  if (!READ_OK_OR_UNAVAILABLE.includes(status as 200 | 503)) {
    throw new Error(
      `Expected 200 or 503 but received ${status}. A read endpoint must either answer or ` +
        'report the database as unavailable; any other status means routing, validation or ' +
        'error handling is wrong.',
    );
  }
}

/** Entity ids resolved from the seeded graph, or null when there is no database. */
export interface Fixtures {
  authorId: string | null;
  secondAuthorId: string | null;
  paperId: string | null;
  topicId: string | null;
  universityId: string | null;
}

export async function loadFixtures(app: Express): Promise<Fixtures> {
  const pick = async (path: string, index = 0): Promise<string | null> => {
    const response = await api(app, path);
    if (response.status !== 200) return null;
    const items = response.body?.data;
    return Array.isArray(items) ? (items[index]?.id ?? null) : null;
  };

  return {
    authorId: await pick('/authors?limit=2&sort=citations'),
    secondAuthorId: await pick('/authors?limit=2&sort=citations', 1),
    paperId: await pick('/papers?limit=1&sort=citations'),
    topicId: await pick('/topics?limit=1'),
    universityId: await pick('/universities?limit=1'),
  };
}
