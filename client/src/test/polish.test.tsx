import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/components/common/error-boundary';
import { describeFailure, ErrorScreen } from '@/components/common/error-screen';
import { splitOnMatches } from '@/components/common/highlight';
import { GraphSkeleton, TableSkeleton } from '@/components/common/loading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError, REQUEST_TIMEOUT_MS, requestWithMeta } from '@/lib/api';

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('render exploded');
  return <p>working</p>;
}

describe('ErrorBoundary', () => {
  // A caught error is logged on purpose; silencing it keeps the run readable.
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it('renders the fallback instead of unmounting the tree', () => {
    render(
      <ErrorBoundary fallback={(error) => <p>caught: {error.message}</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/caught: render exploded/)).toBeInTheDocument();
  });

  it('does not clear itself on the render that caught the error', () => {
    // The regression this guards: comparing resetKey against the *previous*
    // render's key makes the boundary reset immediately and loop forever.
    render(
      <ErrorBoundary resetKey="/authors" fallback={() => <p>fallback</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback')).toBeInTheDocument();
  });

  it('clears the error when the reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/authors" fallback={() => <p>fallback</p>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();

    // Navigating away must recover; otherwise one crash latches the boundary and
    // every subsequent route renders the error screen.
    rerender(
      <ErrorBoundary resetKey="/papers" fallback={() => <p>fallback</p>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('working')).toBeInTheDocument();
  });

  it('recovers through the reset callback handed to the fallback', () => {
    function Harness() {
      const [broken, setBroken] = useState(true);
      return (
        <ErrorBoundary
          fallback={(_error, reset) => (
            <button
              type="button"
              onClick={() => {
                setBroken(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Boom shouldThrow={broken} />
        </ErrorBoundary>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(screen.getByText('working')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Failure diagnosis
// ---------------------------------------------------------------------------

describe('describeFailure', () => {
  it('distinguishes a timeout from a generic failure', () => {
    const timeout = describeFailure(new ApiRequestError(408, 'TIMEOUT', 'too slow'));
    expect(timeout.kicker).toBe('Timeout');
    expect(timeout.description).toMatch(/depth|limit/i);
  });

  it('names the database when the API is up but the graph is not', () => {
    const down = describeFailure(new ApiRequestError(503, 'DATABASE_UNAVAILABLE', 'no bolt'));
    expect(down.title).toMatch(/graph database/i);
  });

  it('separates a network failure from a server error', () => {
    expect(describeFailure(new ApiRequestError(0, 'NETWORK_ERROR', 'x')).kicker).toBe('Network');
    expect(describeFailure(new ApiRequestError(500, 'INTERNAL', 'x')).kicker).toBe('500');
  });

  it('falls back to a render-crash description for a plain error', () => {
    // This is the path an ErrorBoundary takes: not an ApiRequestError at all.
    expect(describeFailure(new Error('undefined is not a function')).title).toMatch(
      /stopped working/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Request timeout
// ---------------------------------------------------------------------------

describe('request timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('converts a stalled request into a retryable TIMEOUT error', async () => {
    // A fetch that never settles unless its signal aborts — the exact shape of a
    // hung connection, which previously spun the loading state forever.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ),
    );

    const pending = requestWithMeta('/authors');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT', status: 408 });

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it('lets a caller cancellation stay an abort rather than becoming a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ),
    );

    // React Query aborts queries whose component unmounted. Reporting those as
    // timeouts would toast an error for something the user did on purpose.
    const controller = new AbortController();
    const pending = requestWithMeta('/authors', { signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow(/aborted/);

    controller.abort();
    await assertion;
  });
});

// ---------------------------------------------------------------------------
// Search highlighting
// ---------------------------------------------------------------------------

describe('splitOnMatches', () => {
  it('marks the matched run, case-insensitively', () => {
    expect(splitOnMatches('Graph Databases', 'graph')).toEqual([
      { value: 'Graph', matched: true },
      { value: ' Databases', matched: false },
    ]);
  });

  it('matches each term independently, in any order', () => {
    // The server does not require an exact phrase, so neither can the highlight.
    const segments = splitOnMatches('Neural Machine Translation', 'translation neural');
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.value)).toEqual([
      'Neural',
      'Translation',
    ]);
  });

  it('merges overlapping terms into one run rather than nesting marks', () => {
    const segments = splitOnMatches('research', 'rese sear');
    expect(segments).toEqual([
      { value: 'resear', matched: true },
      { value: 'ch', matched: false },
    ]);
  });

  it('returns the text untouched for an empty query', () => {
    expect(splitOnMatches('anything', '   ')).toEqual([{ value: 'anything', matched: false }]);
  });

  it('does not treat query punctuation as a pattern', () => {
    // Naive implementations build a RegExp from the query and throw here.
    expect(() => splitOnMatches('a (b) c', '(b)')).not.toThrow();
    expect(splitOnMatches('a (b) c', '(b)').some((segment) => segment.matched)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Table primitive
// ---------------------------------------------------------------------------

describe('Table', () => {
  const renderTable = () =>
    render(
      <Table caption="Institutions by output">
        <TableHeader>
          <TableRow>
            <TableHead>Institution</TableHead>
            <TableHead numeric>Papers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>MIT</TableCell>
            <TableCell numeric>312</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

  it('gives every column header a scope', () => {
    // Without scope a screen reader reads "row 14, 312" instead of "Papers, 312".
    renderTable();
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('exposes the caption to assistive tech without showing it', () => {
    renderTable();
    expect(screen.getByRole('region', { name: 'Institutions by output' })).toBeInTheDocument();
  });

  it('makes the scroll container keyboard reachable', () => {
    // A scrollable box that cannot be focused cannot be scrolled without a mouse.
    renderTable();
    expect(screen.getByRole('region')).toHaveAttribute('tabindex', '0');
  });

  it('right-aligns numeric cells with tabular figures', () => {
    renderTable();
    expect(screen.getByText('312').className).toMatch(/tabular-nums/);
  });
});

// ---------------------------------------------------------------------------
// Loading placeholders
// ---------------------------------------------------------------------------

describe('skeletons', () => {
  it('announce loading once rather than exposing every placeholder', () => {
    const { container } = render(<TableSkeleton rows={4} columns={3} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading table')).toHaveClass('sr-only');
    // The shapes themselves are noise to a screen reader.
    expect(container.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it('draws the graph placeholder as a graph, not a grey box', () => {
    const { container } = render(<GraphSkeleton />);
    expect(container.querySelectorAll('line').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.node-pulse').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error screen recovery
// ---------------------------------------------------------------------------

describe('ErrorScreen', () => {
  it('always offers a route out of the failure', () => {
    render(
      <MemoryRouter>
        <ErrorScreen error={new ApiRequestError(500, 'INTERNAL', 'boom')} />
      </MemoryRouter>,
    );

    // A dead end with no action is what makes an error feel like a bug.
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('collapses the technical detail instead of leading with it', () => {
    const { container } = render(
      <MemoryRouter>
        <ErrorScreen error={new Error('stack trace here')} />
      </MemoryRouter>,
    );

    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('stack trace here');
  });

  it('is announced as an alert so it is not silently swapped in', () => {
    render(
      <MemoryRouter>
        <ErrorScreen error={new Error('boom')} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
