import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDriver } from '../../src/database/driver.js';
import { api, buildApp, databaseAvailable } from '../helpers/index.js';

/**
 * Every registered route is reached, and none returns an unhandled error.
 *
 * The route table is read out of the Express router at runtime rather than
 * written down here. That is deliberate: a hardcoded list silently goes stale
 * the moment someone adds an endpoint, whereas this fails the build until the
 * new route has a sample request — the coverage guarantee maintains itself.
 */
let app: Express;

/**
 * Every route is requested once, in `beforeAll`, and the three assertions below
 * read from the collected results.
 *
 * Requesting per-test instead would issue the full table three times over; with
 * a seeded database behind it — where a single analytics traversal can take
 * seconds — that is the difference between a suite that finishes and one that
 * times out.
 */
interface Probe {
  route: string;
  path: string;
  status: number;
  body: { data?: unknown; name?: string; error?: { code?: string } };
}

const probes: Probe[] = [];

beforeAll(async () => {
  app = buildApp();
  await databaseAvailable();

  for (const route of collectGetRoutes(app)) {
    const path = toRequestPath(route);
    const response = await api(app, path);
    probes.push({ route, path, status: response.status, body: response.body });
  }
}, 180_000);

afterAll(async () => {
  await closeDriver();
});

/** Concrete values substituted for path parameters. */
const PARAM_SAMPLES: Record<string, string> = {
  id: 'author-1',
};

/**
 * Query strings for routes whose validation requires them.
 *
 * Keyed by the route's declared path, so the mapping stays readable next to the
 * router itself.
 */
const REQUIRED_QUERY: Record<string, string> = {
  '/search': '?q=neural',
  '/graph/shortest-path': '?from=author-1&to=author-2',
  '/graph/expand': '?id=author-1',
  '/collaboration/path': '?from=author-1&to=author-2',
  '/citations/path': '?from=paper-1&to=paper-2',
  '/graph/subgraph': '?ids=author-1,author-2',
  '/keywords/:id/papers': '',
};

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
  regexp?: RegExp;
}

/** Walks the Express router tree and collects every registered GET path. */
function collectGetRoutes(instance: Express): string[] {
  const paths = new Set<string>();

  const walk = (stack: RouteLayer[], prefix: string): void => {
    for (const layer of stack) {
      if (layer.route) {
        if (layer.route.methods.get) paths.add(prefix + layer.route.path);
        continue;
      }
      const nested = layer.handle?.stack;
      if (nested) walk(nested, prefix);
    }
  };

  const router = (instance as unknown as { _router?: { stack: RouteLayer[] } })._router;
  const stack = router?.stack ?? (instance as unknown as { router?: { stack: RouteLayer[] } }).router?.stack;
  if (stack) walk(stack, '');

  return [...paths].sort();
}

function toRequestPath(routePath: string): string {
  const concrete = routePath.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const sample = PARAM_SAMPLES[name];
    if (!sample) throw new Error(`No sample value configured for path parameter :${name}`);
    return sample;
  });

  return concrete + (REQUIRED_QUERY[routePath] ?? '');
}

describe('route coverage', () => {
  it('discovers and exercises the registered route table', () => {
    // A guard on the guard: if introspection silently returned nothing, every
    // assertion below would vacuously pass.
    expect(probes.length).toBeGreaterThan(30);
  });

  it('reaches every registered GET route without an unhandled error', () => {
    const failures = probes
      .filter(
        (probe) =>
          // 404 on a *declared* static route means the request never reached its
          // handler — a wiring mistake. 5xx other than 503 means an exception
          // escaped the error middleware.
          (probe.status === 404 && !probe.route.includes(':')) ||
          (probe.status >= 500 && probe.status !== 503),
      )
      .map((probe) => `${probe.route} → ${probe.status} (${probe.body?.error?.code ?? 'no code'})`);

    expect(failures, `Routes failing:\n${failures.join('\n')}`).toEqual([]);
  });

  it('returns a consistent envelope from every route', () => {
    // Every response, success or failure, carries the same outer shape. The
    // client's error handling depends on reading `error.code` without first
    // knowing which endpoint it called.
    const malformed = probes
      .filter((probe) =>
        probe.status < 400
          ? probe.body?.data === undefined && probe.body?.name === undefined
          : typeof probe.body?.error?.code !== 'string',
      )
      .map((probe) => `${probe.route} → ${probe.status}`);

    expect(malformed, `Malformed envelopes:\n${malformed.join('\n')}`).toEqual([]);
  });

  it('answers every route with a documented status code', () => {
    // 200 served · 404 sample id absent from the seed · 503 no database.
    const unexpected = probes
      .filter((probe) => ![200, 404, 503].includes(probe.status))
      .map((probe) => `${probe.route} → ${probe.status}`);

    expect(unexpected, `Undocumented statuses:\n${unexpected.join('\n')}`).toEqual([]);
  });
});
