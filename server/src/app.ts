import compression from 'compression';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from '@/config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { requestLogger } from './middleware/request-logger.js';
import { createApiRouter } from '@/routes/index.js';
import { sendSuccess } from './utils/response.js';

/**
 * CORS policy.
 *
 * The allow-list comes from configuration. Requests without an `Origin` header
 * - curl, server-to-server calls, health checks - are permitted, because the
 * API is public and read-only; browser origins are checked strictly.
 */
function corsOptions(): CorsOptions {
  const allowed = new Set(config.http.corsOrigins);

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    },
    methods: ['GET', 'OPTIONS'],
    maxAge: 86_400,
  };
}

/**
 * Builds the Express application.
 *
 * The app is created separately from the HTTP server so integration tests can
 * mount it with supertest without opening a port or connecting to CognoDB.
 */
export function createApp(): Express {
  const app = express();

  // Trust the platform proxy so `req.ip` reflects the real client for rate
  // limiting on Render, Railway and Fly.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; a restrictive CSP here would apply to nothing
      // and complicate serving the OpenAPI-style index route.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(corsOptions()));
  app.use(compression());
  app.use(express.json({ limit: config.http.jsonBodyLimit }));
  app.use(requestLogger);
  app.use(createRateLimiter());

  app.use(config.http.apiPrefix, createApiRouter());

  // Root route so hitting the deployed URL explains what the service is.
  app.get('/', (_req, res) => {
    sendSuccess(res, {
      name: 'Research Nexus API',
      status: 'running',
      apiPrefix: config.http.apiPrefix,
      health: `${config.http.apiPrefix}/health`,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
