import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Banknote,
  Building2,
  FileText,
  Lightbulb,
  Network,
  Quote,
  Route,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { CardGridSkeleton, ListSkeleton } from '@/components/common/loading';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { AuthorCard } from '@/components/entities/author-card';
import { PaperCard } from '@/components/entities/paper-card';
import { TopicCard } from '@/components/entities/topic-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useAnalyticsSummary,
  useDashboardTotals,
  useGraphOverview,
  usePapers,
  useTrendingTopics,
} from '@/hooks/use-api';
import { formatCompact, formatCurrency, formatNumber } from '@/lib/utils';

/**
 * Landing page.
 *
 * The layout deliberately leads with graph-native results - trending topics
 * derived from a windowed traversal, the relationship census - rather than a
 * plain record count, because that is the story the project is telling.
 */
export function DashboardPage() {
  const totals = useDashboardTotals();
  const overview = useGraphOverview();
  const trending = useTrendingTopics({ limit: 6, windowYears: 3, minRecentPapers: 3 });
  const analytics = useAnalyticsSummary({ limit: 5 });

  if (totals.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <ErrorState error={totals.error} onRetry={() => void totals.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="relative">
        <div className="grid-backdrop pointer-events-none absolute inset-x-0 -top-6 h-48" aria-hidden />
        <PageHeader
          eyebrow={
            <Badge variant="primary">
              <Network className="size-2.5" aria-hidden />
              Graph-native discovery
            </Badge>
          }
          title="The research ecosystem, as a graph"
          description="Research Nexus models authors, papers, topics, institutions, venues and funding as one connected property graph. Every panel below is a live Cypher traversal against CognoDB — no precomputed reporting tables."
          actions={
            <>
              <Button asChild>
                <Link to="/graph">
                  <Network className="size-4" />
                  Open graph explorer
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/paths">
                  <Route className="size-4" />
                  Find a path
                </Link>
              </Button>
            </>
          }
        />
      </div>

      {totals.isLoading ? (
        <CardGridSkeleton cards={4} />
      ) : totals.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Researchers"
            value={formatNumber(totals.data.authorCount)}
            hint={`across ${formatNumber(totals.data.universityCount)} institutions`}
            icon={Users}
            accent="text-graph-author"
          />
          <StatCard
            index={1}
            label="Papers"
            value={formatNumber(totals.data.paperCount)}
            hint={`${formatCompact(totals.data.citationCount)} citations recorded`}
            icon={FileText}
            accent="text-graph-paper"
          />
          <StatCard
            index={2}
            label="Research topics"
            value={formatNumber(totals.data.topicCount)}
            hint="linked by explicit and inferred relationships"
            icon={Lightbulb}
            accent="text-graph-topic"
          />
          <StatCard
            index={3}
            label="Funded projects"
            value={formatNumber(totals.data.projectCount)}
            hint={`${formatCurrency(totals.data.fundedUsd)} committed`}
            icon={Banknote}
            accent="text-graph-funding"
          />
        </div>
      ) : null}

      {overview.data ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="surface-gradient overflow-hidden rounded-lg border border-border"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Why a graph, in one number</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNumber(overview.data.totals.nodeCount)} entities carry{' '}
                {formatNumber(overview.data.totals.relationshipCount)} relationships — an average of{' '}
                <span className="font-medium text-foreground">
                  {overview.data.totals.density.toFixed(1)} connections per entity
                </span>
                . In a relational schema each of those types is a join table.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/analytics">
                Full analytics
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {overview.data.relationships.slice(0, 8).map((relationship) => (
              <div key={relationship.type} className="bg-surface p-4">
                <p className="truncate font-mono text-2xs text-muted-foreground">
                  {relationship.type}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCompact(relationship.count)}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      ) : null}

      <Section
        title="Trending research topics"
        description="Output in the last three years compared against the three before it — computed at query time from the citation and authorship graph."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/topics">
              All topics
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        {trending.isLoading ? (
          <CardGridSkeleton cards={3} className="lg:grid-cols-3" />
        ) : trending.isError ? (
          <ErrorState error={trending.error} onRetry={() => void trending.refetch()} />
        ) : trending.data && trending.data.items.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.data.items.map((topic, index) => (
              <TopicCard key={topic.id} topic={topic} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No trending topics yet"
            description="Seed the database with `npm run db:seed` to populate the graph."
          />
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section
          title="Most cited researchers"
          description="Ranked by citations accumulated across every paper they authored."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/authors">
                All authors
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {analytics.isLoading ? (
            <ListSkeleton rows={5} />
          ) : analytics.data ? (
            <div className="space-y-2">
              {analytics.data.topAuthors.map((author, index) => (
                <AuthorCard key={author.id} author={author} index={index} />
              ))}
            </div>
          ) : null}
        </Section>

        <Section
          title="Highest impact papers"
          description="The most cited work in the graph, with venue and topic context attached."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/papers">
                All papers
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <TopPapers />
        </Section>
      </div>

      <Section
        title="Start exploring"
        description="Each of these answers a question that is awkward to express in SQL and natural as a traversal."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((shortcut, index) => (
            <motion.div
              key={shortcut.to}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
            >
              <Link
                to={shortcut.to}
                className="surface-gradient group flex h-full flex-col gap-2 rounded-lg border border-border p-5 transition-all hover:border-primary/40 hover:shadow-raised"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                  <shortcut.icon className="size-4" aria-hidden />
                </span>
                <p className="mt-1 text-sm font-medium transition-colors group-hover:text-primary">
                  {shortcut.title}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {shortcut.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** Fetches its own slice so the two dashboard columns load independently. */
function TopPapers() {
  const { data, isLoading, isError, error, refetch } = usePapers({ limit: 5, sort: 'citations' });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-2">
      {(data?.items ?? []).map((paper, index) => (
        <PaperCard key={paper.id} paper={paper} index={index} />
      ))}
    </div>
  );
}

const SHORTCUTS = [
  {
    to: '/paths',
    icon: Route,
    title: 'Shortest collaboration path',
    description:
      'Find how two researchers are connected through co-authorship, and see every equally short route between them.',
  },
  {
    to: '/collaboration',
    icon: Users,
    title: 'Hidden collaborators',
    description:
      'Surface people two hops away who work on your topics but have never co-authored with you.',
  },
  {
    to: '/recommendations',
    icon: Sparkles,
    title: 'Paper recommendations',
    description:
      'Blend shared topics, keywords, co-citation and bibliographic coupling into one explainable ranking.',
  },
  {
    to: '/citations',
    icon: Quote,
    title: 'Citation chains',
    description:
      'Walk a paper’s intellectual ancestry or its downstream influence across multiple hops.',
  },
  {
    to: '/universities',
    icon: Building2,
    title: 'Institutional similarity',
    description:
      'Compare institutions by the overlap of the topics their researchers actually publish on.',
  },
  {
    to: '/funding',
    icon: Banknote,
    title: 'Funding landscape',
    description:
      'See which agencies back which topics, and which funders support overlapping research areas.',
  },
] as const;
