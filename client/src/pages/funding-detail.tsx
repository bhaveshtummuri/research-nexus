import { Banknote, ExternalLink, Landmark, Layers } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { DetailSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFundingAgency } from '@/hooks/use-api';
import { formatCurrency, formatNumber } from '@/lib/utils';

export function FundingAgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agency, isLoading, isError, error, refetch } = useFundingAgency(id);
  useBreadcrumbLabel(agency?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!agency) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="FundingAgency" />
            <Badge variant="outline">{agency.type}</Badge>
            <Badge variant="outline">{agency.country}</Badge>
          </>
        }
        title={agency.name}
        description={`Annual research budget of ${formatCurrency(agency.annualBudgetUsd)}.`}
        actions={
          <Button asChild variant="outline">
            <a href={agency.website} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Website
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="Projects funded" value={formatNumber(agency.projectCount)} icon={Layers} />
        <StatCard index={1} label="Total awarded" value={formatCurrency(agency.totalAwardedUsd)} icon={Banknote} />
        <StatCard index={2} label="Annual budget" value={formatCurrency(agency.annualBudgetUsd)} icon={Landmark} />
        <StatCard index={3} label="Topics reached" value={formatNumber(agency.topTopics.length)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section
            title="Funded projects"
            description="Grants ordered by award size, with the grant number recorded on the FUNDS relationship."
          >
            {agency.projects.length === 0 ? (
              <EmptyState icon={Layers} title="No funded projects recorded" />
            ) : (
              <div className="space-y-2">
                {agency.projects.map((project) => (
                  <div key={project.id} className="surface-gradient rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-pretty text-sm font-medium leading-snug">{project.title}</p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(project.awardedUsd)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {project.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-2xs text-muted-foreground">
                      <Badge variant={project.status === 'Active' ? 'success' : 'outline'}>
                        {project.status}
                      </Badge>
                      <span>
                        {project.startYear}–{project.endYear}
                      </span>
                      <span className="ml-auto font-mono">{project.grantNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-8">
          <Section
            title="Research areas supported"
            description="Topics reached through the projects this agency funds."
          >
            <div className="space-y-2">
              {agency.topTopics.map((topic) => (
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

          {agency.partnerAgencies.length > 0 ? (
            <Section
              title="Funders with overlapping portfolios"
              description="Agencies backing the same research topics — discovered by traversing project topics, not by any stored relationship between the funders."
            >
              <div className="space-y-2">
                {agency.partnerAgencies.map((partner) => (
                  <Link
                    key={partner.id}
                    to={`/funding/${partner.id}`}
                    className="surface-gradient flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-graph-funding/45"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{partner.name}</span>
                      <span className="block truncate text-2xs text-muted-foreground">
                        {partner.country}
                      </span>
                    </span>
                    <Badge variant="primary">{partner.sharedTopicCount} shared</Badge>
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
