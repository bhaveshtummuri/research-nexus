import { ArrowDown, ArrowUp, Network, Quote, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityPicker, type PickedEntity } from '@/components/common/entity-picker';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Section } from '@/components/common/section';
import { CitationTreeView } from '@/components/graph/citation-tree';
import { PathTrail } from '@/components/graph/path-trail';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCitationChains, useCitationTree, useInfluentialCitations } from '@/hooks/use-api';
import { formatCompact } from '@/lib/utils';

type Direction = 'forward' | 'backward';

/**
 * Citation explorer.
 *
 * Walks `CITES` in one direction for several hops. Following a citation chain
 * relationally means one self-join per hop; here the depth is a parameter of a
 * single pattern.
 */
export function CitationsPage() {
  const [paper, setPaper] = useState<PickedEntity | null>(null);
  const [direction, setDirection] = useState<Direction>('forward');
  const [depth, setDepth] = useState(3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <Quote className="size-2.5" aria-hidden />
            Variable-length traversal
          </Badge>
        }
        title="Citation explorer"
        description="Trace a paper's intellectual ancestry or its downstream influence across multiple hops of the citation graph."
      />

      <div className="surface-gradient flex flex-col gap-3 rounded-lg border border-border p-5 lg:flex-row lg:items-end">
        <EntityPicker
          label="Paper"
          value={paper}
          onChange={setPaper}
          labels={['Paper']}
          placeholder="Search for a paper…"
          className="flex-1"
        />

        <div className="grid grid-cols-2 gap-3 lg:w-72">
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Direction
            </label>
            <Select
              value={direction}
              onChange={(event) => setDirection(event.target.value as Direction)}
              aria-label="Citation direction"
            >
              <option value="forward">What it cites</option>
              <option value="backward">What cites it</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Depth
            </label>
            <Select
              value={String(depth)}
              onChange={(event) => setDepth(Number(event.target.value))}
              aria-label="Chain depth"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} hops
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {paper ? (
        <Tabs defaultValue="tree">
          <TabsList>
            <TabsTrigger value="tree">Citation tree</TabsTrigger>
            <TabsTrigger value="chains">Chains</TabsTrigger>
            <TabsTrigger value="influential">Most influential</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="mt-4">
            <TreeResults
              id={paper.id}
              title={paper.title}
              direction={direction}
              depth={Math.min(depth, 4)}
            />
          </TabsContent>

          <TabsContent value="chains" className="mt-4">
            <ChainResults id={paper.id} direction={direction} depth={depth} />
          </TabsContent>

          <TabsContent value="influential" className="mt-4">
            <InfluentialResults id={paper.id} depth={Math.min(depth, 5)} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState
          icon={Quote}
          title="Pick a paper to trace"
          description="Highly cited papers produce the longest and most interesting chains."
        />
      )}
    </div>
  );
}

/**
 * The citation tree.
 *
 * The API returns the hierarchy flat, with each row naming the parent it hangs
 * from, because Cypher cannot return a nested structure of arbitrary depth. The
 * tree is rebuilt client-side in one pass.
 */
function TreeResults({
  id,
  title,
  direction,
  depth,
}: {
  id: string;
  title: string;
  direction: Direction;
  depth: number;
}) {
  const { data, isLoading, isError, error, refetch } = useCitationTree(id, {
    direction,
    depth,
    limit: 80,
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No citations at that depth"
        description="This paper has no recorded citations in that direction. Try switching direction or reducing depth."
      />
    );
  }

  return (
    <Section
      title="Citation tree"
      description={`${data.items.length} papers across ${data.meta.maxDepth} level(s) of the citation graph. Each paper appears once, attached at its shallowest point.`}
    >
      <CitationTreeView
        nodes={data.items}
        rootId={id}
        rootTitle={title}
        direction={direction}
      />
    </Section>
  );
}

/**
 * Lineages ranked by accumulated citations rather than by length — "which line
 * of descent mattered most" rather than "how is this connected".
 */
function InfluentialResults({ id, depth }: { id: string; depth: number }) {
  const { data, isLoading, isError, error, refetch } = useInfluentialCitations(id, {
    depth,
    limit: 6,
  });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No lineage to rank"
        description="Influence ranking needs at least one outgoing citation path from this paper."
      />
    );
  }

  return (
    <Section
      title="Most influential lineages"
      description="Ranked by citations accumulated across every paper on the route, so a longer chain through seminal work outranks a short one through obscure work."
    >
      <div className="space-y-3">
        {data.items.map((path, index) => (
          <div key={index} className="surface-gradient rounded-lg border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="primary">{formatCompact(path.influence)} accumulated citations</Badge>
              <span className="text-2xs text-muted-foreground">{path.length} hops</span>
            </div>
            <PathTrail path={path} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function ChainResults({
  id,
  direction,
  depth,
}: {
  id: string;
  direction: Direction;
  depth: number;
}) {
  const { data, isLoading, isError, error, refetch } = useCitationChains(id, {
    direction,
    depth,
    limit: 12,
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Quote}
        title="No chains at that depth"
        description="Try reducing the depth, or switch direction to follow influence instead of ancestry."
      />
    );
  }

  const Icon = direction === 'forward' ? ArrowDown : ArrowUp;

  return (
    <Section
      title={direction === 'forward' ? 'Intellectual ancestry' : 'Downstream influence'}
      description={
        direction === 'forward'
          ? 'Each chain follows the references this paper builds on, and their references in turn.'
          : 'Each chain follows the papers that cite this one, and the papers that cite those.'
      }
    >
      <div className="space-y-3">
        {data.items.map((chain, index) => (
          <div key={index} className="surface-gradient rounded-lg border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="primary">{chain.depth} hops</Badge>
              <span className="text-2xs text-muted-foreground">
                {formatCompact(chain.impact)} citations accumulated along the chain
              </span>
            </div>

            <ol className="space-y-2">
              {chain.papers.map((entry, position) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-2xs tabular-nums text-muted-foreground">
                      {position + 1}
                    </span>
                    {position < chain.papers.length - 1 ? (
                      <Icon className="my-0.5 size-3 text-muted-foreground" aria-hidden />
                    ) : null}
                  </span>
                  <Link
                    to={`/papers/${entry.id}`}
                    className="min-w-0 flex-1 pb-1 transition-colors hover:text-primary"
                  >
                    <span className="line-clamp-1 text-xs font-medium">{entry.title}</span>
                    <span className="text-2xs text-muted-foreground">
                      {entry.year} · {formatCompact(entry.citationCount)} citations
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Section>
  );
}
