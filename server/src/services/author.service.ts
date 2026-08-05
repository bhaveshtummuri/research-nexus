import { authorRepository } from '../repositories/index.js';
import type { AuthorFilters } from '../repositories/author.repository.js';
import type { AuthorDetail, AuthorSummary, PaperSummary } from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type { AuthorListQuery } from '../validators/schemas.js';

import type { ListResult } from './types.js';

/**
 * Author business logic.
 *
 * All data access goes through the repository, so this file holds no Cypher and
 * no driver types — only the decisions: which filters to normalise, and what an
 * absent record means to the caller.
 */

export async function listAuthors(
  query: AuthorListQuery,
  pagination: Pagination,
): Promise<ListResult<AuthorSummary>> {
  const filters: AuthorFilters = {
    search: normaliseSearchTerm(query.search),
    minHIndex: query.minHIndex ?? null,
  };

  // The count runs alongside the page rather than after it: both are cheap index
  // scans, and serialising them would double the endpoint's latency.
  const [items, total] = await Promise.all([
    authorRepository.findMany(filters, query.sort, pagination),
    authorRepository.count(filters),
  ]);

  return { items, total };
}

export async function getAuthor(id: string): Promise<AuthorDetail> {
  const author = await authorRepository.findById(id);
  // Translating "not found" into a 404 is a business decision, so it lives here
  // rather than in the repository, which simply reports absence.
  if (!author) throw ApiError.notFound('Author', id);
  return author;
}

export async function listAuthorPapers(
  id: string,
  pagination: Pagination,
): Promise<PaperSummary[]> {
  return authorRepository.findPapers(id, pagination);
}
