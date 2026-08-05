import type { Response } from 'express';

import type { ApiErrorDetail, ErrorCodeValue } from './api-error.js';

export interface ResponseMeta {
  /** Zero-based offset of the first returned row. */
  offset?: number;
  /** Page size that was actually applied after clamping. */
  limit?: number;
  /** Number of rows in `data` for list responses. */
  count?: number;
  /** Total matching rows when the query computes one. */
  total?: number;
  /** True when another page is available. */
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCodeValue;
    message: string;
    details?: ApiErrorDetail[];
  };
  requestId?: string;
}

/**
 * Every successful response shares one envelope shape, so the frontend needs a
 * single unwrap helper instead of per-endpoint parsing.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: ResponseMeta,
  statusCode = 200,
): void {
  const body: SuccessEnvelope<T> = meta ? { success: true, data, meta } : { success: true, data };
  res.status(statusCode).json(body);
}

/** Builds the `meta` block for a list endpoint from the applied page window. */
export function listMeta(
  items: readonly unknown[],
  pagination: { offset: number; limit: number },
  total?: number,
): ResponseMeta {
  const meta: ResponseMeta = {
    offset: pagination.offset,
    limit: pagination.limit,
    count: items.length,
    hasMore: items.length === pagination.limit,
  };
  if (typeof total === 'number') {
    meta.total = total;
    meta.hasMore = pagination.offset + items.length < total;
  }
  return meta;
}
