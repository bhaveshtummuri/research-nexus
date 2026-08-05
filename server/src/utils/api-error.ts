/**
 * Machine-readable error codes returned to clients in `error.code`.
 *
 * The frontend switches on these rather than on HTTP status or message text,
 * so a copy change never breaks error handling in the UI.
 */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorDetail {
  path: string;
  message: string;
}

/**
 * The only error type the HTTP layer knows how to render. Services throw it
 * directly; unexpected failures are normalised into one by the error handler.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly details: ApiErrorDetail[];
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: ErrorCodeValue,
    message: string,
    options: { details?: ApiErrorDetail[]; cause?: unknown; expose?: boolean } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details ?? [];
    this.expose = options.expose ?? statusCode < 500;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError(400, ErrorCode.BAD_REQUEST, message, { details: details ?? [] });
  }

  static validation(message: string, details: ApiErrorDetail[]): ApiError {
    return new ApiError(422, ErrorCode.VALIDATION_ERROR, message, { details });
  }

  static notFound(resource: string, identifier?: string): ApiError {
    const message = identifier
      ? `${resource} "${identifier}" was not found.`
      : `${resource} was not found.`;
    return new ApiError(404, ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, ErrorCode.CONFLICT, message);
  }

  static rateLimited(message: string): ApiError {
    return new ApiError(429, ErrorCode.RATE_LIMITED, message);
  }

  static databaseUnavailable(
    message: string,
    cause?: unknown,
    details?: ApiErrorDetail[],
  ): ApiError {
    return new ApiError(503, ErrorCode.DATABASE_UNAVAILABLE, message, {
      cause,
      expose: true,
      details: details ?? [],
    });
  }

  static databaseError(message: string, cause?: unknown): ApiError {
    return new ApiError(500, ErrorCode.DATABASE_ERROR, message, { cause });
  }

  static queryTimeout(message: string, cause?: unknown): ApiError {
    return new ApiError(504, ErrorCode.QUERY_TIMEOUT, message, { cause, expose: true });
  }

  static internal(message = 'An unexpected error occurred.', cause?: unknown): ApiError {
    return new ApiError(500, ErrorCode.INTERNAL_ERROR, message, { cause });
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
