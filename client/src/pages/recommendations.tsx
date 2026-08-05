import { FileText, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, NoRecommendations } from '@/components/common/empty-state';
import { EntityPicker, type PickedEntity } from '@/components/common/entity-picker';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { ScoreBreakdown } from '@/components/common/score-bar';
import { Section } from '@/components/common/section';
import { AuthorCard } from '@/components/entities/author-card';
import { PaperCard } from '@/components/entities/paper-card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAuthorRecommendations,
  useSimilarPapers,
  useTopicExperts,
} from '@/hooks/use-api';
import { formatPercent } from '@/lib/utils';

/**
 * Recommendation engine.
 *
 * Three recommenders share one page because they share one idea: a score
 * assembled from independent graph signals, each of which is shown next to the
 * result so the ranking can be explained rather than trusted.
 */
export function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Badge variant="primary">
            <Sparkles className="size-2.5" aria-hidden />
            Explainable ranking
          </Badge>
        }
        title="Recommendations"
        description="Every score below is a weighted sum of graph signals — shared topics, shared keywords, co-citation, bibliographic coupling, mutual collaborators. The contribution of each signal is shown, so nothing is a black box."
      />

      <Tabs defaultValue="papers">
        <TabsList>
          <TabsTrigger value="papers">Similar papers</TabsTrigger>
          <TabsTrigger value="reading">Reading list</TabsTrigger>
          <TabsTrigger value="experts">Find an expert</TabsTrigger>
        </TabsList>

        <TabsContent value="papers">
          <SimilarPapersPanel />
        </TabsContent>
        <TabsContent value="reading">
          <ReadingListPanel />
        </TabsContent>
        <TabsContent value="experts">
          <ExpertsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimilarPapersPanel() {
  const [paper, setPaper] = useState<PickedEntity | null>(null);
  const { data, isLoading, isError, error, refetch } = useSimilarPapers(paper?.id, { limit: 12 });

  return (
    <div className="space-y-5">
      <div className="surface-gradient rounded-lg border border-border p-5">
        <EntityPicker
          label="Seed paper"
          value={paper}
          onChange={setPaper}
          labels={['Paper']}
          placeholder="Search for a paper to find similar work…"
        />
      </div>

      {!paper ? (
        <EmptyState
          icon={FileText}
          title="Pick a paper to start"
          description="Similar work is found by combining shared topics and keywords with co-citation and bibliographic coupling."
        />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length > 0 ? (
        <Section title={`${data.items.length} related papers`}>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.items.map((entry, index) => (
              <PaperCard
                key={entry.id}
                paper={entry}
                index={index}
                footer={<ScoreBreakdown score={entry.score} reasons={entry.reasons} />}
              />
            ))}
          </div>
        </Section>
      ) : (
        <EmptyState
          icon={FileText}
          title="No similar papers found"
          description="Similarity comes from shared topics, keywords and citation overlap. A paper with few of those has nothing to match against yet."
        />
      )}
    </div>
  );
}

function ReadingListPanel() {
  const [author, setAuthor] = useState<PickedEntity | null>(null);
  const { data, isLoading, isError, error, refetch } = useAuthorRecommendations(author?.id, {
    limit: 12,
  });

  return (
    <div className="space-y-5">
      <div className="surface-gradient rounded-lg border border-border p-5">
        <EntityPicker
          label="Researcher"
          value={author}
          onChange={setAuthor}
          labels={['Author']}
          placeholder="Search for a researcher…"
        />
      </div>

      {!author ? (
        <EmptyState
          icon={Users}
          title="Pick a researcher"
          description="Their reading list is built from the topics they publish in, the work of their collaborators, and papers sharing their references."
        />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length > 0 ? (
        <Section title={`${data.items.length} papers worth reading`}>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.items.map((entry, index) => (
              <PaperCard
                key={entry.id}
                paper={entry}
                index={index}
                footer={<ScoreBreakdown score={entry.score} reasons={entry.reasons} />}
              />
            ))}
          </div>
        </Section>
      ) : (
        <NoRecommendations />
      )}
    </div>
  );
}

function ExpertsPanel() {
  const [topic, setTopic] = useState<PickedEntity | null>(null);
  const { data, isLoading, isError, error, refetch } = useTopicExperts(topic?.id, {
    minPapers: 1,
    limit: 15,
  });

  return (
    <div className="space-y-5">
      <div className="surface-gradient rounded-lg border border-border p-5">
        <EntityPicker
          label="Research topic"
          value={topic}
          onChange={setTopic}
          labels={['ResearchTopic']}
          placeholder="Search for a research topic…"
        />
      </div>

      {!topic ? (
        <EmptyState
          icon={Sparkles}
          title="Pick a topic"
          description="Experts are ranked on output, citation impact and how much of their work is devoted to the topic — the last signal is what separates a specialist from a prolific generalist."
        />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data && data.items.length > 0 ? (
        <Section title={`Top experts in ${topic.title}`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((expert, index) => (
              <AuthorCard
                key={expert.id}
                author={expert}
                index={index}
                footer={
                  <div className="space-y-1.5 text-2xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Expertise score</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {expert.expertiseScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{expert.topicPaperCount} papers on this topic</span>
                      <span>{formatPercent(expert.focusRatio)} of output</span>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </Section>
      ) : (
        <EmptyState
          icon={Users}
          title="No experts identified for this topic"
          description="Expertise is ranked from papers published on the topic weighted by citations. A newly seeded topic has no publication record to rank."
        />
      )}
    </div>
  );
}
