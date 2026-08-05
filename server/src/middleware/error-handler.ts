import { randomUUID } from 'node:crypto';

import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

import { config } from '../config/index.js';
import { translateDatabaseError } from '../database/query.js';
import { ApiError, ErrorCode, isApiError } from '../utils/api-error.js';
import { logger } from '../utils/logger.js';
import type { ErrorEnvelope } from '../utils/response.js';

const log = logger.child({ scope: 'http' });

/** Terminal handler for unmatched routes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, ErrorCode.NOT_FOUND, `No route matches ${req.method} ${req.path}.`));
};

function normalise(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (error instanceof ZodError) {
    return ApiError.validation(
      'Request validation failed.',
      error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('The request body is not valid JSON.');
  }

  // Driver failures reaching this point are translated so the client still gets
  // a 503 rather than a generic 500 when the database is the actual problem.
  return translateDatabaseError(error);
}

/**
 * Converts every failure into the single error envelope the client understands.
 *
 * 5xx messages are replaced with a generic string in production so internal
 * details never reach a browser, while the full error - including the cause
 * chain - is logged with a request id the user can quote in a bug report.
 */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const apiError = normalise(error);
  const requestId = randomUUID();

  const logContext = {
    requestId,
    statusCode: apiError.statusCode,
    code: apiError.code,
    error: apiError.message,
    cause: apiError.cause instanceof Error ? apiError.cause.message : undefined,
  };

  if (apiError.statusCode >= 500) {
    log.error('Request failed', logContext);
  } else {
    log.warn('Request rejected', logContext);
  }

  const exposeMessage = apiError.expose || !config.isProduction;

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: apiError.code,
      message: exposeMessage ? apiError.message : 'An unexpected error occurred.',
      ...(apiError.details.length > 0 ? { details: apiError.details } : {}),
    },
    requestId,
  };

  res.status(apiError.statusCode).json(body);
};
