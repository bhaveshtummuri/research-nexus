import type { Server } from 'node:http';

import { createApp } from './app.js';
import { config } from './config/index.js';
import { closeDriver, connect, redactUri } from './database/driver.js';
import { logger } from './utils/logger.js';

const log = logger.child({ scope: 'server' });

/**
 * Boots the API.
 *
 * The HTTP server binds *first*, and the database connection is established in
 * the background. That ordering is deliberate: on free hosting tiers the
 * database frequently becomes reachable after the web service, and the connect
 * retry budget can run to a minute or more. Blocking on it would leave the
 * platform's health check timing out against a process that is otherwise
 * perfectly able to answer.
 *
 * A failed connection is never fatal. The server serves, `/health` stays green,
 * `/health/ready` reports `degraded`, data endpoints fail fast with 503, and a
 * background probe reconnects as soon as the graph comes up.
 */
function start(): void {
  const app = createApp();

  const server: Server = app.listen(config.http.port, config.http.host, () => {
    log.info('Research Nexus API listening', {
      url: `http://${config.http.host}:${config.http.port}${config.http.apiPrefix}`,
      environment: config.env,
      database: redactUri(config.database.uri),
    });
  });

  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;

  registerShutdownHandlers(server);

  // Connect without blocking the listen callback. `connect` handles its own
  // retries and never rejects, so a failure here degrades rather than crashes.
  void connect().then((connected) => {
    log.info('Startup complete', { databaseConnected: connected });
  });
}

/**
 * Graceful shutdown: stop accepting connections, drain in-flight requests, then
 * close the driver pool. A hard timeout guarantees the process exits even if a
 * socket refuses to drain.
 */
function registerShutdownHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Shutting down', { signal });

    const forceExit = setTimeout(() => {
      log.warn('Shutdown timed out; forcing exit');
      process.exit(1);
    }, config.http.shutdownTimeoutMs);
    forceExit.unref();

    server.close((error) => {
      void (async () => {
        if (error) log.error('Error while closing HTTP server', { error: error.message });
        await closeDriver();
        clearTimeout(forceExit);
        log.info('Shutdown complete');
        process.exit(error ? 1 : 0);
      })();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception; shutting down', { error: error.message });
    shutdown('uncaughtException');
  });
}

try {
  start();
} catch (error) {
  log.error('Failed to start server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
