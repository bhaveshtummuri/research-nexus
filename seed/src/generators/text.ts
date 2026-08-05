import {
  ABSTRACT_IMPLICATION,
  ABSTRACT_METHOD,
  ABSTRACT_PROBLEM,
  ABSTRACT_RESULT,
  QUALIFIERS,
} from '../papers/data.js';
import type { Random } from '../utils/random.js';

/** URL-safe, lowercase slug used for generated e-mail addresses and links. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds the lowercase blob that backs global search.
 *
 * Storing it once at write time means the search query is a single indexed
 * `CONTAINS` predicate instead of a fan-out of `toLower()` calls across many
 * properties, which the planner cannot use an index for.
 */
export function searchText(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part): part is string | number => part !== undefined && part !== null && part !== '')
    .map((part) => String(part).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Four-sentence abstract: problem, method, result, implication. */
export function buildAbstract(random: Random, topicName: string, keywords: string[]): string {
  const [keywordA = 'evaluation', keywordB = 'benchmarking'] = keywords;

  const problem = random.pick(ABSTRACT_PROBLEM).replace(/\{topic\}/g, topicName);
  const method = random
    .pick(ABSTRACT_METHOD)
    .replace('{qualifier_lower}', random.pick(QUALIFIERS).toLowerCase())
    .replace(/\{keyword_a\}/g, keywordA)
    .replace(/\{keyword_b\}/g, keywordB);
  const result = random
    .pick(ABSTRACT_RESULT)
    .replace(/\{study_count\}/g, String(random.int(3, 14)))
    .replace(/\{reduction\}/g, String(random.int(11, 62)));
  const implication = random.pick(ABSTRACT_IMPLICATION).replace(/\{topic\}/g, topicName);

  return `${problem} ${method} ${result} ${implication}`;
}
