import { GitBranch, Layers, Lightbulb, Network, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { EntityPicker, type PickedEntity } from '@/components/common/entity-picker';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { ScoreBreakdown } from '@/components/common/score-bar';
import { Section } from '@/components/common/section';
import { AuthorCard } from '@/components/entities/author-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAuthorCollaborators,
  useCollaborativeResearchers,
  useCrossDomainCollaborations,
  useHiddenCollaborators,
} from '@/hooks/use-api';
import { formatNumber } from '@/lib/utils';
import type { HiddenCollaborator } from '@/types/api';

/**
 * Collaboration explorer.
 *
 * Combines three questions that all resolve to traversals: who is reachable
 * within N hops, who should you be working with but are not, and which pairs of
 * research fields actually produce joint work.
 */
export function CollaborationPage() {
  const [author, setAuthor] = useState<PickedEntity | null>(null);
  const [depth, setDepth] = useState(2);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <GitBranch className="size-2.5" aria-hidden />
            Multi-hop traversal
          </Badge>
        }
        title="Collaboration explorer"
        description="Walk the co-authorship network outward from any researcher, surface the people they should know but have never worked with, and see which research fields genuinely collaborate."
      />

      <div className="surface-gradient flex flex-col gap-3 rounded-lg border border-border p-5 lg:flex-row lg:items-end">
        <EntityPicker
          label="Researcher"
          value={author}
          onChange={setAuthor}
          labels={['Author']}
          placeholder="Search for a researcher…"
          className="flex-1"
        />
        <div className="space-y-1.5 lg:w-40">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Collaboration hops
          </label>
          <Select
            value={String(depth)}
            onChange={(event) => setDepth(Number(event.target.value))}
            aria-label="Collaboration hops"
          >
            <option value="1">1 hop</option>
            <option value="2">2 hops</option>
            <option value="3">3 hops</option>
            <option value="4">4 hops</option>
          </Select>
        </div>
      </div>

      {author ? (
        <Tabs defaultValue="network">
          <TabsList>
            <TabsTrigger value="network">Collaboration network</TabsTrigger>
            <TabsTrigger value="hidden">Hidden collaborators</TabsTrigger>
          </TabsList>
          <TabsContent value="network">
            <NetworkTab id={author.id} depth={depth} />
          </TabsContent>
          <TabsContent value="hidden">
            <HiddenTab id={author.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <EmptyState
            icon={Users}
            title="Pick a researcher to begin"
            description="Their collaboration network is computed live by walking COLLABORATED_WITH edges outward."
          />
          <MostConnectedSection />
        </>
      )}

      <CrossDomainSection />
    </div>
  );
}

function NetworkTab({ id, depth }: { id: string; depth: number }) {
  const { data, isLoading, isError, error, refetch } = useAuthorCollaborators(id, {
    depth,
    limit: 36,
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No collaborators within that range"
        description="This researcher has no co-authorship edges inside the current hop limit. Widening it reaches collaborators-of-collaborators."
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/graph?focus=${encodeURIComponent(id)}`}>
              <Network className="size-3.5" />
              See them in the graph
            </Link>
          </Button>
        }
      />
    );
  }

  const byDistance = new Map<number, typeof data.items>();
  for (const collaborator of data.items) {
    byDistance.set(collaborator.distance, [
      ...(byDistance.get(collaborator.distance) ?? []),
      collaborator,
    ]);
  }

  return (
    <div className="space-y-6">
      {[...byDistance.entries()]
        .sort(([a], [b]) => a - b)
        .map(([distance, collaborators]) => (
          <Section
            key={distance}
            title={distance === 1 ? 'Direct co-authors' : `${distance} hops away`}
            description={
              distance === 1
                ? 'Researchers who share at least one paper.'
                : `Reachable through ${distance - 1} intermediate ${distance === 2 ? 'person' : 'people'}.`
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {collaborators.map((collaborator, index) => (
                <AuthorCard
                  key={collaborator.id}
                  author={collaborator}
                  index={index}
                  footer={<OverlapFooter collaborator={collaborator} />}
                />
              ))}
            </div>
          </Section>
        ))}
    </div>
  );
}

/**
 * The evidence behind a connection.
 *
 * Co-authored papers are stated first because they are direct evidence rather
 * than inference; topics and keywords explain the pairs who are close in the
 * network without having published together.
 */
function OverlapFooter({ collaborator }: { collaborator: HiddenCollaborator }) {
  const facts = [
    collaborator.sharedPapers.length > 0
      ? `${collaborator.sharedPapers.length} paper${collaborator.sharedPapers.length === 1 ? '' : 's'} together`
      : null,
    collaborator.sharedTopics.length > 0 ? `${collaborator.sharedTopics.length} shared topics` : null,
    collaborator.sharedKeywords.length > 0
      ? `${collaborator.sharedKeywords.length} shared keywords`
      : null,
  ].filter(Boolean);

  if (facts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-2xs text-muted-foreground">{facts.join(' · ')}</p>
      {collaborator.sharedTopics.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {collaborator.sharedTopics.slice(0, 3).map((topic) => (
            <Badge key={topic.id} variant="outline" className="text-[10px]">
              {topic.name}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Researchers ranked by the reach of their network, across the whole graph.
 *
 * Answers "who connects this research community" rather than "who is near this
 * person", so it needs no anchor author and gives the page something useful
 * before anyone has picked one.
 */
function MostConnectedSection() {
  const { data, isLoading, isError } = useCollaborativeResearchers({ limit: 9, minPartners: 2 });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError || !data || data.items.length === 0) return null;

  return (
    <Section
      title="Most connected researchers"
      description="Ranked by collaboration reach: partners across distinct institutions count for more than more co-authors inside one."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((researcher, index) => (
          <AuthorCard
            key={researcher.id}
            author={researcher}
            index={index}
            footer={
              <div className="flex items-center justify-between text-2xs text-muted-foreground">
                <span>{formatNumber(researcher.partnerCount)} co-authors</span>
                <span>{formatNumber(researcher.institutionCount)} institutions</span>
              </div>
            }
          />
        ))}
      </div>
    </Section>
  );
}

function HiddenTab({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useHiddenCollaborators(id, {
    minSharedTopics: 1,
    limit: 18,
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No hidden collaborators found"
        description="Nobody shares enough topics with this researcher without already having co-authored with them. Researchers with a narrow publication record rarely surface matches here."
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/recommendations">
              <Lightbulb className="size-3.5" />
              Try recommendations instead
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Exactly two hops away, publishing on shared topics, and never a co-author — ranked by mutual
        connections and topic overlap.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.items.map((candidate, index) => (
          <AuthorCard
            key={candidate.id}
            author={candidate}
            index={index}
            footer={
              <div className="space-y-2">
                <ScoreBreakdown score={candidate.score} reasons={candidate.reasons} />
                {candidate.sharedTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {candidate.sharedTopics.slice(0, 3).map((topic) => (
                      <Badge key={topic.id} variant="outline">
                        {topic.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
        ))}
      </div>
    </>
  );
}

function CrossDomainSection() {
  const { data, isLoading } = useCrossDomainCollaborations({ limit: 12, minPapers: 2 });

  if (isLoading) return <ListSkeleton rows={4} />;
  if (!data || data.items.length === 0) return null;

  return (
    <Section
      title="Cross-domain collaboration"
      description="Field pairs that appear together on the same papers. Cross-domain work is a property of a paper's position in the graph, not a column that could be filtered."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((entry) => (
          <div
            key={`${entry.fieldA}-${entry.fieldB}`}
            className="surface-gradient rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="truncate">{entry.fieldA}</span>
              <Layers className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{entry.fieldB}</span>
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">
              {formatNumber(entry.paperCount)} joint papers · {formatNumber(entry.authorCount)}{' '}
              researchers
            </p>
            <ul className="mt-3 space-y-1 border-t border-border pt-3">
              {entry.exemplarPapers.slice(0, 2).map((paper) => (
                <li key={paper.id} className="line-clamp-1 text-2xs text-muted-foreground">
                  {paper.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
