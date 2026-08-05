import neo4j from 'neo4j-driver';
import { describe, expect, it } from 'vitest';

import { toDriverParameters } from '../../src/database/query.js';

describe('toDriverParameters', () => {
  it('promotes integer-valued numbers to Bolt integers', () => {
    // `SKIP`/`LIMIT` reject floats, so this conversion is what makes pagination
    // work at all rather than being a cosmetic detail.
    const parameters = toDriverParameters({ limit: 20, offset: 0 });

    expect(neo4j.isInt(parameters.limit)).toBe(true);
    expect(neo4j.isInt(parameters.offset)).toBe(true);
  });

  it('leaves non-integral numbers as floats', () => {
    const parameters = toDriverParameters({ minImpactFactor: 3.5 });

    expect(neo4j.isInt(parameters.minImpactFactor)).toBe(false);
    expect(parameters.minImpactFactor).toBe(3.5);
  });

  it('converts nested objects and arrays', () => {
    const parameters = toDriverParameters({
      rows: [{ year: 2024 }],
      ids: ['author-0001'],
    });

    const rows = parameters.rows as Array<Record<string, unknown>>;
    expect(neo4j.isInt(rows[0]?.year)).toBe(true);
    expect(parameters.ids).toEqual(['author-0001']);
  });

  it('preserves nulls so `$param IS NULL` filter branches work', () => {
    expect(toDriverParameters({ search: null })).toEqual({ search: null });
  });

  it('serialises dates to ISO strings', () => {
    const parameters = toDriverParameters({ since: new Date('2024-01-15T00:00:00.000Z') });
    expect(parameters.since).toBe('2024-01-15T00:00:00.000Z');
  });
});
