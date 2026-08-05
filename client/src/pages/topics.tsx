import { Lightbulb } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { CardGridSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { Section } from '@/components/common/section';
import { TopicCard } from '@/components/entities/topic-card';
import { Select } from '@/components/ui/select';
import { useTopicFields, useTopics, useTrendingTopics } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 18;

export function TopicsPage() {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('');
  const [sort, setSort] = useState('papers');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const fields = useTopicFields();
  const trending = useTrendingTopics({ limit: 3, windowYears: 3, minRecentPapers: 3 });
  const { data, isLoading, isError, error, refetch } = useTopics({
    search: debouncedSearch,
    field: field || undefined,
    sort,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const resetAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Research topics"
        description="Topics are first-class nodes, connected to each other by curated RELATED_TO edges and by the papers that discuss both."
      />

      {trending.data && trending.data.items.length > 0 ? (
        <Section
          title="Accelerating right now"
          description="Highest momentum in the most recent three-year window."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.data.items.map((topic, index) => (
              <TopicCard key={topic.id} topic={topic} index={index} />
            ))}
          </div>
        </Section>
      ) : null}

      <div className="space-y-4">
        <FilterBar
          search={search}
          onSearchChange={resetAnd(setSearch)}
          placeholder="Search topics…"
        >
          <Select
            value={field}
            onChange={(event) => resetAnd(setField)(event.target.value)}
            aria-label="Filter by field"
            className="w-52"
          >
            <option value="">All fields</option>
            {(fields.data ?? []).map((entry) => (
              <option key={entry.field} value={entry.field}>
                {entry.field}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(event) => resetAnd(setSort)(event.target.value)}
            aria-label="Sort topics"
            className="w-40"
          >
            <option value="papers">Sort: output</option>
            <option value="recent">Sort: newest</option>
          </Select>
        </FilterBar>

        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <CardGridSkeleton cards={6} className="lg:grid-cols-3" />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((topic, index) => (
                <TopicCard key={topic.id} topic={topic} index={index} />
              ))}
            </div>
            <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState icon={Lightbulb} title="No topics match those filters" />
        )}
      </div>
    </div>
  );
}
