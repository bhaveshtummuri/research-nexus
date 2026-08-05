import { describe, expect, it } from 'vitest';

import { config } from '../../src/config/index.js';
import {
  normaliseSearchTerm,
  resolveDepth,
  resolveGraphLimit,
  resolvePagination,
} from '../../src/utils/pagination.js';

describe('resolvePagination', () => {
  it('applies the configured defaults', () => {
    expect(resolvePagination({})).toEqual({
      offset: 0,
      limit: config.limits.defaultPageSize,
    });
  });

  it('clamps an oversized limit to the configured maximum', () => {
    // Trusting the client here would turn a bounded traversal into a scan.
    expect(resolvePagination({ limit: 100_000 }).limit).toBe(config.limits.maxPageSize);
  });

  it('rejects negative offsets and zero limits', () => {
    expect(resolvePagination({ offset: -50 }).offset).toBe(0);
    expect(resolvePagination({ limit: 0 }).limit).toBe(1);
  });
});

describe('resolveDepth', () => {
  it('clamps to the configured traversal ceiling', () => {
    expect(resolveDepth(99)).toBe(config.limits.maxTraversalDepth);
    expect(resolveDepth(0)).toBe(1);
    expect(resolveDepth(undefined, 3)).toBe(3);
  });
});

describe('resolveGraphLimit', () => {
  it('keeps the node budget inside the renderable range', () => {
    expect(resolveGraphLimit(10_000)).toBe(config.limits.maxGraphNodes);
    expect(resolveGraphLimit(1)).toBe(5);
  });
});

describe('normaliseSearchTerm', () => {
  it('lowercases to match the stored searchText property', () => {
    expect(normaliseSearchTerm('Graph Neural')).toBe('graph neural');
  });

  it('returns null for empty input so the IS NULL branch short-circuits', () => {
    expect(normaliseSearchTerm('   ')).toBeNull();
    expect(normaliseSearchTerm(undefined)).toBeNull();
  });
});
