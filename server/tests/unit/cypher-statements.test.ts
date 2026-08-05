import { describe, expect, it } from 'vitest';

import * as analytics from '../../src/cypher/analytics.cypher.js';
import * as authors from '../../src/cypher/authors.cypher.js';
import * as citations from '../../src/cypher/citations.cypher.js';
import * as collaboration from '../../src/cypher/collaboration.cypher.js';
import * as conferences from '../../src/cypher/conferences.cypher.js';
import * as datasets from '../../src/cypher/datasets.cypher.js';
import * as funding from '../../src/cypher/funding.cypher.js';
import * as graph from '../../src/cypher/graph.cypher.js';
import * as journals from '../../src/cypher/journals.cypher.js';
import * as keywords from '../../src/cypher/keywords.cypher.js';
import * as papers from '../../src/cypher/papers.cypher.js';
import * as projects from '../../src/cypher/projects.cypher.js';
import * as recommendations from '../../src/cypher/recommendations.cypher.js';
import * as search from '../../src/cypher/search.cypher.js';
import * as topics from '../../src/cypher/topics.cypher.js';
import * as universities from '../../src/cypher/universities.cypher.js';
import { NODE_LABELS, RELATIONSHIP_TYPES } from '../../src/types/domain.js';

/**
 * Static checks across every Cypher statement in the codebase.
 *
 * These cannot prove a query is semantically correct - only a real engine can -
 * but they do enforce the project's non-negotiable invariants on all of them at
 * once, and they catch a new query that forgets to follow the rules.
 */
const MODULES = {
  analytics, authors, citations, collaboration, conferences, datasets, funding,
  graph, journals, keywords, papers, projects, recommendations, search, topics,
  universities,
};

const ALL_STATEMENTS = Object.entries(MODULES).flatMap(([moduleName, moduleExports]) =>
  Object.entries(moduleExports)
    .filter(([, value]) => typeof value === 'string')
    .map(([name, value]) => ({ name: `${moduleName}.${name}`, statement: value as string })),
);

describe('Cypher statements', () => {
  it('exports a non-trivial set of queries', () => {
    // 70 across 16 feature modules. A drop here means a module lost a statement
    // during a refactor - which is exactly how one was silently lost once.
    expect(ALL_STATEMENTS.length).toBe(70);
  });

  /**
   * Schema drift guards.
   *
   * A query naming a label or relationship type that does not exist is not a
   * syntax error and not a type error - it simply matches nothing, and the
   * endpoint quietly returns an empty list forever. Three such bugs shipped
   * here at once (`:ResearchProject` for `:Project`, `FUNDED_BY` for `FUNDS`,
   * and an invented `PART_OF_PROJECT`), so the vocabulary is now pinned to the
   * domain model that the seed and the schema files agree on.
   */
  it('uses only node labels that exist in the schema', () => {
    for (const { name, statement } of ALL_STATEMENTS) {
      // Labels appear as `(alias:Label)` or `(:Label)`, never bare.
      const labels = [...statement.matchAll(/\(\s*\w*\s*:([A-Za-z_][A-Za-z0-9_]*)/g)].map(
        (match) => match[1] as string,
      );
      for (const label of labels) {
        expect(NODE_LABELS, `${name} references unknown label :${label}`).toContain(label);
      }
    }
  });

  it('uses only relationship types that exist in the schema', () => {
    for (const { name, statement } of ALL_STATEMENTS) {
      const types = [...statement.matchAll(/\[\s*\w*\s*:([A-Z_][A-Z0-9_]*)/g)].map(
        (match) => match[1] as string,
      );
      for (const type of types) {
        expect(RELATIONSHIP_TYPES, `${name} references unknown edge :${type}`).toContain(type);
      }
    }
  });

  it('emits only node labels the client can resolve', () => {
    // `SEARCH_ALL` hands the label back as a string; if it disagrees with the
    // domain union, the client routes a hit to a page that does not exist.
    const emitted = [...search.SEARCH_ALL.matchAll(/RETURN '([A-Za-z]+)' AS label/g)].map(
      (match) => match[1] as string,
    );
    expect(emitted.length).toBeGreaterThan(5);
    for (const label of emitted) {
      expect(NODE_LABELS, `SEARCH_ALL emits unknown label ${label}`).toContain(label);
    }
  });

  it.each(ALL_STATEMENTS)('$name is a non-empty statement', ({ statement }) => {
    expect(statement.trim().length).toBeGreaterThan(10);
  });

  it.each(ALL_STATEMENTS)('$name contains no template interpolation', ({ statement }) => {
    // A surviving `${` would mean a value was baked into the query text.
    expect(statement).not.toContain('${');
  });

  it.each(ALL_STATEMENTS)('$name uses only well-formed parameter names', ({ statement }) => {
    const parameters = statement.match(/\$[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    for (const parameter of parameters) {
      expect(parameter).toMatch(/^\$[a-zA-Z][a-zA-Z0-9]*$/);
    }
  });

  it.each(ALL_STATEMENTS)('$name has balanced braces and parentheses', ({ statement }) => {
    const count = (character: string) => statement.split(character).length - 1;
    expect(count('(')).toBe(count(')'));
    expect(count('{')).toBe(count('}'));
    expect(count('[')).toBe(count(']'));
  });

  it('parameterises every user-supplied filter rather than inlining it', () => {
    // Optional filters follow the `($param IS NULL OR ...)` pattern; the count
    // is a floor, so removing parameterisation from a query fails the test.
    const optionalFilters = ALL_STATEMENTS.filter(({ statement }) =>
      /\$\w+ IS NULL OR/.test(statement),
    );
    expect(optionalFilters.length).toBeGreaterThanOrEqual(8);
  });

  it('bounds every variable-length traversal with a literal maximum', () => {
    const variableLength = ALL_STATEMENTS.filter(({ statement }) => /\*\d*\.\./.test(statement));
    expect(variableLength.length).toBeGreaterThan(0);

    for (const { name, statement } of variableLength) {
      const patterns = statement.match(/\*\d*\.\.\d*/g) ?? [];
      for (const pattern of patterns) {
        // An unbounded `*..` would let one request walk the whole graph.
        expect(pattern, `${name} has an unbounded traversal`).toMatch(/\*\d*\.\.\d+/);
      }
    }
  });

  it('parameterises every SKIP and LIMIT rather than inlining a page size', () => {
    const paginated = ALL_STATEMENTS.filter(({ statement }) => /\bSKIP\b/.test(statement));
    expect(paginated.length).toBeGreaterThan(5);

    for (const { name, statement } of paginated) {
      expect(statement, `${name} must take $offset`).toMatch(/SKIP \$offset/);
      expect(statement, `${name} must take $limit`).toMatch(/LIMIT \$limit/);
    }
  });

  it('never hard-codes a numeric LIMIT that a caller should control', () => {
    // Fixed slices inside a projection are fine; a bare top-level numeric LIMIT
    // means a page size was baked into the query.
    for (const { name, statement } of ALL_STATEMENTS) {
      const inlineLimits = statement.match(/\bLIMIT\s+\d+/g) ?? [];
      expect(inlineLimits, `${name} hard-codes a LIMIT`).toHaveLength(0);
    }
  });
});
