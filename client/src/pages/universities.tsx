import { Building2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { UniversityCard } from '@/components/entities/university-card';
import { Select } from '@/components/ui/select';
import { useUniversities } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const PAGE_SIZE = 20;

export function UniversitiesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('ranking');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useUniversities({
    search: debouncedSearch,
    sort,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universities"
        description="Institutions, their researchers and the partnerships between them. Institutional output is computed by traversal, not stored on the node."
      />

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search institutions, cities and countries…"
      >
        <Select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(0);
          }}
          aria-label="Sort universities"
          className="w-44"
        >
          <option value="ranking">Sort: ranking</option>
          <option value="researchers">Sort: researchers</option>
          <option value="name">Sort: name</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-2">
            {data.items.map((university, index) => (
              <UniversityCard key={university.id} university={university} index={index} />
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Building2} title="No institutions match that search" />
      )}
    </div>
  );
}
