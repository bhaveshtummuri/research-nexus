import { checkLiveness, checkReadiness, currentDatabaseStatus } from '../health/index.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Health controllers.
 *
 * The probes themselves live in `health/`; these handlers only translate a
 * report into an HTTP response.
 */

/** Liveness probe - never touches the database. */
export const getLiveness = asyncHandler(async (_req, res) => {
  sendSuccess(res, checkLiveness());
});

/**
 * Readiness probe.
 *
 * The degraded case is raised as an `ApiError` rather than returned as a
 * success envelope with a 503 status. That keeps the response union honest - a
 * non-2xx response always carries `error`, never `data` - so the same client
 * parsing works here as everywhere else, with diagnostics riding in `details`.
 */
export const getReadiness = asyncHandler(async (_req, res) => {
  const report = await checkReadiness();

  if (!report.ready) {
    throw ApiError.databaseUnavailable(
      'The API is running but CognoDB is not reachable, so data endpoints are unavailable.',
      undefined,
      [
        { path: 'database.state', message: report.database.state },
        { path: 'database.uri', message: report.database.uri },
        { path: 'database.lastError', message: report.database.lastError ?? 'unknown' },
        { path: 'checks.queryExecution', message: String(report.checks.queryExecution) },
      ],
    );
  }

  sendSuccess(res, {
    status: report.status,
    database: report.database,
    checks: report.checks,
    environment: report.environment,
    uptimeSeconds: report.uptimeSeconds,
  });
});

/** Cached connection status without a fresh probe. */
export const getDatabaseStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, currentDatabaseStatus());
});
