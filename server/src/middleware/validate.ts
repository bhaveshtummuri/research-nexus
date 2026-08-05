import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

import { ApiError } from '../utils/api-error.js';

/**
 * Parsed request data.
 *
 * Express types `req.query` and `req.params` as plain string records, so the
 * parsed output is attached under a dedicated key. Handlers then read strongly
 * typed values from `req.validated` instead of re-parsing strings.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validated?: { query?: unknown; params?: unknown; body?: unknown };
    }
  }
}

type Source = 'query' | 'params' | 'body';

function toApiError(error: z.ZodError, source: Source): ApiError {
  return ApiError.validation(`Invalid request ${source}.`,
    error.issues.map((issue) => ({
      path: issue.path.join('.') || source,
      message: issue.message,
    })),
  );
}

/**
 * Builds a middleware that validates one part of the request.
 *
 * Validation runs before the controller, so by the time a service is called
 * every number is inside its allowed range and every enum is a known value -
 * the graph queries never have to defend against hostile parameters.
 */
export function validate(schema: ZodTypeAny, source: Source = 'query') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(toApiError(result.error, source));
      return;
    }

    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

/** Reads the validated query, narrowed to the schema's output type. */
export function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

export function validatedParams<T>(req: Request): T {
  return (req.validated?.params ?? {}) as T;
}
