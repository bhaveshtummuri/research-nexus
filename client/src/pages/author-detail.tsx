import { Building2, FileText, GitBranch, Mail, Quote, Route, Sparkles, Users } from 'lucide-react';
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
import { AuthorCard } from '@/components/entities/author-card';
import { PaperCard } from '@/components/entities/paper-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAuthor,
  useAuthorCollaborators,
  useAuthorRecommendations,
  useAuthorPapers,
  useHiddenCollaborators,
} from '@/hooks/use-api';
import { formatCompact, formatNumber } from '@/lib/utils';

export function AuthorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: author, isLoading, isError, error, refetch } = useAuthor(id);
  useBreadcrumbLabel(author?.name);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!author) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <>
            <EntityBadge label="Author" />
            <Badge variant="outline">{author.title}</Badge>
            {author.primaryField ? <Badge variant="outline">{author.primaryField}</Badge> : null}
          </>
        }
        title={author.name}
        description={author.researchStatement}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to={`/graph?focus=${author.id}`}>
                <GitBranch className="size-4" />
                View in graph
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/paths?from=${author.id}`}>
                <Route className="size-4" />
                Find a path
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        {author.affiliation ? (
          <Link
            to={`/universities/${author.affiliation.id}`}
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Building2 className="size-3.5" aria-hidden />
            {author.affiliation.name}, {author.affiliation.country}
          </Link>
        ) : null}
        <span className="flex items-center gap-1.5">
          <Mail className="size-3.5" aria-hidden />
          {author.email}
        </span>
        <span className="font-mono">ORCID {author.orcid}</span>
        <span>Active since {author.careerStartYear}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard index={0} label="h-index" value={formatNumber(author.hIndex)} icon={Quote} />
        <StatCard
          index={1}
          label="Citations"
          value={formatCompact(author.citationCount)}
          icon={Quote}
        />
        <StatCard index={2} label="Papers" value={formatNumber(author.paperCount)} icon={FileText} />
        <StatCard
          index={3}
          label="Collaborators"
          value={formatNumber(author.frequentCollaborators.length)}
          hint="strongest co-authorship links"
          icon={Users}
        />
      </div>

      {author.topics.length > 0 ? (
        <Section
          title="Research focus"
          description="Topics derived by walking this author's papers, weighted by how many of them address each subject."
        >
          <div className="flex flex-wrap gap-2">
            {author.topics.map((topic) => (
              <Link key={topic.id} to={`/topics/${topic.id}`}>
                <Badge variant="outline" className="gap-1.5 px-2.5 py-1 hover:border-graph-topic/50">
                  <span className="size-1.5 rounded-full bg-graph-topic" aria-hidden />
                  {topic.name}
                  <span className="tabular-nums opacity-60">{topic.paperCount}</span>
                </Badge>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Tabs defaultValue="papers">
        <TabsList>
          <TabsTrigger value="papers">Publications</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="hidden">Hidden collaborators</TabsTrigger>
          <TabsTrigger value="recommended">Recommended reading</TabsTrigger>
        </TabsList>

        <TabsContent value="papers">
          <PublicationsTab id={author.id} />
        </TabsContent>
        <TabsContent value="collaborators">
          <CollaboratorsTab id={author.id} />
        </TabsContent>
        <TabsContent value="hidden">
          <HiddenCollaboratorsTab id={author.id} />
        </TabsContent>
        <TabsContent value="recommended">
          <RecommendationsTab id={author.id} />
        </TabsContent>
      </Tabs>

      {author.projects.length > 0 ? (
        <Section title="Research projects" description="Funded programmes this author contributes to.">
          <div className="grid gap-3 lg:grid-cols-2">
            {author.projects.map((project) => (
              <div
                key={project.id}
                className="surface-gradient rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-snug">{project.title}</p>
                  <Badge variant={project.status === 'Active' ? 'success' : 'outline'}>
                    {project.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {project.summary}
                </p>
                <p className="mt-2 text-2xs text-muted-foreground">
                  {project.startYear}–{project.endYear}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function PublicationsTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useAuthorPapers(id, { limit: 20 });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={FileText} title="No publications recorded" />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {data.items.map((paper, index) => (
        <PaperCard key={paper.id} paper={paper} index={index} />
      ))}
    </div>
  );
}

function CollaboratorsTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useAuthorCollaborators(id, {
    depth: 2,
    limit: 24,
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={Users} title="No collaborators within two hops" />;
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Researchers reachable within two <span className="font-mono">COLLABORATED_WITH</span> hops,
        nearest first.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((collaborator, index) => (
          <AuthorCard
            key={collaborator.id}
            author={collaborator}
            index={index}
            footer={
              <p className="text-2xs text-muted-foreground">
                {collaborator.distance === 1 ? 'Direct co-author' : `${collaborator.distance} hops away`}
              </p>
            }
          />
        ))}
      </div>
    </>
  );
}

function HiddenCollaboratorsTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useHiddenCollaborators(id, {
    minSharedTopics: 1,
    limit: 12,
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No hidden collaborators found"
        description="Everyone who shares this author's topics is already a direct co-author."
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Researchers exactly two hops away who publish on the same topics but have never co-authored
        with this author — the introduction worth making.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((candidate, index) => (
          <AuthorCard
            key={candidate.id}
            author={candidate}
            index={index}
            footer={<ScoreBreakdown score={candidate.score} reasons={candidate.reasons} />}
          />
        ))}
      </div>
    </>
  );
}

function RecommendationsTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useAuthorRecommendations(id, { limit: 12 });

  if (isLoading) return <ListSkeleton rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return <EmptyState icon={Sparkles} title="No recommendations available yet" />;
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Papers this author has not written, ranked by topic overlap, work by their collaborators, and
        shared references.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
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
