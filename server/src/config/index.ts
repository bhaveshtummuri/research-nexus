import { env, isProduction, isTest } from './env.js';

/**
 * Application configuration, grouped by concern. Every module reads from this
 * object rather than `process.env`, which keeps environment access in one place
 * and makes the settings trivially mockable in tests.
 */
export const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction,
  isTest,

  http: Object.freeze({
    port: env.PORT,
    host: env.HOST,
    apiPrefix: env.API_PREFIX,
    corsOrigins: env.CORS_ORIGINS,
    /** Graceful shutdown budget before in-flight sockets are destroyed. */
    shutdownTimeoutMs: 10_000,
    /** Payloads are small JSON documents; anything larger is a mistake. */
    jsonBodyLimit: '256kb',
  }),

  database: Object.freeze({
    uri: env.COGNODB_URI,
    username: env.COGNODB_USERNAME,
    password: env.COGNODB_PASSWORD,
    database: env.COGNODB_DATABASE,
    maxPoolSize: env.COGNODB_MAX_POOL_SIZE,
    connectionTimeoutMs: env.COGNODB_CONNECTION_TIMEOUT_MS,
    maxTransactionRetryTimeMs: env.COGNODB_MAX_TRANSACTION_RETRY_MS,
    encrypted: env.COGNODB_ENCRYPTED,
    /** Connectivity is re-verified in the background at this cadence. */
    healthProbeIntervalMs: 30_000,
    /**
     * Attempts made during boot before the process gives up on eager connect.
     *
     * Backoff is collapsed under test: the retry *behaviour* is what the suite
     * verifies, and waiting out real exponential delays would add a minute to
     * every run on a machine with no database — which is the normal case on a
     * fresh clone and in CI.
     */
    connectRetries: isTest ? 2 : 5,
    connectRetryBaseDelayMs: isTest ? 5 : 750,
  }),

  rateLimit: Object.freeze({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  }),

  limits: Object.freeze({
    maxPageSize: env.MAX_PAGE_SIZE,
    defaultPageSize: 20,
    maxGraphNodes: env.MAX_GRAPH_NODES,
    /** Upper bound on `*..n` variable-length traversals exposed to clients. */
    maxTraversalDepth: 4,
  }),

  logging: Object.freeze({
    level: env.LOG_LEVEL,
  }),
});

export type AppConfig = typeof config;
export { env } from './env.js';
