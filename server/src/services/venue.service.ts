import {
  COUNT_CONFERENCES,
  COUNT_JOURNALS,
  GET_CONFERENCE_DETAIL,
  GET_JOURNAL_DETAIL,
  LIST_CONFERENCES,
  LIST_JOURNALS,
} from '../cypher/index.js';
import {
  column,
  mapAuthorSummary,
  mapConferenceSummary,
  mapJournalSummary,
  mapPaperSummary,
  mapTopicRef,
  mapYearlyCount,
} from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  ConferenceDetail,
  ConferenceSummary,
  JournalDetail,
  JournalSummary,
} from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type { ConferenceListQuery, JournalListQuery } from '../validators/schemas.js';

import type { ListResult } from './types.js';

/**
 * Conference and journal business logic.
 *
 * One module because the two venue kinds share a shape and change together;
 * splitting them would duplicate the mapping for no gain.
 */

/** Shared helper: every list endpoint pairs a page with its total. */
async function countRows(
  statement: Parameters<typeof runReadOne>[0],
  parameters: Record<string, unknown>,
): Promise<number> {
  const total = await runReadOne(statement, parameters, (record) => toNumber(record.get('total')));
  return total ?? 0;
}

export async function listConferences(
  query: ConferenceListQuery,
  pagination: Pagination,
): Promise<ListResult<ConferenceSummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    field: query.field ?? null,
    tier: query.tier ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_CONFERENCES, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapConferenceSummary(column(record, 'conference')),
    ),
    countRows(COUNT_CONFERENCES, filters),
  ]);

  return { items, total };
}

export async function getConference(id: string): Promise<ConferenceDetail> {
  const conference = await runReadOne(GET_CONFERENCE_DETAIL, { id }, (record) => {
    const source = column(record, 'conference') as Record<string, unknown>;
    return {
      ...mapConferenceSummary(source),
      location: String(source.location ?? ''),
      website: String(source.website ?? ''),
      topics: Array.isArray(source.topics) ? source.topics.map(mapTopicRef) : [],
      topPapers: Array.isArray(source.topPapers) ? source.topPapers.map(mapPaperSummary) : [],
      topAuthors: Array.isArray(source.topAuthors) ? source.topAuthors.map(mapAuthorSummary) : [],
      yearlyOutput: Array.isArray(source.yearlyOutput)
        ? source.yearlyOutput.map(mapYearlyCount)
        : [],
    } satisfies ConferenceDetail;
  });

  if (!conference) throw ApiError.notFound('Conference', id);
  return conference;
}

export async function listJournals(
  query: JournalListQuery,
  pagination: Pagination,
): Promise<ListResult<JournalSummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    field: query.field ?? null,
    minImpactFactor: query.minImpactFactor ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_JOURNALS, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapJournalSummary(column(record, 'journal')),
    ),
    countRows(COUNT_JOURNALS, filters),
  ]);

  return { items, total };
}

export async function getJournal(id: string): Promise<JournalDetail> {
  const journal = await runReadOne(GET_JOURNAL_DETAIL, { id }, (record) => {
    const source = column(record, 'journal') as Record<string, unknown>;
    return {
      ...mapJournalSummary(source),
      website: String(source.website ?? ''),
      topics: Array.isArray(source.topics) ? source.topics.map(mapTopicRef) : [],
      topPapers: Array.isArray(source.topPapers) ? source.topPapers.map(mapPaperSummary) : [],
      topAuthors: Array.isArray(source.topAuthors) ? source.topAuthors.map(mapAuthorSummary) : [],
    } satisfies JournalDetail;
  });

  if (!journal) throw ApiError.notFound('Journal', id);
  return journal;
}
