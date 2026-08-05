import { describe, expect, it } from 'vitest';

import {
  cn,
  entityHref,
  formatAuthorList,
  formatCompact,
  formatCurrency,
  formatPercent,
  initials,
  LABEL_STYLES,
  truncate,
} from '@/lib/utils';
import { NODE_LABELS } from '@/types/api';

describe('cn', () => {
  it('resolves conflicting Tailwind utilities in favour of the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    const isHidden = false;
    expect(cn('flex', isHidden && 'hidden', undefined, null, 'gap-2')).toBe('flex gap-2');
  });
});

describe('formatCompact', () => {
  it('keeps small numbers exact and abbreviates large ones', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(12_400)).toBe('12.4K');
    expect(formatCompact(2_500_000)).toBe('2.5M');
  });

  it('renders an em dash for missing values', () => {
    expect(formatCompact(null)).toBe('—');
    expect(formatCompact(undefined)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('scales to the appropriate unit', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(750)).toBe('$750');
    expect(formatCurrency(25_000)).toBe('$25K');
    expect(formatCurrency(4_200_000)).toBe('$4.2M');
    expect(formatCurrency(9_900_000_000)).toBe('$9.9B');
  });
});

describe('formatPercent', () => {
  it('converts a ratio to a percentage', () => {
    expect(formatPercent(0.421)).toBe('42%');
    expect(formatPercent(0.4275, 1)).toBe('42.8%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('truncate', () => {
  it('leaves short strings untouched', () => {
    expect(truncate('Graph databases', 40)).toBe('Graph databases');
  });

  it('breaks on a word boundary when one is close enough', () => {
    const result = truncate('Federated learning for privacy preserving analytics', 30);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(31);
  });
});

describe('initials', () => {
  it('takes at most two initials', () => {
    expect(initials('Ada Okafor')).toBe('AO');
    expect(initials('Jean Claude van Damme')).toBe('JC');
    expect(initials('Prince')).toBe('P');
  });
});

describe('formatAuthorList', () => {
  it('lists every author when the list is short', () => {
    expect(formatAuthorList([{ name: 'A' }, { name: 'B' }])).toBe('A, B');
  });

  it('summarises the overflow', () => {
    const authors = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }];
    expect(formatAuthorList(authors, 3)).toBe('A, B, C +2 more');
  });

  it('handles an empty list', () => {
    expect(formatAuthorList([])).toBe('Unknown authors');
  });
});

describe('label styling', () => {
  it('defines a visual identity for every node label', () => {
    for (const label of NODE_LABELS) {
      expect(LABEL_STYLES[label]).toBeDefined();
      expect(LABEL_STYLES[label].color).toMatch(/^hsl\(var\(--graph-/);
    }
  });

  it('routes every label somewhere valid', () => {
    for (const label of NODE_LABELS) {
      expect(entityHref(label, 'entity-0001').startsWith('/')).toBe(true);
    }
  });

  it('routes entities with a detail page to that page', () => {
    expect(entityHref('Author', 'author-0001')).toBe('/authors/author-0001');
    expect(entityHref('Paper', 'paper-0001')).toBe('/papers/paper-0001');
    expect(entityHref('ResearchTopic', 'topic-0001')).toBe('/topics/topic-0001');
  });
});
