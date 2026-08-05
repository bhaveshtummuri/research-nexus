import neo4j from 'neo4j-driver';
import { describe, expect, it } from 'vitest';

import { serializeValue, toNumber } from '../../src/database/serialize.js';

describe('serializeValue', () => {
  it('converts Bolt integers inside the safe range to numbers', () => {
    expect(serializeValue(neo4j.int(42))).toBe(42);
    expect(serializeValue(neo4j.int(0))).toBe(0);
    expect(serializeValue(neo4j.int(-17))).toBe(-17);
  });

  it('falls back to a string beyond the safe integer range', () => {
    // 2^60 cannot be represented exactly as a JS number, so returning a string
    // is what prevents silent precision loss on the wire.
    const huge = neo4j.Integer.fromString('9007199254740993');
    expect(typeof serializeValue(huge)).toBe('string');
  });

  it('walks arrays and nested objects', () => {
    const value = serializeValue({
      count: neo4j.int(3),
      nested: { years: [neo4j.int(2020), neo4j.int(2021)] },
    });

    expect(value).toEqual({ count: 3, nested: { years: [2020, 2021] } });
  });

  it('normalises null and undefined to null', () => {
    expect(serializeValue(null)).toBeNull();
    expect(serializeValue(undefined)).toBeNull();
  });

  it('passes primitives through unchanged', () => {
    expect(serializeValue('graph')).toBe('graph');
    expect(serializeValue(3.5)).toBe(3.5);
    expect(serializeValue(true)).toBe(true);
  });
});

describe('toNumber', () => {
  it('coerces the shapes an aggregate can arrive as', () => {
    expect(toNumber(neo4j.int(12))).toBe(12);
    expect(toNumber(7)).toBe(7);
    expect(toNumber('9')).toBe(9);
  });

  it('returns the fallback for values it cannot interpret', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined, -1)).toBe(-1);
    expect(toNumber('not a number', 5)).toBe(5);
    expect(toNumber(Number.NaN, 3)).toBe(3);
  });
});
