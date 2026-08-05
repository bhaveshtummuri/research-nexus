import { ENTITY_COUNTS, RELATIONSHIP_TUNING } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { Random } from '../utils/random.js';
import type { AuthorRow, TopicRow, UniversityRow } from '../types.js';

import {
  ACADEMIC_TITLES,
  FAMILY_NAMES,
  GIVEN_NAMES,
  STATEMENT_CLOSERS,
  STATEMENT_OPENERS,
} from './data.js';

export interface AuthorGeneration {
  authors: AuthorRow[];
  /** Home institution per author - drives affiliations and e-mail domains. */
  homeUniversityId: Map<string, string>;
  /** Field the author mainly publishes in, used to cluster co-authorship. */
  fieldByAuthorId: Map<string, string>;
}

/**
 * Authors are generated with a seniority band drawn from the weighted title
 * distribution. Seniority drives career length, and later output and h-index,
 * so a PhD candidate never ends up with a forty-year publication record.
 *
 * Each author is also assigned a home institution and a primary field up front.
 * Both are what give the graph its community structure: co-authorship is later
 * sampled preferentially within an institution and within a field, which is why
 * multi-hop collaboration queries return clusters rather than noise.
 */
export function generateAuthors(
  random: Random,
  universities: readonly UniversityRow[],
  topics: readonly TopicRow[],
): AuthorGeneration {
  const titlePool = ACADEMIC_TITLES.flatMap((entry) =>
    Array.from({ length: entry.weight }, () => entry),
  );
  const fields = [...new Set(topics.map((topic) => topic.field))];

  const usedNames = new Set<string>();
  const authors: AuthorRow[] = [];
  const homeUniversityId = new Map<string, string>();
  const fieldByAuthorId = new Map<string, string>();

  for (let index = 0; index < ENTITY_COUNTS.authors; index += 1) {
    const rank = random.pick(titlePool);
    const authorId = id('author', index);

    let name = '';
    do {
      name = `${random.pick(GIVEN_NAMES)} ${random.pick(FAMILY_NAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    // Higher-ranked institutions attract more researchers, matching reality and
    // giving the graph a handful of genuine hub institutions.
    const university = random.pickSkewed(universities, 1.6);
    const primaryField = random.pick(fields);
    const careerYears = rank.seniority * random.int(3, 6);

    authors.push({
      id: authorId,
      name,
      title: rank.title,
      email: `${slugify(name)}@${slugify(university.name).slice(0, 24)}.edu`,
      orcid: formatOrcid(random),
      primaryField,
      careerStartYear: RELATIONSHIP_TUNING.latestPaperYear - careerYears,
      researchStatement: `${random.pick(STATEMENT_OPENERS)} ${primaryField.toLowerCase()} ${random.pick(STATEMENT_CLOSERS)}`,
      // Bibliometrics are recomputed from the graph once all edges exist.
      hIndex: 0,
      citationCount: 0,
      paperCount: 0,
      searchText: searchText(name, rank.title, primaryField),
    });

    homeUniversityId.set(authorId, university.id);
    fieldByAuthorId.set(authorId, primaryField);
  }

  return { authors, homeUniversityId, fieldByAuthorId };
}

function formatOrcid(random: Random): string {
  const block = (): string => String(random.int(1000, 9999));
  return `0000-${block()}-${block()}-${block()}`;
}
