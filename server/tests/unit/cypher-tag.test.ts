import { describe, expect, it } from 'vitest';

import { cypher } from '../../src/database/cypher-tag.js';

describe('cypher tagged template', () => {
  it('returns the trimmed statement', () => {
    const statement = cypher`
      MATCH (a:Author { id: $id })
      RETURN a
    `;

    expect(statement).toMatch(/^MATCH \(a:Author \{ id: \$id \}\)/);
    expect(statement.endsWith('RETURN a')).toBe(true);
  });

  it('refuses interpolation so query text can never be concatenated', () => {
    const untrustedInput = "') RETURN 1 //";

    expect(() => {
      // The tag is the single choke point for building Cypher; interpolating a
      // value is exactly the mistake it exists to prevent.
      const build = cypher as unknown as (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => string;
      return build`MATCH (a:Author { id: '${untrustedInput}' }) RETURN a`;
    }).toThrow(/must not interpolate/i);
  });

  it('produces an empty statement for an empty template', () => {
    expect(cypher``).toBe('');
  });
});
