import { COUNT_UNIVERSITIES, GET_UNIVERSITY_DETAIL, LIST_UNIVERSITIES } from '../cypher/index.js';
import { column, mapAuthorSummary, mapTopicRef, mapUniversitySummary } from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type { UniversityDetail, UniversitySummary } from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type { UniversityListQuery } from '../validators/schemas.js';

import type { ListResult } from './types.js';

/** University business logic. */

/** Shared helper: every list endpoint pairs a page with its total. */
async function countRows(
  statement: Parameters<typeof runReadOne>[0],
  parameters: Record<string, unknown>,
): Promise<number> {
  const total = await runReadOne(statement, parameters, (record) => toNumber(record.get('total')));
  return total ?? 0;
}

export async function listUniversities(
  query: UniversityListQuery,
  pagination: Pagination,
): Promise<ListResult<UniversitySummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    country: query.country ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_UNIVERSITIES, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapUniversitySummary(column(record, 'university')),
    ),
    countRows(COUNT_UNIVERSITIES, filters),
  ]);

  return { items, total };
}

export async function getUniversity(id: string): Promise<UniversityDetail> {
  const university = await runReadOne(GET_UNIVERSITY_DETAIL, { id }, (record) => {
    const source = column(record, 'university') as Record<string, unknown>;
    return {
      ...mapUniversitySummary(source),
      website: String(source.website ?? ''),
      paperCount: toNumber(source.paperCount),
      totalCitations: toNumber(source.totalCitations),
      topAuthors: Array.isArray(source.topAuthors) ? source.topAuthors.map(mapAuthorSummary) : [],
      topTopics: Array.isArray(source.topTopics)
        ? source.topTopics.map((topic) => ({
            ...mapTopicRef(topic),
            paperCount: toNumber((topic as Record<string, unknown>).paperCount),
          }))
        : [],
      partners: Array.isArray(source.partners)
        ? source.partners.map((partner) => {
            const entry = partner as Record<string, unknown>;
            return {
              id: String(entry.id ?? ''),
              name: String(entry.name ?? ''),
              country: String(entry.country ?? ''),
              since: toNumber(entry.since),
              focus: String(entry.focus ?? ''),
            };
          })
        : [],
    } satisfies UniversityDetail;
  });

  if (!university) throw ApiError.notFound('University', id);
  return university;
}
