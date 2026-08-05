import {
  COUNT_PAPERS,
  GET_PAPER_DETAIL,
  LIST_PAPERS,
} from '../cypher/index.js';
import {
  column,
  mapDatasetSummary,
  mapKeywordSummary,
  mapPaperSummary,
  mapProjectSummary,
} from '../database/mappers.js';
import { runRead, runReadOne, type QueryParameters } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type { PaperDetail, PaperSummary } from '../types/domain.js';
import type { Pagination } from '../utils/pagination.js';

export interface PaperFilters extends QueryParameters {
  search: string | null;
  fromYear: number | null;
  toYear: number | null;
  minCitations: number | null;
}

export async function findMany(
  filters: PaperFilters,
  sort: string,
  pagination: Pagination,
): Promise<PaperSummary[]> {
  return runRead(LIST_PAPERS, { ...filters, sort, ...pagination }, (record) =>
    mapPaperSummary(column(record, 'paper')),
  );
}

export async function count(filters: PaperFilters): Promise<number> {
  const total = await runReadOne(COUNT_PAPERS, filters, (record) => toNumber(record.get('total')));
  return total ?? 0;
}

export async function findById(id: string): Promise<PaperDetail | null> {
  return runReadOne(GET_PAPER_DETAIL, { id }, (record) => {
    const source = column(record, 'paper') as Record<string, unknown>;
    return {
      ...mapPaperSummary(source),
      abstract: String(source.abstract ?? ''),
      url: String(source.url ?? ''),
      keywords: Array.isArray(source.keywords) ? source.keywords.map(mapKeywordSummary) : [],
      datasets: Array.isArray(source.datasets) ? source.datasets.map(mapDatasetSummary) : [],
      project: source.project ? mapProjectSummary(source.project) : null,
      citedBy: Array.isArray(source.citedBy) ? source.citedBy.map(mapPaperSummary) : [],
      references: Array.isArray(source.references) ? source.references.map(mapPaperSummary) : [],
    } satisfies PaperDetail;
  });
}
