import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { ErrorBoundary } from '@/components/common/error-boundary';
import { ErrorScreen } from '@/components/common/error-screen';

/**
 * Error boundary scoped to a route.
 *
 * Keyed on the pathname, so a crash on one page clears itself as soon as the
 * user navigates elsewhere — without this the boundary would stay latched and
 * every subsequent route would render the error screen instead of the page.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary
      resetKey={location.pathname}
      fallback={(error, reset) => (
        <ErrorScreen error={error} onRetry={reset} retryLabel="Retry this page" />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Boundary for a single panel inside a working page.
 *
 * Used where one widget carries meaningfully more risk than its neighbours — the
 * graph canvas, mainly — so a failure there costs the canvas rather than the
 * page around it.
 */
export function PanelBoundary({
  children,
  title,
  description,
  resetKey,
}: {
  children: ReactNode;
  title: string;
  description: string;
  resetKey?: unknown;
}) {
  return (
    <ErrorBoundary
      {...(resetKey === undefined ? {} : { resetKey })}
      fallback={(error, reset) => (
        <ErrorScreen
          error={error}
          title={title}
          description={description}
          onRetry={reset}
          retryLabel="Rebuild"
          className="min-h-[24rem]"
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
