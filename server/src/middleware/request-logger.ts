import type { RequestHandler } from 'express';
import morgan from 'morgan';

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ scope: 'http' });

/**
 * HTTP access logging.
 *
 * Morgan produces the access line; our structured logger writes it. Piping one
 * into the other is what keeps a single log stream: production emits
 * newline-delimited JSON that a shipper can parse without configuration, while
 * development stays a readable line — and non-HTTP events (driver lifecycle,
 * slow queries, shutdown) share the same format.
 */
morgan.token('duration', (_req, res) => {
  const started = (res as { locals?: { startedAt?: bigint } }).locals?.startedAt;
  if (!started) return '0';
  return (Number(process.hrtime.bigint() - started) / 1_000_000).toFixed(1);
});

const FORMAT = ':method :url :status :duration :res[content-length]';

export const accessLogger: RequestHandler = morgan(FORMAT, {
  // Health probes fire every few seconds on most platforms; logging them buries
  // the requests anyone actually wants to read.
  skip: (req) => req.path.endsWith('/health'),
  stream: {
    write(line: string) {
      const [method, url, status, duration, size] = line.trim().split(' ');
      const statusCode = Number(status);
      const context = {
        method,
        path: url,
        status: statusCode,
        durationMs: Number(duration),
        bytes: size === '-' ? 0 : Number(size),
      };

      if (statusCode >= 500) log.error('Request completed', context);
      else if (statusCode >= 400) log.warn('Request completed', context);
      else log.info('Request completed', context);
    },
  },
});

/** Stamps a high-resolution start time for the `:duration` token. */
export const requestTimer: RequestHandler = (_req, res, next) => {
  res.locals.startedAt = process.hrtime.bigint();
  next();
};

/** Composed middleware: timer first, so the access log can measure duration. */
export const requestLogger: RequestHandler[] = config.isTest
  ? [requestTimer]
  : [requestTimer, accessLogger];
