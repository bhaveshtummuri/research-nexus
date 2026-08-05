import { describe, expect, it } from 'vitest';

import {
  authorListSchema,
  citationPathSchema,
  citationTreeSchema,
  graphExpandSchema,
  hiddenCollaboratorSchema,
  idParamSchema,
  multiHopSchema,
  paperListSchema,
  rankingSchema,
  researcherListSchema,
  searchSchema,
  shortestPathSchema,
  topicSimilaritySchema,
} from '../../src/validators/schemas.js';

describe('idParamSchema', () => {
  it('accepts the generated id format', () => {
    expect(idParamSchema.parse({ id: 'author-0042' }).id).toBe('author-0042');
  });

  it('rejects ids carrying Cypher or path characters', () => {
    for (const id of ["a') RETURN 1 //", '../../etc/passwd', 'author 0042', '']) {
      expect(idParamSchema.safeParse({ id }).success).toBe(false);
    }
  });
});

describe('authorListSchema', () => {
  it('coerces query-string numbers and applies defaults', () => {
    const parsed = authorListSchema.parse({ limit: '25', offset: '50' });

    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(50);
    expect(parsed.sort).toBe('hIndex');
  });

  it('rejects an unknown sort key', () => {
    expect(authorListSchema.safeParse({ sort: 'popularity' }).success).toBe(false);
  });
});

describe('paperListSchema', () => {
  it('bounds publication years to a sane range', () => {
    expect(paperListSchema.safeParse({ fromYear: '1500' }).success).toBe(false);
    expect(paperListSchema.parse({ fromYear: '2020' }).fromYear).toBe(2020);
  });
});

describe('searchSchema', () => {
  it('enforces the minimum query length', () => {
    expect(searchSchema.safeParse({ q: 'a' }).success).toBe(false);
    expect(searchSchema.parse({ q: 'graph' }).perLabel).toBe(5);
  });
});

describe('shortestPathSchema', () => {
  it('parses endpoints, mode and the all-routes flag', () => {
    const parsed = shortestPathSchema.parse({
      from: 'author-0001',
      to: 'author-0002',
      mode: 'any',
      all: 'true',
    });

    expect(parsed.mode).toBe('any');
    expect(parsed.all).toBe(true);
    expect(parsed.maxDepth).toBe(6);
  });

  it('rejects an unknown traversal mode', () => {
    expect(
      shortestPathSchema.safeParse({ from: 'a-1', to: 'a-2', mode: 'telepathy' }).success,
    ).toBe(false);
  });

  it('defaults to collaboration when no mode is given', () => {
    expect(shortestPathSchema.parse({ from: 'a-1', to: 'a-2' }).mode).toBe('collaboration');
  });
});

describe('citationPathSchema', () => {
  // The default is the whole point of the separate schema: a citation endpoint
  // that quietly walked collaboration edges would answer a different question.
  it('defaults to citation rather than collaboration', () => {
    expect(citationPathSchema.parse({ from: 'paper-1', to: 'paper-2' }).mode).toBe('citation');
  });

  it('still honours an explicit mode', () => {
    expect(citationPathSchema.parse({ from: 'paper-1', to: 'paper-2', mode: 'any' }).mode).toBe(
      'any',
    );
  });

  it('requires both endpoints', () => {
    expect(citationPathSchema.safeParse({ from: 'paper-1' }).success).toBe(false);
  });
});

describe('citationTreeSchema', () => {
  it('defaults to a forward tree with a bounded depth', () => {
    const parsed = citationTreeSchema.parse({});

    expect(parsed.direction).toBe('forward');
    expect(parsed.depth).toBe(3);
  });

  it('refuses a depth beyond what the traversal is bounded to', () => {
    // The Cypher pattern is `[:CITES*1..4]`; allowing depth=5 would silently
    // cap rather than reject, so the schema and the query must agree.
    expect(citationTreeSchema.safeParse({ depth: '5' }).success).toBe(false);
  });
});

describe('topicSimilaritySchema', () => {
  it('requires at least one shared keyword to count as similar', () => {
    expect(topicSimilaritySchema.parse({}).minSharedKeywords).toBe(2);
    expect(topicSimilaritySchema.safeParse({ minSharedKeywords: '0' }).success).toBe(false);
  });
});

describe('rankingSchema', () => {
  it('coerces the year filter and leaves it undefined when absent', () => {
    expect(rankingSchema.parse({ fromYear: '2020' }).fromYear).toBe(2020);
    expect(rankingSchema.parse({}).fromYear).toBeUndefined();
  });
});

describe('hiddenCollaboratorSchema', () => {
  it('carries independent topic and keyword thresholds', () => {
    const parsed = hiddenCollaboratorSchema.parse({});

    expect(parsed.minSharedTopics).toBe(1);
    expect(parsed.minSharedKeywords).toBe(2);
  });
});

describe('researcherListSchema', () => {
  it('applies a minimum partner count and coerces paging', () => {
    const parsed = researcherListSchema.parse({ limit: '20' });

    expect(parsed.minPartners).toBe(2);
    expect(parsed.limit).toBe(20);
  });

  it('rejects a partner floor below one', () => {
    expect(researcherListSchema.safeParse({ minPartners: '0' }).success).toBe(false);
  });
});

describe('graphExpandSchema', () => {
  it('keeps only known relationship types from the filter list', () => {
    const parsed = graphExpandSchema.parse({
      id: 'author-0001',
      types: 'AUTHORED,cites,NOT_A_REAL_TYPE',
    });

    expect(parsed.types).toEqual(['AUTHORED', 'CITES']);
  });

  it('leaves the type filter undefined when it is omitted', () => {
    expect(graphExpandSchema.parse({ id: 'author-0001' }).types).toBeUndefined();
  });
});

describe('multiHopSchema', () => {
  it('keeps only known node labels', () => {
    const parsed = multiHopSchema.parse({ labels: 'Author,Paper,Wizard' });
    expect(parsed.labels).toEqual(['Author', 'Paper']);
  });
});
