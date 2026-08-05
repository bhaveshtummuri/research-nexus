import { paperRepository } from '../repositories/index.js';
import type { PaperFilters } from '../repositories/paper.repository.js';
import type { PaperDetail, PaperSummary } from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type { PaperListQuery } from '../validators/schemas.js';

import type { ListResult } from './types.js';

/** Paper business logic. */

export async function listPapers(
  query: PaperListQuery,
  pagination: Pagination,
): Promise<ListResult<PaperSummary>> {
  const filters: PaperFilters = {
    search: normaliseSearchTerm(query.search),
    fromYear: query.fromYear ?? null,
    toYear: query.toYear ?? null,
    minCitations: query.minCitations ?? null,
  };

  const [items, total] = await Promise.all([
    paperRepository.findMany(filters, query.sort, pagination),
    paperRepository.count(filters),
  ]);

  return { items, total };
}

export async function getPaper(id: string): Promise<PaperDetail> {
  const paper = await paperRepository.findById(id);
  if (!paper) throw ApiError.notFound('Paper', id);
  return paper;
}
