import { Database, ExternalLink, FileText, GitBranch, Quote, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { DetailSkeleton, ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { ScoreBreakdown } from '@/components/common/score-bar';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { PaperCard } from '@/components/entities/paper-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCitationChains, usePaper, useSimilarPapers } from '@/hooks/use-api';
import { formatCompact, formatNumber } from '@/lib/utils';

export function PaperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: paper, isLoading, isError, error, refetch } = usePaper(id);
  useBreadcrumbLabel(paper?.title);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!paper) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="Paper" />
            <Badge variant="outline">{paper.year}</Badge>
            {paper.venue ? <Badge variant="primary">{paper.venue.name}</Badge> : null}
          </>
        }
        title={paper.title}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to={`/graph?focus=${paper.id}`}>
                <GitBranch className="size-4" />
                View in graph
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={paper.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Open
              </a>
            </Button>
          </>
        }
      />

      {paper.authors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {paper.authors.map((author) => (
            <Link key={author.id} to={`/authors/${author.id}`}>
              <Badge variant="outline" className="px-2.5 py-1 hover:border-graph-author/50">
                {author.name}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Citations" value={formatCompact(paper.citationCount)} icon={Quote} />
        <StatCard index={1} label="References" value={formatNumber(paper.referenceCount)} icon={FileText} />
        <StatCard index={2} label="Topics" value={formatNumber(paper.topics.length)} />
        <StatCard index={3} label="Datasets used" value={formatNumber(paper.datasets.length)} icon={Database} />
      </div>

      <Section title="Abstract">
        <p className="surface-gradient rounded-lg border border-border p-5 text-sm leading-relaxed text-muted-foreground">
          {paper.abstract}
        </p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="similar">
            <TabsList>
              <TabsTrigger value="similar">Similar papers</TabsTrigger>
              <TabsTrigger value="cited-by">Cited by ({paper.citedBy.length})</TabsTrigger>
              <TabsTrigger value="references">References ({paper.references.length})</TabsTrigger>
              <TabsTrigger value="chains">Citation chains</TabsTrigger>
            </TabsList>

            <TabsContent value="similar">
              <SimilarTab id={paper.id} />
            </TabsContent>

            <TabsContent value="cited-by">
              {paper.citedBy.length === 0 ? (
                <EmptyState icon={Quote} title="Not yet cited in this graph" />
              ) : (
                <div className="space-y-2">
                  {paper.citedBy.map((entry, index) => (
                    <PaperCard key={entry.id} paper={entry} index={index} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="references">
              {paper.references.length === 0 ? (
                <EmptyState icon={FileText} title="No references recorded" />
              ) : (
                <div className="space-y-2">
                  {paper.references.map((entry, index) => (
                    <PaperCard key={entry.id} paper={entry} index={index} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="chains">
              <CitationChainsTab id={paper.id} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-5">
          <div className="surface-gradient space-y-4 rounded-lg border border-border p-5">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">DOI</p>
              <p className="mt-1 break-all font-mono text-xs">{paper.doi}</p>
            </div>

            {paper.topics.length > 0 ? (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Topics
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {paper.topics.map((topic) => (
                    <Link key={topic.id} to={`/topics/${topic.id}`}>
                      <Badge variant="outline" className="hover:border-graph-topic/50">
                        {topic.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {paper.keywords.length > 0 ? (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Keywords
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {paper.keywords.map((keyword) => (
                    <Badge key={keyword.id} variant="default">
                      {keyword.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {paper.datasets.length > 0 ? (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Datasets
                </p>
                <ul className="mt-2 space-y-1.5">
                  {paper.datasets.map((dataset) => (
                    <li key={dataset.id} className="text-xs">
                      <span className="font-medium">{dataset.name}</span>
                      <span className="block text-2xs text-muted-foreground">
                        {dataset.domain} · {dataset.license}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {paper.project ? (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  Project
                </p>
                <p className="mt-1 text-xs font-medium">{paper.project.title}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  {paper.project.startYear}–{paper.project.endYear} · {paper.project.status}
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SimilarTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useSimilarPapers(id, { limit: 10 });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={Sparkles} title="No similar papers found" />;
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Ranked by shared topics and keywords, co-citation, and bibliographic coupling — each
        contribution is shown so the score is auditable.
      </p>
      <div className="space-y-3">
        {data.items.map((paper, index) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            index={index}
            footer={<ScoreBreakdown score={paper.score} reasons={paper.reasons} />}
          />
        ))}
      </div>
    </>
  );
}

function CitationChainsTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useCitationChains(id, {
    direction: 'forward',
    depth: 3,
    limit: 8,
  });

  if (isLoading) return <ListSkeleton rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Quote}
        title="No multi-hop citation chains"
        description="This paper's references do not extend far enough to form a chain."
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Intellectual ancestry: each chain follows <span className="font-mono">CITES</span> outward
        for up to three hops.
      </p>
      <div className="space-y-3">
        {data.items.map((chain, index) => (
          <div key={index} className="surface-gradient rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="primary">{chain.depth} hops</Badge>
              <span className="text-2xs text-muted-foreground">
                {formatCompact(chain.impact)} citations along the chain
              </span>
            </div>
            <ol className="space-y-1.5">
              {chain.papers.map((paper, position) => (
                <li key={paper.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-surface-muted text-2xs tabular-nums text-muted-foreground">
                    {position + 1}
                  </span>
                  <Link to={`/papers/${paper.id}`} className="min-w-0 hover:text-primary">
                    <span className="line-clamp-1">{paper.title}</span>
                    <span className="text-2xs text-muted-foreground">
                      {paper.year} · {formatCompact(paper.citationCount)} citations
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
