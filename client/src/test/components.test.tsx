import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/common/empty-state';
import { EntityBadge } from '@/components/common/entity-badge';
import { ErrorState } from '@/components/common/error-state';
import { ScoreBreakdown } from '@/components/common/score-bar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { AuthorCard } from '@/components/entities/author-card';
import { ApiRequestError } from '@/lib/api';
import type { AuthorSummary } from '@/types/api';

const author: AuthorSummary = {
  id: 'author-0001',
  name: 'Ada Okafor',
  title: 'Professor',
  orcid: '0000-1111-2222-3333',
  hIndex: 34,
  citationCount: 12_400,
  paperCount: 87,
  primaryField: 'Quantum Information',
  affiliation: { id: 'university-0005', name: 'ETH Zurich', country: 'Switzerland' },
};

describe('Breadcrumbs', () => {
  const renderAt = (path: string, routePath: string, entityLabel?: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={<Breadcrumbs entityLabel={entityLabel} />} />
        </Routes>
      </MemoryRouter>,
    );

  it('renders nothing at the root, where there is no trail to show', () => {
    const { container } = renderAt('/', '/');
    expect(container).toBeEmptyDOMElement();
  });

  it('maps a section segment to its human label and links it', () => {
    renderAt('/authors', '/authors');

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Researchers')).toBeInTheDocument();
  });

  it('substitutes the entity name for an opaque id', () => {
    renderAt('/authors/author-0042', '/authors/:id', 'Ada Okafor');

    // The raw id must never appear - it is meaningless to a reader.
    expect(screen.queryByText('author-0042')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Okafor')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Researchers' })).toHaveAttribute('href', '/authors');
  });

  it('shows a placeholder while the entity name is still loading', () => {
    renderAt('/papers/paper-0007', '/papers/:id');

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('paper-0007')).not.toBeInTheDocument();
  });
});

describe('AuthorCard', () => {
  it('renders the researcher and links to their profile', () => {
    render(
      <MemoryRouter>
        <AuthorCard author={author} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
    expect(screen.getByText('Professor')).toBeInTheDocument();
    expect(screen.getByText('ETH Zurich')).toBeInTheDocument();
    expect(screen.getByText('12.4K citations')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/authors/author-0001');
  });

  it('renders without an affiliation', () => {
    render(
      <MemoryRouter>
        <AuthorCard author={{ ...author, affiliation: null }} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('ETH Zurich')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
  });
});

describe('EntityBadge', () => {
  it('uses the friendly label rather than the raw node label', () => {
    render(<EntityBadge label="ResearchTopic" />);
    expect(screen.getByText('Topic')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No results" description="Try a broader search." />);

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try a broader search.')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('gives database outages an actionable message', () => {
    render(<ErrorState error={new ApiRequestError(503, 'DATABASE_UNAVAILABLE', 'down')} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('The graph database is unavailable')).toBeInTheDocument();
    expect(screen.getByText(/COGNODB_URI/)).toBeInTheDocument();
  });

  it('tells the user the API is unreachable on a network failure', () => {
    render(<ErrorState error={new ApiRequestError(0, 'NETWORK_ERROR', 'offline')} />);
    expect(screen.getByText('Cannot reach the API')).toBeInTheDocument();
  });

  it('falls back to the error message for unclassified failures', () => {
    render(<ErrorState error={new Error('Something odd happened')} />);
    expect(screen.getByText('Something odd happened')).toBeInTheDocument();
  });
});

describe('ScoreBreakdown', () => {
  it('lists every contributing signal so the score is explainable', () => {
    render(
      <ScoreBreakdown
        score={9.5}
        reasons={[
          { kind: 'shared-topic', label: '2 shared topics', weight: 6 },
          { kind: 'co-citation', label: 'Co-cited by 3 papers', weight: 3.5 },
        ]}
      />,
    );

    expect(screen.getByText('9.5')).toBeInTheDocument();
    expect(screen.getByText('2 shared topics')).toBeInTheDocument();
    expect(screen.getByText('Co-cited by 3 papers')).toBeInTheDocument();
  });
});
