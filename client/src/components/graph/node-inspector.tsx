import { ExternalLink, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EntityBadge } from '@/components/common/entity-badge';
import { Button } from '@/components/ui/button';
import { entityHref, formatNumber } from '@/lib/utils';
import type { GraphNodeView } from '@/types/api';

/** Properties that add nothing for a reader inspecting a node. */
const HIDDEN_PROPERTIES = new Set(['searchText', 'id', 'abstract', 'description', 'summary', 'researchStatement']);

/**
 * Side panel describing the selected node.
 *
 * Properties are rendered generically from the node's own property map, so a
 * new node label needs no changes here to be inspectable.
 */
export function NodeInspector({
  node,
  onExpand,
}: {
  node: GraphNodeView | null;
  onExpand?: (node: GraphNodeView) => void;
}) {
  if (!node) {
    return (
      <div className="surface-gradient flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 rounded-lg border border-border p-6 text-center">
        <p className="text-sm font-medium">Nothing selected</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Click a node in the graph to inspect its properties, or double-click one to expand its
          neighbourhood.
        </p>
      </div>
    );
  }

  const entries = Object.entries(node.properties)
    .filter(([key, value]) => !HIDDEN_PROPERTIES.has(key) && value !== null && value !== '')
    .slice(0, 12);

  return (
    <div className="surface-gradient flex h-full flex-col rounded-lg border border-border">
      <div className="space-y-2 border-b border-border p-4">
        <EntityBadge label={node.label} />
        <h3 className="text-pretty text-sm font-semibold leading-snug">{node.name}</h3>
        {node.caption ? <p className="text-xs text-muted-foreground">{node.caption}</p> : null}
        <p className="text-2xs text-muted-foreground">
          {formatNumber(node.degree)} relationship{node.degree === 1 ? '' : 's'} in the full graph
        </p>
      </div>

      <dl className="flex-1 space-y-2 overflow-y-auto p-4">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2 text-xs">
            <dt className="truncate text-muted-foreground">{humanise(key)}</dt>
            <dd className="min-w-0 break-words">{format(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex gap-2 border-t border-border p-3">
        <Button asChild variant="secondary" size="sm" className="flex-1">
          <Link to={entityHref(node.label, node.id)}>
            <ExternalLink className="size-3.5" />
            Open page
          </Link>
        </Button>
        {onExpand ? (
          <Button variant="outline" size="sm" onClick={() => onExpand(node)}>
            <Maximize2 className="size-3.5" />
            Expand
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function humanise(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

function format(value: unknown): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
