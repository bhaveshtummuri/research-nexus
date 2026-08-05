import { Compass, Home, Network } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />

      <span className="grid size-14 place-items-center rounded-2xl border border-border bg-surface text-primary">
        <Compass className="size-6" aria-hidden />
      </span>

      <div className="space-y-2">
        <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">This node is not in the graph</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          The page you followed does not exist. It may have been renamed, or the entity id may be
          from a different seed of the database.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">
            <Home className="size-4" />
            Back to dashboard
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/graph">
            <Network className="size-4" />
            Explore the graph
          </Link>
        </Button>
      </div>
    </div>
  );
}
