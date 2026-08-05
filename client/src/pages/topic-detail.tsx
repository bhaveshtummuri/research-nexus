import { Building2, FileText, GitBranch, Lightbulb, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { DetailSkeleton, ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { AuthorCard } from '@/components/entities/author-card';
import { PaperCard } from '@/components/entities/paper-card';
import { UniversityCard } from '@/components/entities/university-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSimilarTopics, useTopic } from '@/hooks/use-api';
import { chartTheme } from '@/lib/chart-theme';
import { formatNumber, formatPercent } from '@/lib/utils';

/**
 * Topics reached through the shared keyword vocabulary.
 *
 * Deliberately separate from "Related topics" above: that list needs two topics
 * to appear on the same paper, while this traversal
 * (Topic→Paper→Keyword→Paper→Topic) surfaces communities working the same
 * problem without sharing a single publication. The distinction is the point,
 * so the copy states it rather than blending the two lists together.
 */
function SimilarTopics({ id }: { id: string }) {
  const { data, isLoading, isError } = useSimilarTopics(id, { limit: 6, minSharedKeywords: 2 });

  if (isLoading) {
    return (
      <Section title="Similar by vocabulary">
        <ListSkeleton rows={3} />
      </Section>
    );
  }

  // A missing sidebar panel should never take the page down with it.
  if (isError || !data || data.items.length === 0) return null;

  return (
    <Section
      title="Similar by vocabulary"
      description="Topics drawing on the same keywords, even where they share no publication."
    >
      <div className="space-y-2">
        {data.items.map((similar) => (
          <Link
            key={similar.id}
            to={`/topics/${similar.id}`}
            className="surface-gradient block rounded-lg border border-border p-3 transition-colors hover:border-graph-topic/45"
          >
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{similar.name}</span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {similar.field}
                </span>
              </span>
              <Badge variant="primary" className="tabular-nums">
                {formatPercent(similar.similarity)}
              </Badge>
            </div>

            {similar.sharedKeywords.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {similar.sharedKeywords.slice(0, 4).map((keyword) => (
                  <Badge key={keyword.id} variant="outline" className="text-[10px]">
                    {keyword.term}
                  </Badge>
                ))}
                {similar.sharedKeywordCount > 4 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{similar.sharedKeywordCount - 4} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: topic, isLoading, isError, error, refetch } = useTopic(id);
  useBreadcrumbLabel(topic?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!topic) return null;

  const directLinks = topic.relatedTopics.filter((entry) => entry.connectionKind === 'direct');
  const inferredLinks = topic.relatedTopics.filter((entry) => entry.connectionKind === 'inferred');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="ResearchTopic" />
            <Badge variant="outline">{topic.field}</Badge>
            <Badge variant="outline">since {topic.emergenceYear}</Badge>
          </>
        }
        title={topic.name}
        description={topic.description}
        actions={
          <Button asChild variant="secondary">
            <Link to={`/graph?focus=${topic.id}`}>
              <GitBranch className="size-4" />
              View in graph
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Papers" value={formatNumber(topic.paperCount)} icon={FileText} />
        <StatCard index={1} label="Experts ranked" value={formatNumber(topic.topExperts.length)} icon={Users} />
        <StatCard
          index={2}
          label="Related topics"
          value={formatNumber(topic.relatedTopics.length)}
          hint={`${directLinks.length} direct · ${inferredLinks.length} inferred`}
          icon={Lightbulb}
        />
        <StatCard
          index={3}
          label="Institutions"
          value={formatNumber(topic.universities.length)}
          icon={Building2}
        />
      </div>

      {topic.yearlyOutput.length > 1 ? (
        <Section title="Publication trend" description="Papers tagged with this topic, by year.">
          <div className="surface-gradient rounded-lg border border-border p-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={topic.yearlyOutput} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="topicTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--graph-topic))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--graph-topic))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="year" {...chartTheme.axis} />
                <YAxis allowDecimals={false} {...chartTheme.axis} />
                <Tooltip {...chartTheme.tooltip} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Papers"
                  stroke="hsl(var(--graph-topic))"
                  strokeWidth={2}
                  fill="url(#topicTrend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section
            title="Leading experts"
            description="Scored on output, citation impact and how much of their work is devoted to this topic."
          >
            {topic.topExperts.length === 0 ? (
              <EmptyState icon={Users} title="No experts identified yet" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {topic.topExperts.map((expert, index) => (
                  <AuthorCard
                    key={expert.id}
                    author={expert}
                    index={index}
                    footer={
                      <div className="flex items-center justify-between text-2xs text-muted-foreground">
                        <span>{expert.topicPaperCount} papers on this topic</span>
                        <span>{formatPercent(expert.focusRatio)} of their output</span>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Most cited papers">
            {topic.topPapers.length === 0 ? (
              <EmptyState icon={FileText} title="No papers on this topic" />
            ) : (
              <div className="space-y-2">
                {topic.topPapers.map((paper, index) => (
                  <PaperCard key={paper.id} paper={paper} index={index} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-8">
          <Section
            title="Related topics"
            description="Curated links plus topics inferred from co-occurrence on the same papers."
          >
            <div className="space-y-2">
              {topic.relatedTopics.map((related) => (
                <Link
                  key={related.id}
                  to={`/topics/${related.id}`}
                  className="surface-gradient flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-graph-topic/45"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{related.name}</span>
                    <span className="block truncate text-2xs text-muted-foreground">
                      {related.field}
                    </span>
                  </span>
                  <Badge variant={related.connectionKind === 'direct' ? 'primary' : 'outline'}>
                    {related.connectionKind}
                  </Badge>
                </Link>
              ))}
            </div>
          </Section>

          <SimilarTopics id={topic.id} />

          <Section title="Active institutions">
            <div className="space-y-2">
              {topic.universities.slice(0, 6).map((university, index) => (
                <UniversityCard key={university.id} university={university} index={index} />
              ))}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
