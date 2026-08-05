import { BookOpen, ExternalLink, FileText, MapPin, Quote, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { DetailSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumb-context';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { AuthorCard } from '@/components/entities/author-card';
import { PaperCard } from '@/components/entities/paper-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConference, useJournal } from '@/hooks/use-api';
import { chartTheme } from '@/lib/chart-theme';
import { formatNumber } from '@/lib/utils';

export function ConferenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: conference, isLoading, isError, error, refetch } = useConference(id);
  useBreadcrumbLabel(conference?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!conference) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="Conference" />
            <Badge variant="primary">{conference.acronym}</Badge>
            <Badge variant="outline">Tier {conference.tier}</Badge>
          </>
        }
        title={conference.name}
        description={`${conference.field} · founded ${conference.foundedYear}`}
        actions={
          <Button asChild variant="outline">
            <a href={conference.website} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Website
            </a>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden />
          {conference.location}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard index={0} label="Papers presented" value={formatNumber(conference.paperCount)} icon={FileText} />
        <StatCard index={1} label="Topics covered" value={formatNumber(conference.topics.length)} />
        <StatCard index={2} label="Frequent authors" value={formatNumber(conference.topAuthors.length)} icon={Users} />
      </div>

      {conference.yearlyOutput.length > 1 ? (
        <Section title="Papers per year">
          <div className="surface-gradient rounded-lg border border-border p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={conference.yearlyOutput} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="year" {...chartTheme.axis} />
                <YAxis allowDecimals={false} {...chartTheme.axis} />
                <Tooltip {...chartTheme.tooltip} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                <Bar dataKey="count" name="Papers" fill="hsl(var(--graph-conference))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Most cited papers">
            {conference.topPapers.length === 0 ? (
              <EmptyState icon={FileText} title="No papers recorded" />
            ) : (
              <div className="space-y-2">
                {conference.topPapers.map((paper, index) => (
                  <PaperCard key={paper.id} paper={paper} index={index} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-8">
          <Section title="Regular contributors">
            <div className="space-y-2">
              {conference.topAuthors.map((author, index) => (
                <AuthorCard key={author.id} author={author} index={index} />
              ))}
            </div>
          </Section>

          {conference.topics.length > 0 ? (
            <Section title="Topics">
              <div className="flex flex-wrap gap-1.5">
                {conference.topics.map((topic) => (
                  <Badge key={topic.id} variant="outline">
                    {topic.name}
                  </Badge>
                ))}
              </div>
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: journal, isLoading, isError, error, refetch } = useJournal(id);
  useBreadcrumbLabel(journal?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!journal) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="Journal" />
            <Badge variant="primary">IF {journal.impactFactor.toFixed(1)}</Badge>
            <Badge variant="outline">{journal.field}</Badge>
          </>
        }
        title={journal.name}
        description={`Published by ${journal.publisher} · ISSN ${journal.issn}`}
        actions={
          <Button asChild variant="outline">
            <a href={journal.website} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Website
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard index={0} label="Impact factor" value={journal.impactFactor.toFixed(1)} icon={Quote} />
        <StatCard index={1} label="Papers" value={formatNumber(journal.paperCount)} icon={BookOpen} />
        <StatCard index={2} label="Topics" value={formatNumber(journal.topics.length)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Section title="Most cited papers">
            {journal.topPapers.length === 0 ? (
              <EmptyState icon={FileText} title="No papers recorded" />
            ) : (
              <div className="space-y-2">
                {journal.topPapers.map((paper, index) => (
                  <PaperCard key={paper.id} paper={paper} index={index} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-8">
          <Section title="Frequent authors">
            <div className="space-y-2">
              {journal.topAuthors.map((author, index) => (
                <AuthorCard key={author.id} author={author} index={index} />
              ))}
            </div>
          </Section>

          {journal.topics.length > 0 ? (
            <Section title="Topics">
              <div className="flex flex-wrap gap-1.5">
                {journal.topics.map((topic) => (
                  <Badge key={topic.id} variant="outline">
                    {topic.name}
                  </Badge>
                ))}
              </div>
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
