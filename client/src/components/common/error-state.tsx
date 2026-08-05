import { RefreshCw } from 'lucide-react';

import { describeFailure } from '@/components/common/error-screen';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * Renders a failure in terms the user can act on, inside the panel that failed.
 *
 * The diagnosis is shared with the full-page `ErrorScreen` so a database outage
 * is described identically whether it takes down one card or the whole route —
 * two wordings for one condition is how an interface starts feeling incoherent.
 */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { icon: Icon, title, description } = describeFailure(error);
  const requestId = error instanceof ApiRequestError ? error.requestId : undefined;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="rounded-full border border-destructive/25 bg-destructive/10 p-3">
        <Icon className="size-5 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto max-w-md text-pretty text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      ) : null}
      {requestId ? (
        <p className="font-mono text-2xs text-muted-foreground/70">Request {requestId}</p>
      ) : null}
    </div>
  );
}
