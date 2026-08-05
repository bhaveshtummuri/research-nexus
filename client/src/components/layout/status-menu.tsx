import {
  Activity,
  BookOpen,
  Check,
  Database,
  Keyboard,
  Moon,
  Sun,
  TriangleAlert,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDatabaseStatus } from '@/hooks/use-api';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

/**
 * System status indicator.
 *
 * This application has no accounts and performs no writes, so there is nothing
 * to notify a *user* about. What there is to report is infrastructure: whether
 * the API is answering and whether CognoDB is connected. Surfacing that — rather
 * than inventing an inbox — is what makes this control worth its place in the
 * header, and it is the difference a reader will notice first when the graph
 * stops responding.
 */
export function StatusMenu() {
  const { data, isError, isLoading } = useDatabaseStatus();

  const state = isError ? 'unreachable' : (data?.state ?? 'connecting');
  const isHealthy = state === 'connected';
  const isPending = isLoading || state === 'connecting';

  const label = isError
    ? 'API unreachable'
    : isHealthy
      ? 'All systems operational'
      : isPending
        ? 'Checking connection…'
        : 'Graph database unavailable';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={`System status: ${label}`}
      >
        <Activity className="size-4" aria-hidden />
        <span
          aria-hidden
          className={cn(
            'absolute right-1 top-1 size-1.5 rounded-full ring-2 ring-background',
            isHealthy && 'bg-emerald-500',
            isPending && 'bg-amber-400',
            !isHealthy && !isPending && 'animate-pulse bg-destructive',
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>System status</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="space-y-2 px-2 py-1.5">
          <StatusRow
            icon={isHealthy ? Check : TriangleAlert}
            tone={isHealthy ? 'ok' : isPending ? 'pending' : 'bad'}
            label={label}
          />

          {data ? (
            <dl className="space-y-1 rounded-md bg-surface-muted p-2 text-2xs">
              <Row term="Endpoint" value={data.uri} />
              <Row term="Database" value={data.database ?? 'default'} />
              <Row term="Protocol" value={data.serverVersion ?? '—'} />
              {data.lastCheckedAt ? (
                <Row term="Checked" value={new Date(data.lastCheckedAt).toLocaleTimeString()} />
              ) : null}
            </dl>
          ) : null}

          {data?.lastError ? (
            <p className="rounded-md bg-destructive/10 p-2 text-2xs leading-relaxed text-destructive">
              {data.lastError}
            </p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusRow({
  icon: Icon,
  tone,
  label,
}: {
  icon: typeof Check;
  tone: 'ok' | 'pending' | 'bad';
  label: string;
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-xs font-medium',
        tone === 'ok' && 'text-emerald-500',
        tone === 'pending' && 'text-amber-500',
        tone === 'bad' && 'text-destructive',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </p>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="truncate font-mono text-[10px]">{value}</dd>
    </div>
  );
}

/**
 * Account menu.
 *
 * Research Nexus is an unauthenticated, read-only explorer, so this presents the
 * viewer as a guest rather than fabricating a signed-in identity. It carries the
 * controls that genuinely belong to a person's session — appearance and
 * shortcuts — plus the entry points to the graph documentation.
 */
export function UserMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-8 place-items-center rounded-full bg-primary/12 text-primary transition-colors hover:bg-primary/20"
        aria-label="Account and preferences"
      >
        <User className="size-4" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-foreground">Guest researcher</span>
          <span className="block text-2xs font-normal text-muted-foreground">
            Read-only access · no sign-in required
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        {(
          [
            ['light', 'Light', Sun],
            ['dark', 'Dark', Moon],
          ] as const
        ).map(([value, label, Icon]) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon className="size-3.5" aria-hidden />
            <span className="flex-1">{label}</span>
            {theme === value ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/graph">
            <Database className="size-3.5" aria-hidden />
            Graph explorer
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/analytics">
            <BookOpen className="size-3.5" aria-hidden />
            Graph analytics
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="flex items-center gap-2 text-2xs text-muted-foreground">
            <Keyboard className="size-3.5 shrink-0" aria-hidden />
            <span>
              Press{' '}
              <kbd className="rounded border border-border bg-surface-muted px-1">⌘</kbd>
              <kbd className="ml-0.5 rounded border border-border bg-surface-muted px-1">K</kbd> to
              search
            </span>
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
