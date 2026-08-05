import { request, requestList, requestWithMeta, type QueryValue } from '@/lib/api';

/**
 * The shared HTTP client.
 *
 * Built on the native `fetch` API rather than a client library: the browser
 * baseline covers everything needed here (abort signals via `AbortController`,
 * JSON parsing, timeouts through the signal), and the envelope unwrapping and
 * error normalisation are ours regardless of the transport.
 */
export const httpClient = {
  /** Unwraps the success envelope and returns `data`. */
  get: request,
  /** Returns `data` together with pagination `meta`. */
  getWithMeta: requestWithMeta,
  /** List endpoints: `{ items, meta }`. */
  getList: requestList,
};

export type { QueryValue };
