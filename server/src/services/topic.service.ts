import { COUNT_TOPICS, GET_TOPIC_DETAIL, LIST_TOPICS, LIST_TOPIC_FIELDS } from '../cypher/index.js';
import {
  column,
  mapPaperSummary,
  mapTopicSummary,
  mapUniversitySummary,
  mapYearlyCount,
} from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type { TopicDetail, TopicSummary } from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type { TopicListQuery } from '../validators/schemas.js';

import type { ListResult } from './types.js';

/** Research topic business logic. */

/** Shared helper: every list endpoint pairs a page with its total. */
async function countRows(
  statement: Parameters<typeof runReadOne>[0],
  parameters: Record<string, unknown>,
): Promise<number> {
  const total = await runReadOne(statement, parameters, (record) => toNumber(record.get('total')));
  return total ?? 0;
}

export async function listTopics(
  query: TopicListQuery,
  pagination: Pagination,
): Promise<ListResult<TopicSummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    field: query.field ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_TOPICS, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapTopicSummary(column(record, 'topic')),
    ),
    countRows(COUNT_TOPICS, filters),
  ]);

  return { items, total };
}

export async function listTopicFields(): Promise<
  Array<{ field: string; topicCount: number; paperCount: number }>
> {
  return runRead(LIST_TOPIC_FIELDS, {}, (record) => {
    const source = column(record, 'row') as Record<string, unknown>;
    return {
      field: String(source.field ?? ''),
      topicCount: toNumber(source.topicCount),
      paperCount: toNumber(source.paperCount),
    };
  });
}

/**
 * Topic detail is assembled from two queries rather than one.
 *
 * The base document and the expert ranking have different shapes and different
 * cost profiles, so running them concurrently is both faster and easier to read
 * than forcing a single statement to produce everything.
 */
export async function getTopicBase(id: string): Promise<TopicDetail> {
  const topic = await runReadOne(GET_TOPIC_DETAIL, { id }, (record) => {
    const source = column(record, 'topic') as Record<string, unknown>;
    return {
      ...mapTopicSummary(source),
      relatedTopics: [],
      topPapers: Array.isArray(source.topPapers) ? source.topPapers.map(mapPaperSummary) : [],
      topExperts: [],
      universities: Array.isArray(source.universities)
        ? source.universities.map((entry) => ({
            ...mapUniversitySummary(entry),
            paperCount: toNumber((entry as Record<string, unknown>).paperCount),
          }))
        : [],
      yearlyOutput: Array.isArray(source.yearlyOutput)
        ? source.yearlyOutput.map(mapYearlyCount)
        : [],
    } satisfies TopicDetail;
  });

  if (!topic) throw ApiError.notFound('Research topic', id);
  return topic;
}
