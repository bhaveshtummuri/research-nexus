import { BookOpen, Presentation } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { CardGridSkeleton, ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { ConferenceCard, JournalCard } from '@/components/entities/venue-card';
import { Select } from '@/components/ui/select';
import { useConferences, useJournals, useTopicFields } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 18;

export function ConferencesPage() {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(0);

  const fields = useTopicFields();
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useConferences({
    search: debouncedSearch,
    field: field || undefined,
    tier: tier || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conferences"
        description="Where the work is presented. Each venue links to the topics it covers and the researchers who publish there most often."
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search conferences…"
      >
        <Select
          value={field}
          onChange={(event) => {
            setField(event.target.value);
            setPage(0);
          }}
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
          value={tier}
          onChange={(event) => {
            setTier(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by tier"
          className="w-32"
        >
          <option value="">All tiers</option>
          <option value="A*">Tier A*</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton cards={6} className="lg:grid-cols-3" />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((conference, index) => (
              <ConferenceCard key={conference.id} conference={conference} index={index} />
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Presentation} title="No conferences match those filters" />
      )}
    </div>
  );
}

export function JournalsPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('impact');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useJournals({
    search: debouncedSearch,
    sort,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journals"
        description="Peer-reviewed venues ranked by impact factor, with the papers and authors attached to each."
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search journals and publishers…"
      >
        <Select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(0);
          }}
          aria-label="Sort journals"
          className="w-44"
        >
          <option value="impact">Sort: impact factor</option>
          <option value="papers">Sort: papers</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-2">
            {data.items.map((journal, index) => (
              <JournalCard key={journal.id} journal={journal} index={index} />
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={BookOpen} title="No journals match that search" />
      )}
    </div>
  );
}
