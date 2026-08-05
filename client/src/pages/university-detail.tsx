import { ExternalLink, FileText, Globe, Quote, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { DetailSkeleton, ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { AuthorCard } from '@/components/entities/author-card';
import { UniversityCard } from '@/components/entities/university-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSimilarUniversities, useUniversity } from '@/hooks/use-api';
import { formatCompact, formatNumber, formatPercent } from '@/lib/utils';

export function UniversityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: university, isLoading, isError, error, refetch } = useUniversity(id);
  useBreadcrumbLabel(university?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!university) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="University" />
            <Badge variant="outline">{university.type}</Badge>
            <Badge variant="primary">Rank #{university.ranking}</Badge>
          </>
        }
        title={university.name}
        description={`Founded ${university.foundedYear} in ${university.city}, ${university.country}.`}
        actions={
          <Button asChild variant="outline">
            <a href={university.website} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Website
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Researchers" value={formatNumber(university.researcherCount)} icon={Users} />
        <StatCard index={1} label="Papers" value={formatNumber(university.paperCount)} icon={FileText} />
        <StatCard index={2} label="Citations" value={formatCompact(university.totalCitations)} icon={Quote} />
        <StatCard index={3} label="Partners" value={formatNumber(university.partners.length)} icon={Globe} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section
            title="Leading researchers"
            description="Affiliated authors ranked by h-index."
          >
            {university.topAuthors.length === 0 ? (
              <EmptyState icon={Users} title="No affiliated researchers" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {university.topAuthors.map((author, index) => (
                  <AuthorCard key={author.id} author={author} index={index} />
                ))}
              </div>
            )}
          </Section>

          <SimilarUniversities id={university.id} />
        </div>

        <aside className="space-y-8">
          <Section
            title="Research strengths"
            description="Topics the institution's researchers publish on most."
          >
            <div className="space-y-2">
              {university.topTopics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/topics/${topic.id}`}
                  className="surface-gradient flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-graph-topic/45"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{topic.name}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{topic.field}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {topic.paperCount}
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          {university.partners.length > 0 ? (
            <Section title="Institutional partners">
              <div className="space-y-2">
                {university.partners.map((partner) => (
                  <Link
                    key={partner.id}
                    to={`/universities/${partner.id}`}
                    className="surface-gradient block rounded-lg border border-border p-3 transition-colors hover:border-graph-university/45"
                  >
                    <span className="block truncate text-xs font-medium">{partner.name}</span>
                    <span className="block truncate text-2xs text-muted-foreground">
                      {partner.focus} · since {partner.since}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SimilarUniversities({ id }: { id: string }) {
  const { data, isLoading } = useSimilarUniversities(id, { limit: 6, minSharedTopics: 2 });

  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data || data.items.length === 0) return null;

  return (
    <Section
      title="Institutions working on similar research"
      description="Similarity is the Jaccard overlap of the topic profiles built from each institution's publications — a four-hop traversal, not a stored score."
    >
      <div className="space-y-2">
        {data.items.map((entry, index) => (
          <div key={entry.university.id} className="space-y-2">
            <UniversityCard university={entry.university} index={index} />
            <div className="flex flex-wrap items-center gap-1.5 pl-4">
              <Badge variant="primary">{formatPercent(entry.similarity, 1)} overlap</Badge>
              {entry.sharedTopics.slice(0, 4).map((topic) => (
                <Badge key={topic.id} variant="outline">
                  {topic.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
