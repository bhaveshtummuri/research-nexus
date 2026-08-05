import { Users } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { AuthorCard } from '@/components/entities/author-card';
import { Select } from '@/components/ui/select';
import { useAuthors } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 24;

export function AuthorsPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('hIndex');
  const [minHIndex, setMinHIndex] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useAuthors({
    search: debouncedSearch,
    sort,
    minHIndex: minHIndex || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Any filter change invalidates the current offset.
  const resetAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Authors"
        description="Every researcher in the graph, ranked by the bibliometrics derived from their authorship and citation edges."
      />

      <FilterBar
        search={search}
        onSearchChange={resetAnd(setSearch)}
        placeholder="Search by name, title or field…"
      >
        <Select
          value={sort}
          onChange={(event) => resetAnd(setSort)(event.target.value)}
          aria-label="Sort authors"
          className="w-40"
        >
          <option value="hIndex">Sort: h-index</option>
          <option value="citations">Sort: citations</option>
          <option value="papers">Sort: papers</option>
        </Select>
        <Select
          value={minHIndex}
          onChange={(event) => resetAnd(setMinHIndex)(event.target.value)}
          aria-label="Minimum h-index"
          className="w-40"
        >
          <option value="">Any h-index</option>
          <option value="5">h-index ≥ 5</option>
          <option value="10">h-index ≥ 10</option>
          <option value="20">h-index ≥ 20</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((author, index) => (
              <AuthorCard key={author.id} author={author} index={index} />
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No authors match those filters"
          description="Try a broader search term or lower the minimum h-index."
        />
      )}
    </div>
  );
}
