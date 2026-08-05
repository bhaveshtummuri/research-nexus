/**
 * Deterministic pseudo-random source.
 *
 * The generated graph must be reproducible: the same `SEED_RANDOM_SEED` always
 * produces the same 300 authors, the same citation edges and therefore the same
 * screenshots and demo walkthroughs. `Math.random` cannot offer that, so the
 * seed pipeline uses a small, fast, well-distributed PRNG instead.
 */
export class Random {
  private state: number;

  constructor(seed: string) {
    this.state = hashString(seed);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    // mulberry32 - 32 bits of state, excellent distribution for this workload.
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform float in [min, max) rounded to `decimals`. */
  float(min: number, max: number, decimals = 2): number {
    const value = min + this.next() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Random.pick called with an empty collection');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** `count` distinct members of `items`, or all of them when count is larger. */
  sample<T>(items: readonly T[], count: number): T[] {
    if (count >= items.length) return this.shuffle(items);
    const chosen = new Set<number>();
    const result: T[] = [];
    while (result.length < count) {
      const index = this.int(0, items.length - 1);
      if (chosen.has(index)) continue;
      chosen.add(index);
      result.push(items[index] as T);
    }
    return result;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }

  /**
   * Index drawn from a power-law-ish distribution over `length` items.
   *
   * Real bibliometrics are heavily skewed: a minority of authors, venues and
   * papers attract most of the attention. Sampling with an exponent makes the
   * seeded graph exhibit the same long tail, which is what makes hub detection
   * and ranking queries produce interesting results.
   */
  skewedIndex(length: number, exponent = 2.2): number {
    const index = Math.floor(length * this.next() ** exponent);
    return Math.min(index, length - 1);
  }

  /** Picks from `items` favouring the front of the list. */
  pickSkewed<T>(items: readonly T[], exponent = 2.2): T {
    if (items.length === 0) throw new Error('Random.pickSkewed called with an empty collection');
    return items[this.skewedIndex(items.length, exponent)] as T;
  }

  /** Integer drawn from a bounded, right-skewed distribution. */
  skewedInt(min: number, max: number, exponent = 2): number {
    const span = max - min;
    return min + Math.round(span * this.next() ** exponent);
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
