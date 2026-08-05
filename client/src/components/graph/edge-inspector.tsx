import { ArrowRight, ExternalLink, Spline } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EntityBadge } from '@/components/common/entity-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { entityHref, formatNumber, RELATIONSHIP_LABELS } from '@/lib/utils';
import type { GraphNodeView } from '@/types/api';

import type { SelectedEdge } from './graph-canvas';

/**
 * What each relationship type actually asserts.
 *
 * A type name alone is ambiguous to anyone who has not read the schema —
 * `INCLUDES` between a project and a paper could mean either direction. Stating
 * the semantics is the difference between a panel that documents the graph and
 * one that merely echoes it back.
 */
const RELATIONSHIP_DESCRIPTIONS: Record<string, string> = {
  AUTHORED: 'The researcher is a credited author of this publication.',
  CITES: 'The citing paper references the cited paper in its bibliography.',
  AFFILIATED_WITH: 'The researcher is attached to this institution.',
  HAS_TOPIC: 'The work is classified under this research topic.',
  HAS_KEYWORD: 'The paper carries this keyword as an index term.',
  PUBLISHED_IN: 'The paper appeared in this journal.',
  PRESENTED_AT: 'The paper was presented at this conference.',
  USES_DATASET: 'The research made use of this dataset.',
  FUNDS: 'The agency awarded a grant supporting this project.',
  COLLABORATED_WITH:
    'The two researchers have co-authored at least one paper. Materialised from co-authorship so multi-hop traversals stay shallow.',
  RELATED_TO: 'A curated link between two topics or keywords.',
  INCLUDES: 'The project counts this paper among its outputs.',
  PARTNERS_WITH: 'A formal research partnership between the two institutions.',
};

/** Properties that repeat what the panel already shows elsewhere. */
const HIDDEN_PROPERTIES = new Set(['id', 'searchText']);

/**
 * Side panel describing the selected relationship.
 *
 * Relationships in a graph carry data of their own — a collaboration knows how
 * many papers it covers and when it started — and that data is invisible unless
 * an edge can be selected. This panel is where the property-graph model stops
 * being an implementation detail and becomes something the user can read.
 */
export function EdgeInspector({
  edge,
  onSelectNode,
}: {
  edge: SelectedEdge | null;
  onSelectNode?: (node: GraphNodeView) => void;
}) {
  if (!edge) return null;

  const label = RELATIONSHIP_LABELS[edge.type] ?? edge.type;
  const description = RELATIONSHIP_DESCRIPTIONS[edge.type];

  const entries = Object.entries(edge.properties).filter(
    ([key, value]) => !HIDDEN_PROPERTIES.has(key) && value !== null && value !== '',
  );

  return (
    <div className="surface-gradient flex h-full flex-col rounded-lg border border-border">
      <div className="space-y-2 border-b border-border p-4">
        <Badge variant="primary">
          <Spline className="size-2.5" aria-hidden />
          Relationship
        </Badge>
        <h3 className="font-mono text-sm font-semibold leading-snug">{edge.type}</h3>
        <p className="text-xs text-muted-foreground">{description ?? `Typed as ${label}.`}</p>
      </div>

      {/* Direction matters: CITES read backwards is a different claim. */}
      <div className="space-y-2 border-b border-border p-4">
        <Endpoint node={edge.source} role="From" onSelect={onSelectNode} />
        <div className="flex items-center gap-2 pl-1 text-2xs text-muted-foreground">
          <ArrowRight className="size-3" aria-hidden />
          <span className="font-mono">{edge.type}</span>
        </div>
        <Endpoint node={edge.target} role="To" onSelect={onSelectNode} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Properties
        </p>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This relationship carries no properties of its own.
          </p>
        ) : (
          <dl className="space-y-2">
            {entries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2 text-xs">
                <dt className="truncate text-muted-foreground">{humanise(key)}</dt>
                <dd className="min-w-0 break-words">{format(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function Endpoint({
  node,
  role,
  onSelect,
}: {
  node: GraphNodeView;
  role: string;
  onSelect?: (node: GraphNodeView) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-2.5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {role}
      </p>
      <div className="flex items-start gap-2">
        <EntityBadge label={node.label} showDot={false} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-medium">{node.name}</p>
          <p className="text-2xs text-muted-foreground">
            {formatNumber(node.degree)} relationship{node.degree === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <Button asChild variant="ghost" size="sm" className="h-6 px-1.5 text-2xs">
          <Link to={entityHref(node.label, node.id)}>
            <ExternalLink className="size-3" />
            Open
          </Link>
        </Button>
        {onSelect ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-2xs"
            onClick={() => onSelect(node)}
          >
            Select in graph
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
