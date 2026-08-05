import { ArrowRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { EntityBadge } from '@/components/common/entity-badge';
import { cn, entityHref, RELATIONSHIP_LABELS } from '@/lib/utils';
import type { GraphPath } from '@/types/api';

/**
 * Renders a discovered path as an ordered chain of entities and the
 * relationships between them - the human-readable form of what the traversal
 * found.
 */
export function PathTrail({ path, className }: { path: GraphPath; className?: string }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-2', className)}>
      {path.nodes.map((node, index) => {
        const edge = path.edges[index];
        return (
          <Fragment key={node.elementId}>
            <li>
              <Link
                to={entityHref(node.label, node.id)}
                className="surface-gradient flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40"
              >
                <EntityBadge label={node.label} showDot={false} />
                <span className="max-w-[14rem] truncate font-medium">{node.name}</span>
              </Link>
            </li>
            {edge ? (
              <li className="flex items-center gap-1 text-2xs text-muted-foreground" aria-hidden>
                <ArrowRight className="size-3" />
                {RELATIONSHIP_LABELS[edge.type] ?? edge.type.toLowerCase()}
                {typeof edge.properties.paperCount === 'number' ? (
                  <span className="tabular-nums">({edge.properties.paperCount})</span>
                ) : null}
              </li>
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
