import {
  Banknote,
  Building2,
  ChartNoAxesCombined,
  Globe,
  Network,
  Quote,
  Tags,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ErrorState } from '@/components/common/error-state';
import { CardGridSkeleton, ChartSkeleton, ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Section } from '@/components/common/section';
import { StatCard } from '@/components/common/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@/components/ui/table';
import {
  useAnalyticsSummary,
  useCollaborativeInstitutions,
  useConnectedKeywords,
  useFundedResearchAreas,
  useMostCitedPapers,
} from '@/hooks/use-api';
import { CHART_SERIES_COLORS, chartTheme } from '@/lib/chart-theme';
import { formatCompact, formatCurrency, formatNumber, formatPercent, LABEL_STYLES } from '@/lib/utils';
import type { NodeLabel } from '@/types/api';

/**
 * Analytics dashboard.
 *
 * Every figure is computed at request time from the live graph — there is no
 * warehouse, no materialised view and no nightly job behind any of these
 * numbers.
 */
export function AnalyticsPage() {
  const { data, isLoading, isError, error, refetch } = useAnalyticsSummary({ limit: 8 });

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader title="Analytics" />
        <CardGridSkeleton />
        <ChartSkeleton />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const { overview, collaborationStats } = data;

  const labelData = overview.nodes.map((entry) => ({
    name: LABEL_STYLES[entry.label as NodeLabel]?.name ?? entry.label,
    value: entry.count,
    color: LABEL_STYLES[entry.label as NodeLabel]?.color ?? CHART_SERIES_COLORS[0],
  }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <ChartNoAxesCombined className="size-2.5" aria-hidden />
            Computed live
          </Badge>
        }
        title="Research analytics"
        description="A census of the graph and the collaboration patterns inside it. Each panel is one Cypher aggregation, executed on request."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Nodes"
          value={formatNumber(overview.totals.nodeCount)}
          hint={`${overview.nodes.length} distinct labels`}
          icon={Network}
        />
        <StatCard
          index={1}
          label="Relationships"
          value={formatNumber(overview.totals.relationshipCount)}
          hint={`${overview.relationships.length} distinct types`}
          icon={Network}
        />
        <StatCard
          index={2}
          label="Graph density"
          value={`${overview.totals.density.toFixed(1)}×`}
          hint="relationships per node"
          icon={ChartNoAxesCombined}
        />
        <StatCard
          index={3}
          label="International papers"
          value={formatPercent(collaborationStats.internationalShare, 1)}
          hint="authors span more than one country"
          icon={Globe}
        />
      </div>

      <Section
        title="Publication output over time"
        description="Papers per year across the whole graph."
      >
        <div className="surface-gradient rounded-lg border border-border p-5">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.publicationsByYear} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="year" {...chartTheme.axis} />
              <YAxis allowDecimals={false} {...chartTheme.axis} />
              <Tooltip {...chartTheme.tooltip} />
              <Line
                type="monotone"
                dataKey="count"
                name="Papers"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Relationship census" description="How the graph's edges are distributed.">
          <div className="surface-gradient rounded-lg border border-border p-5">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={overview.relationships}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 40 }}
              >
                <CartesianGrid {...chartTheme.grid} horizontal={false} vertical />
                <XAxis type="number" {...chartTheme.axis} />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={116}
                  {...chartTheme.axis}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />
                <Tooltip {...chartTheme.tooltip} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                <Bar dataKey="count" name="Relationships" radius={[0, 4, 4, 0]}>
                  {overview.relationships.map((entry, index) => (
                    <Cell
                      key={entry.type}
                      fill={CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Node composition" description="Entities by label.">
          <div className="surface-gradient rounded-lg border border-border p-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={labelData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={104}
                  paddingAngle={2}
                  stroke="hsl(var(--surface))"
                  strokeWidth={2}
                >
                  {labelData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...chartTheme.tooltip} />
                <Legend
                  verticalAlign="bottom"
                  height={44}
                  formatter={(value) => (
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section
        title="Collaboration health"
        description="Metrics that require grouping a paper's authors by their affiliations before the comparison can even be expressed — trivial as a traversal, awkward as SQL."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Authors per paper"
            value={collaborationStats.averageAuthorsPerPaper.toFixed(1)}
            hint="mean team size"
            icon={Users}
          />
          <StatCard
            index={1}
            label="Collaborators per author"
            value={collaborationStats.averageCollaboratorsPerAuthor.toFixed(1)}
            hint="distinct co-authors"
            icon={Users}
          />
          <StatCard
            index={2}
            label="Cross-institution"
            value={formatPercent(collaborationStats.crossInstitutionShare, 1)}
            hint="papers spanning multiple institutions"
            icon={Network}
          />
          <StatCard
            index={3}
            label="International"
            value={formatPercent(collaborationStats.internationalShare, 1)}
            hint="papers spanning multiple countries"
            icon={Globe}
          />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Leading institutions" description="By citations accumulated across their researchers' output.">
          <Table
            caption="Leading institutions by citations"
            containerClassName="surface-gradient"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead numeric>Papers</TableHead>
                <TableHead numeric>Citations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topUniversities.map((university) => (
                <TableRow key={university.id}>
                  <TableRowHeader>
                    <span className="block truncate font-medium">{university.name}</span>
                    <span className="block text-2xs text-muted-foreground">
                      {university.country}
                    </span>
                  </TableRowHeader>
                  <TableCell numeric>{formatNumber(university.paperCount)}</TableCell>
                  <TableCell numeric>{formatCompact(university.citationCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Highest impact venues" description="Conferences and journals by total citations.">
          <Table caption="Highest impact venues by citations" containerClassName="surface-gradient">
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead numeric>Papers</TableHead>
                <TableHead numeric>Citations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topVenues.map((venue) => (
                <TableRow key={`${venue.kind}-${venue.id}`}>
                  <TableRowHeader>
                    <span className="block truncate font-medium">{venue.name}</span>
                    <span className="block text-2xs capitalize text-muted-foreground">
                      {venue.kind}
                    </span>
                  </TableRowHeader>
                  <TableCell numeric>{formatNumber(venue.paperCount)}</TableCell>
                  <TableCell numeric>{formatCompact(venue.citationCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>

      <GraphNativeRankings />
    </div>
  );
}

/**
 * The four rankings that only a traversal can produce.
 *
 * Each is issued as its own query rather than folded into `/analytics/summary`,
 * so a slow ranking never delays the charts above it and a failing one degrades
 * to a single empty panel instead of blanking the page.
 */
function GraphNativeRankings() {
  return (
    <Section
      title="Graph-native rankings"
      description="Each of these measures a property of the network itself — computed at request time, with no materialised view behind any of the numbers."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <MostCitedPanel />
        <ConnectedKeywordsPanel />
        <FundedAreasPanel />
        <CollaborativeInstitutionsPanel />
      </div>
    </Section>
  );
}

function RankingPanel({
  title,
  hint,
  icon: Icon,
  isLoading,
  isEmpty,
  children,
}: {
  title: string;
  hint: string;
  icon: typeof Users;
  isLoading: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-gradient rounded-lg border border-border p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isEmpty ? (
        <p className="py-6 text-center text-2xs text-muted-foreground">
          No data available for this ranking.
        </p>
      ) : (
        <ol className="space-y-1.5">{children}</ol>
      )}
    </div>
  );
}

function RankRow({
  rank,
  to,
  title,
  subtitle,
  metric,
  metricHint,
}: {
  rank: number;
  to?: string;
  title: string;
  subtitle: string;
  metric: string;
  metricHint: string;
}) {
  const body = (
    <>
      <span className="w-4 shrink-0 text-2xs tabular-nums text-muted-foreground">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{title}</span>
        <span className="block truncate text-2xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xs font-medium tabular-nums">{metric}</span>
        <span className="block text-[10px] text-muted-foreground">{metricHint}</span>
      </span>
    </>
  );

  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-2 py-1.5">{body}</div>
      )}
    </li>
  );
}

function MostCitedPanel() {
  const { data, isLoading } = useMostCitedPapers({ limit: 5 });

  return (
    <RankingPanel
      title="Most cited papers"
      hint="Counted from incoming CITES edges rather than read from a stored column, so a drifting counter stays visible."
      icon={Quote}
      isLoading={isLoading}
      isEmpty={!data || data.items.length === 0}
    >
      {data?.items.map((paper, index) => (
        <RankRow
          key={paper.id}
          rank={index + 1}
          to={`/papers/${paper.id}`}
          title={paper.title}
          subtitle={`${paper.year} · stored count ${formatCompact(paper.citationCount)}`}
          metric={formatCompact(paper.inGraphCitations)}
          metricHint="in graph"
        />
      ))}
    </RankingPanel>
  );
}

function ConnectedKeywordsPanel() {
  const { data, isLoading } = useConnectedKeywords({ limit: 5 });

  return (
    <RankingPanel
      title="Most connected keywords"
      hint="Ranked by how many other keywords they co-occur with — connective reach, not raw usage."
      icon={Tags}
      isLoading={isLoading}
      isEmpty={!data || data.items.length === 0}
    >
      {data?.items.map((keyword, index) => (
        <RankRow
          key={keyword.id}
          rank={index + 1}
          title={keyword.term}
          subtitle={`${formatNumber(keyword.sharedPaperCount)} papers · ${keyword.topTopics[0]?.field ?? 'multiple fields'}`}
          metric={formatNumber(keyword.connectedKeywordCount)}
          metricHint="co-terms"
        />
      ))}
    </RankingPanel>
  );
}

function FundedAreasPanel() {
  const { data, isLoading } = useFundedResearchAreas({ limit: 5 });

  return (
    <RankingPanel
      title="Best funded research areas"
      hint="Money traced three hops: FundingAgency → Project → ResearchTopic, grouped by field."
      icon={Banknote}
      isLoading={isLoading}
      isEmpty={!data || data.items.length === 0}
    >
      {data?.items.map((area, index) => (
        <RankRow
          key={area.field}
          rank={index + 1}
          title={area.field}
          subtitle={`${formatNumber(area.projectCount)} projects · ${formatNumber(area.agencyCount)} funders`}
          metric={formatCurrency(area.totalAwardedUsd)}
          metricHint="awarded"
        />
      ))}
    </RankingPanel>
  );
}

function CollaborativeInstitutionsPanel() {
  const { data, isLoading } = useCollaborativeInstitutions({ limit: 5 });

  return (
    <RankingPanel
      title="Most collaborative institutions"
      hint="Distinct peer institutions reached through co-authorship — openness rather than size."
      icon={Building2}
      isLoading={isLoading}
      isEmpty={!data || data.items.length === 0}
    >
      {data?.items.map((university, index) => (
        <RankRow
          key={university.id}
          rank={index + 1}
          to={`/universities/${university.id}`}
          title={university.name}
          subtitle={`${university.country} · ${formatNumber(university.engagedResearcherCount)} researchers engaged`}
          metric={formatNumber(university.partnerCount)}
          metricHint="partners"
        />
      ))}
    </RankingPanel>
  );
}
