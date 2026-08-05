import {
  COUNT_AUTHORS,
  GET_AUTHOR_DETAIL,
  LIST_AUTHORS,
  LIST_AUTHOR_PAPERS,
} from '../cypher/index.js';
import {
  column,
  mapAuthorSummary,
  mapCollaboratorSummary,
  mapPaperSummary,
  mapProjectSummary,
  mapTopicRef,
} from '../database/mappers.js';
import { runRead, runReadOne, type QueryParameters } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  AuthorDetail,
  AuthorSummary,
  PaperSummary,
  VenueRef,
} from '../types/domain.js';
import type { Pagination } from '../utils/pagination.js';

/** Filters accepted by the author list query, already normalised by the service. */
export interface AuthorFilters extends QueryParameters {
  search: string | null;
  minHIndex: number | null;
}

export async function findMany(
  filters: AuthorFilters,
  sort: string,
  pagination: Pagination,
): Promise<AuthorSummary[]> {
  return runRead(LIST_AUTHORS, { ...filters, sort, ...pagination }, (record) =>
    mapAuthorSummary(column(record, 'author')),
  );
}

export async function count(filters: AuthorFilters): Promise<number> {
  const total = await runReadOne(COUNT_AUTHORS, filters, (record) =>
    toNumber(record.get('total')),
  );
  return total ?? 0;
}

/**
 * The full profile document. Returns `null` when the author does not exist -
 * turning that into a 404 is the service's decision, not this layer's.
 */
export async function findById(id: string): Promise<AuthorDetail | null> {
  return runReadOne(GET_AUTHOR_DETAIL, { id }, (record) => {
    const source = column(record, 'author') as Record<string, unknown>;
    return {
      ...mapAuthorSummary(source),
      email: String(source.email ?? ''),
      researchStatement: String(source.researchStatement ?? ''),
      careerStartYear: toNumber(source.careerStartYear),
      topics: Array.isArray(source.topics)
        ? source.topics.map((topic) => ({
            ...mapTopicRef(topic),
            paperCount: toNumber((topic as Record<string, unknown>).paperCount),
          }))
        : [],
      recentPapers: Array.isArray(source.recentPapers)
        ? source.recentPapers.map(mapPaperSummary)
        : [],
      frequentCollaborators: Array.isArray(source.frequentCollaborators)
        ? source.frequentCollaborators.map(mapCollaboratorSummary)
        : [],
      projects: Array.isArray(source.projects) ? source.projects.map(mapProjectSummary) : [],
      venues: Array.isArray(source.venues) ? (source.venues as VenueRef[]) : [],
    } satisfies AuthorDetail;
  });
}

export async function findPapers(id: string, pagination: Pagination): Promise<PaperSummary[]> {
  return runRead(LIST_AUTHOR_PAPERS, { id, ...pagination }, (record) =>
    mapPaperSummary(column(record, 'paper')),
  );
}
