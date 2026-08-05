import type { ApiFailure, ApiSuccess, Paged, ResponseMeta } from '@/types/api';

/**
 * In development Vite proxies `/api/v1` to the local server, so the default is a
 * relative path and requests stay same-origin. Production builds point at the
 * deployed API through `VITE_API_BASE_URL`.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

/**
 * A request that has not answered in this long is treated as failed.
 *
 * Without a ceiling a stalled connection hangs a loading spinner indefinitely,
 * which reads to the user as a frozen app rather than a failure they can retry.
 * The bound is generous because deep graph traversals are legitimately slow.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * A failed API call, carrying the server's machine-readable code.
 *
 * The UI switches on `code` - showing a "database unavailable" panel rather than
 * a generic error, for example - which is why the code is preserved instead of
 * collapsing every failure into a message string.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ path: string; message: string }>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Array<{ path: string; message: string }> = [],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
    if (requestId) this.requestId = requestId;
  }

  /** True when retrying later is likely to succeed. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }

  get isDatabaseDown(): boolean {
    return this.code === 'DATABASE_UNAVAILABLE';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isTimeout(): boolean {
    return this.code === 'TIMEOUT';
  }
}

export type QueryValue = string | number | boolean | undefined | null | string[];

/** Serialises query parameters, dropping empties so URLs stay clean. */
function toQueryString(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseFailure(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as ApiFailure;
    return new ApiRequestError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? response.statusText,
      body.error?.details ?? [],
      body.requestId,
    );
  } catch {
    return new ApiRequestError(
      response.status,
      'UNKNOWN',
      response.statusText || 'The request failed.',
    );
  }
}

interface RequestOptions {
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/**
 * Performs a request and unwraps the success envelope.
 *
 * The envelope is stripped here so every consumer works with plain domain
 * objects; `requestWithMeta` is available when pagination metadata is needed.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await requestWithMeta<T>(path, options);
  return data;
}

export async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: ResponseMeta }> {
  const url = `${BASE_URL}${path}${toQueryString(options.params)}`;

  // The timer and the caller's own signal are merged into one controller. They
  // must stay distinguishable: a caller abort is a cancelled query (React Query
  // unmounting a component) and should propagate untouched, whereas a timeout is
  // a failure the user needs to see. `timedOut` is what tells them apart, since
  // both arrive as the same AbortError.
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) throw await parseFailure(response);

    // Reading the body stays inside the timeout: a server that sends headers and
    // then stalls mid-stream would otherwise hang exactly as before.
    const body = (await response.json()) as ApiSuccess<T>;
    return { data: body.data, meta: body.meta ?? {} };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;

    if (isAbort(error)) {
      if (!timedOut) throw error;
      throw new ApiRequestError(
        408,
        'TIMEOUT',
        `The API did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }

    // A network-level failure never reaches the server, so there is no envelope
    // to parse; it is surfaced with a code the UI can recognise.
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the Research Nexus API. Check that the server is running.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** jsdom and some polyfills raise a plain Error rather than a DOMException. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Convenience wrapper for list endpoints, keeping items and meta together. */
export async function requestList<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paged<T>> {
  const { data, meta } = await requestWithMeta<T[]>(path, options);
  return { items: data, meta };
}

export const apiBaseUrl = BASE_URL;
