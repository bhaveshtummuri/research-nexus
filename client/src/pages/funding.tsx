import { Banknote, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { ListSkeleton } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFundingAgencies, useProjects } from '@/hooks/use-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatCurrency, formatNumber } from '@/lib/utils';

const PAGE_SIZE = 20;

export function FundingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Funding"
        description="Agencies, the projects they back, and the topics that money reaches. Funding connects to research through projects, so the link between a funder and a topic is a traversal, not a column."
      />

      <Tabs defaultValue="agencies">
        <TabsList>
          <TabsTrigger value="agencies">Agencies</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="agencies">
          <AgenciesTab />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgenciesTab() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useFundingAgencies({
    search: debouncedSearch,
    type: type || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search funding agencies…"
      >
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by funder type"
          className="w-52"
        >
          <option value="">All funder types</option>
          <option value="Government">Government</option>
          <option value="Supranational">Supranational</option>
          <option value="Private Foundation">Private foundation</option>
          <option value="Industry Consortium">Industry consortium</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-2">
            {data.items.map((agency) => (
              <Link
                key={agency.id}
                to={`/funding/${agency.id}`}
                className="surface-gradient group flex items-center gap-4 rounded-lg border border-border p-4 transition-all hover:border-graph-funding/45 hover:shadow-raised"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-graph-funding/25 bg-graph-funding/15 text-graph-funding">
                  <Landmark className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium transition-colors group-hover:text-graph-funding">
                    {agency.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {agency.type} · {agency.country}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(agency.totalAwardedUsd)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    across {formatNumber(agency.projectCount)} projects
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Banknote} title="No funding agencies match those filters" />
      )}
    </div>
  );
}

function ProjectsTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useProjects({
    search: debouncedSearch,
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search research projects…"
      >
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by status"
          className="w-40"
        >
          <option value="">Any status</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Planned">Planned</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={8} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.items.map((project) => (
              <div key={project.id} className="surface-gradient rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-pretty text-sm font-medium leading-snug">{project.title}</p>
                  <Badge variant={project.status === 'Active' ? 'success' : 'outline'}>
                    {project.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{project.summary}</p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-2xs text-muted-foreground">
                  <span>
                    {project.startYear}–{project.endYear}
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(project.budgetUsd)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Pagination meta={data.meta} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState icon={Banknote} title="No projects match those filters" />
      )}
    </div>
  );
}
