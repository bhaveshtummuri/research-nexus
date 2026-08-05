import { FileText } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { PaperCard } from '@/components/entities/paper-card';
import { Select } from '@/components/ui/select';
import { usePapers } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 20;

export function PapersPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('citations');
  const [fromYear, setFromYear] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = usePapers({
    search: debouncedSearch,
    sort,
    fromYear: fromYear || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const resetAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Papers"
        description="Search the publication catalogue. Every row carries its authors, venue and topics — assembled in one traversal rather than four joins."
      />

      <FilterBar
        search={search}
        onSearchChange={resetAnd(setSearch)}
        placeholder="Search titles, abstracts, topics and keywords…"
      >
        <Select
          value={sort}
          onChange={(event) => resetAnd(setSort)(event.target.value)}
          aria-label="Sort papers"
          className="w-44"
        >
          <option value="citations">Sort: citations</option>
          <option value="year">Sort: newest</option>
          <option value="references">Sort: references</option>
        </Select>
        <Select
          value={fromYear}
          onChange={(event) => resetAnd(setFromYear)(event.target.value)}
          aria-label="Published from"
          className="w-40"
        >
          <option value="">Any year</option>
          <option value="2022">2022 onwards</option>
          <option value="2020">2020 onwards</option>
          <option value="2018">2018 onwards</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.items.map((paper, index) => (
              <PaperCard key={paper.id} paper={paper} index={index} />
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="No papers match those filters"
          description="Try a different search term or widen the publication window."
        />
      )}
    </div>
  );
}
