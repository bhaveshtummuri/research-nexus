import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, request, requestList } from '@/lib/api';

function mockFetch(response: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  return vi.fn().mockResolvedValue({
    ok: init.ok ?? status < 400,
    status,
    statusText: 'Mocked',
    json: async () => response,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('unwraps the success envelope', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true, data: { id: 'author-0001' } }));

    await expect(request<{ id: string }>('/authors/author-0001')).resolves.toEqual({
      id: 'author-0001',
    });
  });

  it('serialises query parameters and omits empty ones', async () => {
    const fetchMock = mockFetch({ success: true, data: [] });
    vi.stubGlobal('fetch', fetchMock);

    await request('/authors', {
      params: { search: 'chen', limit: 20, empty: '', missing: undefined, types: ['A', 'B'] },
    });

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('search=chen');
    expect(url).toContain('limit=20');
    expect(url).toContain('types=A%2CB');
    expect(url).not.toContain('empty=');
    expect(url).not.toContain('missing=');
  });

  it('preserves the server error code so the UI can react to it', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        {
          success: false,
          error: { code: 'DATABASE_UNAVAILABLE', message: 'CognoDB is unreachable.' },
          requestId: 'req-1',
        },
        { status: 503 },
      ),
    );

    await expect(request('/authors')).rejects.toMatchObject({
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      requestId: 'req-1',
    });
  });

  it('reports a network failure with an actionable code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(request('/authors')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('survives an error response that is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    );

    await expect(request('/authors')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' });
  });
});

describe('requestList', () => {
  it('returns items alongside pagination metadata', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        success: true,
        data: [{ id: 'author-0001' }],
        meta: { offset: 0, limit: 20, count: 1, total: 300, hasMore: true },
      }),
    );

    const result = await requestList<{ id: string }>('/authors');

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(300);
    expect(result.meta.hasMore).toBe(true);
  });

  it('defaults meta to an empty object when the server omits it', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true, data: [] }));
    await expect(requestList('/authors')).resolves.toEqual({ items: [], meta: {} });
  });
});

describe('ApiRequestError', () => {
  it('classifies which failures are worth retrying', () => {
    expect(new ApiRequestError(503, 'DATABASE_UNAVAILABLE', 'down').isRetryable).toBe(true);
    expect(new ApiRequestError(429, 'RATE_LIMITED', 'slow down').isRetryable).toBe(true);
    expect(new ApiRequestError(404, 'NOT_FOUND', 'missing').isRetryable).toBe(false);
    expect(new ApiRequestError(422, 'VALIDATION_ERROR', 'bad').isRetryable).toBe(false);
  });

  it('exposes the specific conditions the UI branches on', () => {
    expect(new ApiRequestError(503, 'DATABASE_UNAVAILABLE', 'down').isDatabaseDown).toBe(true);
    expect(new ApiRequestError(404, 'NOT_FOUND', 'missing').isNotFound).toBe(true);
  });
});
