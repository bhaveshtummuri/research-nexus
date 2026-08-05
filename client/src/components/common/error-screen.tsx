import {
  AlertTriangle,
  ArrowLeft,
  DatabaseZap,
  Home,
  RefreshCw,
  ServerCrash,
  TimerOff,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Full-page failure screen.
 *
 * The inline `ErrorState` is for a panel that failed inside an otherwise working
 * page; this is for when the whole view is gone — a render crash, a dead API, an
 * unroutable URL. It always offers a way out, because a dead end with no action
 * is what makes an error feel like a bug rather than a condition.
 */
interface ErrorScreenProps {
  error?: unknown;
  /** Overrides the diagnosis derived from `error`. */
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Shown as the primary action when recovery in place is possible. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Technical detail, collapsed by default. */
  detail?: string;
  className?: string;
}

export function ErrorScreen({
  error,
  title,
  description,
  icon,
  onRetry,
  retryLabel = 'Try again',
  detail,
  className,
}: ErrorScreenProps) {
  const diagnosis = describeFailure(error);
  const Icon = icon ?? diagnosis.icon;
  const technical = detail ?? (error instanceof Error ? error.message : undefined);

  return (
    <div
      role="alert"
      className={cn(
        'relative flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center',
        className,
      )}
    >
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />

      <span className="grid size-14 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive">
        <Icon className="size-6" aria-hidden />
      </span>

      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
          {diagnosis.kicker}
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {title ?? diagnosis.title}
        </h1>
        <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {description ?? diagnosis.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry}>
            <RefreshCw className="size-4" />
            {retryLabel}
          </Button>
        ) : null}
        <Button variant={onRetry ? 'secondary' : 'default'} onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Reload the page
        </Button>
        <Button variant="secondary" onClick={() => window.history.back()}>
          <ArrowLeft className="size-4" />
          Go back
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/">
            <Home className="size-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      {technical ? (
        <details className="max-w-lg text-left">
          <summary className="cursor-pointer text-2xs text-muted-foreground transition-colors hover:text-foreground">
            Technical detail
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-surface-muted p-3 text-2xs leading-relaxed text-muted-foreground">
            {technical}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

interface Diagnosis {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
}

/**
 * Turns a failure into something the user can act on.
 *
 * The API's machine-readable error codes are what make this possible: a database
 * outage earns different advice from a timeout, and guessing from a message
 * string would be fragile.
 */
export function describeFailure(error: unknown): Diagnosis {
  if (error instanceof ApiRequestError) {
    if (error.code === 'NETWORK_ERROR') {
      return {
        icon: WifiOff,
        kicker: 'Network',
        title: 'Cannot reach the API',
        description:
          'The request never left the browser, or the server is not listening. Check your connection and that the API is running, then retry.',
      };
    }
    if (error.isTimeout) {
      return {
        icon: TimerOff,
        kicker: 'Timeout',
        title: 'The request took too long',
        description:
          'The API accepted the request but did not answer in time. Deep traversals are expensive — narrowing the depth or result limit usually helps.',
      };
    }
    if (error.isDatabaseDown) {
      return {
        icon: DatabaseZap,
        kicker: 'Database',
        title: 'The graph database is unavailable',
        description:
          'The API is running, but CognoDB is not accepting connections. Check COGNODB_URI and credentials in your .env, then reload — every view here is a graph traversal, so nothing loads until it is back.',
      };
    }
    if (error.status >= 500) {
      return {
        icon: ServerCrash,
        kicker: `${error.status}`,
        title: 'The server failed to handle this',
        description:
          'Something broke on the API side. The request id below identifies this exact failure in the server logs.',
      };
    }
    return {
      icon: AlertTriangle,
      kicker: `${error.status}`,
      title: 'The request was rejected',
      description: error.message,
    };
  }

  // A non-API error is either a render crash or something unclassified. The
  // message is kept as the description when there is one: discarding it in
  // favour of generic copy throws away the only clue the user can report.
  const message = error instanceof Error ? error.message.trim() : '';

  return {
    icon: ServerCrash,
    kicker: 'Error',
    title: 'This view stopped working',
    description:
      message ||
      'The page hit an unexpected error while rendering. Reloading usually clears it; if it keeps happening the detail below is the place to start.',
  };
}
