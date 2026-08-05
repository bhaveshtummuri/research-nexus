import type { RequestHandler } from 'express';

import { config } from '../config/index.js';
import { ApiError } from '../utils/api-error.js';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter backed by an in-process map.
 *
 * This is deliberately not a distributed limiter. The API is read-only and
 * deployed as a single instance on free hosting, so an in-memory counter is the
 * right amount of machinery: it protects the database from a runaway client
 * without adding Redis to the deployment. A multi-instance deployment would
 * swap this for a shared store, which is why the logic lives behind one factory.
 */
export function createRateLimiter(): RequestHandler {
  const windows = new Map<string, Window>();
  const { windowMs, maxRequests } = config.rateLimit;

  // Expired entries are swept lazily rather than on a timer, so an idle process
  // never wakes up just to clean a map.
  const sweep = (now: number): void => {
    if (windows.size < 1000) return;
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    sweep(now);

    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const existing = windows.get(key);

    if (!existing || existing.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      setRateLimitHeaders(res, maxRequests, maxRequests - 1, now + windowMs);
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > maxRequests) {
      setRateLimitHeaders(res, maxRequests, 0, existing.resetAt);
      res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
      next(
        ApiError.rateLimited(
          `Too many requests. The limit is ${maxRequests} per ${Math.round(windowMs / 1000)}s.`,
        ),
      );
      return;
    }

    setRateLimitHeaders(res, maxRequests, maxRequests - existing.count, existing.resetAt);
    next();
  };
}

function setRateLimitHeaders(
  res: Parameters<RequestHandler>[1],
  limit: number,
  remaining: number,
  resetAt: number,
): void {
  res.setHeader('RateLimit-Limit', limit);
  res.setHeader('RateLimit-Remaining', Math.max(remaining, 0));
  res.setHeader('RateLimit-Reset', Math.ceil(resetAt / 1000));
}
