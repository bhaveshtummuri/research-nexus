import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { NodeLabel } from '@/types/api';

/** Merges conditional class names, resolving Tailwind conflicts sensibly. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('en-US');

/** 12400 → "12.4K". Used wherever a figure must fit inside a stat tile. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.abs(value) < 1000 ? numberFormatter.format(value) : compactFormatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormatter.format(value);
}

export function formatCurrency(value: number | null | undefined): string {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${numberFormatter.format(value)}`;
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Truncates on a word boundary so labels never end mid-word. */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Renders an author list the way a citation would. */
export function formatAuthorList(
  authors: Array<{ name: string }>,
  maxNames = 3,
): string {
  if (authors.length === 0) return 'Unknown authors';
  if (authors.length <= maxNames) return authors.map((author) => author.name).join(', ');
  const shown = authors
    .slice(0, maxNames)
    .map((author) => author.name)
    .join(', ');
  return `${shown} +${authors.length - maxNames} more`;
}

// ---------------------------------------------------------------------------
// Graph presentation
// ---------------------------------------------------------------------------

/**
 * One visual identity per node label, reused by the graph canvas, badges and
 * search results. Keeping it in a single map is what makes a `Paper` the same
 * blue everywhere in the product.
 */
export const LABEL_STYLES: Record<
  NodeLabel,
  { name: string; short: string; color: string; badge: string; dot: string; route: string }
> = {
  Author: {
    name: 'Author',
    short: 'AU',
    color: 'hsl(var(--graph-author))',
    badge: 'bg-graph-author/15 text-graph-author border-graph-author/25',
    dot: 'bg-graph-author',
    route: '/authors',
  },
  Paper: {
    name: 'Paper',
    short: 'PA',
    color: 'hsl(var(--graph-paper))',
    badge: 'bg-graph-paper/15 text-graph-paper border-graph-paper/25',
    dot: 'bg-graph-paper',
    route: '/papers',
  },
  ResearchTopic: {
    name: 'Topic',
    short: 'TO',
    color: 'hsl(var(--graph-topic))',
    badge: 'bg-graph-topic/15 text-graph-topic border-graph-topic/25',
    dot: 'bg-graph-topic',
    route: '/topics',
  },
  University: {
    name: 'University',
    short: 'UN',
    color: 'hsl(var(--graph-university))',
    badge: 'bg-graph-university/15 text-graph-university border-graph-university/25',
    dot: 'bg-graph-university',
    route: '/universities',
  },
  Conference: {
    name: 'Conference',
    short: 'CF',
    color: 'hsl(var(--graph-conference))',
    badge: 'bg-graph-conference/15 text-graph-conference border-graph-conference/25',
    dot: 'bg-graph-conference',
    route: '/conferences',
  },
  Journal: {
    name: 'Journal',
    short: 'JO',
    color: 'hsl(var(--graph-journal))',
    badge: 'bg-graph-journal/15 text-graph-journal border-graph-journal/25',
    dot: 'bg-graph-journal',
    route: '/journals',
  },
  Dataset: {
    name: 'Dataset',
    short: 'DS',
    color: 'hsl(var(--graph-dataset))',
    badge: 'bg-graph-dataset/15 text-graph-dataset border-graph-dataset/25',
    dot: 'bg-graph-dataset',
    route: '/datasets',
  },
  FundingAgency: {
    name: 'Funder',
    short: 'FA',
    color: 'hsl(var(--graph-funding))',
    badge: 'bg-graph-funding/15 text-graph-funding border-graph-funding/25',
    dot: 'bg-graph-funding',
    route: '/funding',
  },
  Project: {
    name: 'Project',
    short: 'PR',
    color: 'hsl(var(--graph-project))',
    badge: 'bg-graph-project/15 text-graph-project border-graph-project/25',
    dot: 'bg-graph-project',
    route: '/funding',
  },
  Keyword: {
    name: 'Keyword',
    short: 'KW',
    color: 'hsl(var(--graph-keyword))',
    badge: 'bg-graph-keyword/15 text-graph-keyword border-graph-keyword/25',
    dot: 'bg-graph-keyword',
    route: '/papers',
  },
};

/** Detail route for an entity, or the list route when there is no detail page. */
export function entityHref(label: NodeLabel, id: string): string {
  switch (label) {
    case 'Author':
      return `/authors/${id}`;
    case 'Paper':
      return `/papers/${id}`;
    case 'ResearchTopic':
      return `/topics/${id}`;
    case 'University':
      return `/universities/${id}`;
    case 'Conference':
      return `/conferences/${id}`;
    case 'Journal':
      return `/journals/${id}`;
    case 'FundingAgency':
      return `/funding/${id}`;
    default:
      return LABEL_STYLES[label].route;
  }
}

/** Human-readable relationship names for legends and path narration. */
export const RELATIONSHIP_LABELS: Record<string, string> = {
  AUTHORED: 'authored',
  CITES: 'cites',
  AFFILIATED_WITH: 'affiliated with',
  HAS_TOPIC: 'has topic',
  HAS_KEYWORD: 'has keyword',
  PUBLISHED_IN: 'published in',
  PRESENTED_AT: 'presented at',
  USES_DATASET: 'uses dataset',
  FUNDS: 'funds',
  COLLABORATED_WITH: 'collaborated with',
  RELATED_TO: 'related to',
  INCLUDES: 'includes',
  PARTNERS_WITH: 'partners with',
};

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Stable array of N placeholders for skeleton rendering. */
export function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}
