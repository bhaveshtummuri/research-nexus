import {
  COUNT_DATASETS,
  COUNT_FUNDING_AGENCIES,
  COUNT_PROJECTS,
  GET_FUNDING_AGENCY_DETAIL,
  LIST_DATASETS,
  LIST_FUNDING_AGENCIES,
  LIST_KEYWORDS,
  LIST_PROJECTS,
} from '../cypher/index.js';
import {
  column,
  mapDatasetSummary,
  mapFundingAgencySummary,
  mapKeywordSummary,
  mapProjectSummary,
  mapTopicRef,
} from '../database/mappers.js';
import { runRead, runReadOne } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type {
  DatasetSummary,
  FundingAgencyDetail,
  FundingAgencySummary,
  KeywordSummary,
  ProjectSummary,
} from '../types/domain.js';
import { ApiError } from '../utils/api-error.js';
import { normaliseSearchTerm, type Pagination } from '../utils/pagination.js';
import type {
  DatasetListQuery,
  FundingListQuery,
  KeywordListQuery,
  ProjectListQuery,
} from '../validators/schemas.js';

import type { ListResult } from './types.js';

/** Funding agency, project, dataset and keyword business logic. */

/** Shared helper: every list endpoint pairs a page with its total. */
async function countRows(
  statement: Parameters<typeof runReadOne>[0],
  parameters: Record<string, unknown>,
): Promise<number> {
  const total = await runReadOne(statement, parameters, (record) => toNumber(record.get('total')));
  return total ?? 0;
}

export async function listFundingAgencies(
  query: FundingListQuery,
  pagination: Pagination,
): Promise<ListResult<FundingAgencySummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    country: query.country ?? null,
    type: query.type ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_FUNDING_AGENCIES, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapFundingAgencySummary(column(record, 'agency')),
    ),
    countRows(COUNT_FUNDING_AGENCIES, filters),
  ]);

  return { items, total };
}

export async function getFundingAgencyBase(id: string): Promise<FundingAgencyDetail> {
  const agency = await runReadOne(GET_FUNDING_AGENCY_DETAIL, { id }, (record) => {
    const source = column(record, 'agency') as Record<string, unknown>;
    return {
      ...mapFundingAgencySummary(source),
      website: String(source.website ?? ''),
      projects: Array.isArray(source.projects)
        ? source.projects.map((entry) => {
            const project = entry as Record<string, unknown>;
            return {
              ...mapProjectSummary(project),
              awardedUsd: toNumber(project.awardedUsd),
              grantNumber: String(project.grantNumber ?? ''),
            };
          })
        : [],
      topTopics: Array.isArray(source.topTopics)
        ? source.topTopics.map((topic) => ({
            ...mapTopicRef(topic),
            paperCount: toNumber((topic as Record<string, unknown>).paperCount),
          }))
        : [],
      partnerAgencies: [],
    } satisfies FundingAgencyDetail;
  });

  if (!agency) throw ApiError.notFound('Funding agency', id);
  return agency;
}

export async function listProjects(
  query: ProjectListQuery,
  pagination: Pagination,
): Promise<ListResult<ProjectSummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    status: query.status ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_PROJECTS, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapProjectSummary(column(record, 'project')),
    ),
    countRows(COUNT_PROJECTS, filters),
  ]);

  return { items, total };
}

export async function listDatasets(
  query: DatasetListQuery,
  pagination: Pagination,
): Promise<ListResult<DatasetSummary>> {
  const filters = {
    search: normaliseSearchTerm(query.search),
    domain: query.domain ?? null,
  };

  const [items, total] = await Promise.all([
    runRead(LIST_DATASETS, { ...filters, sort: query.sort, ...pagination }, (record) =>
      mapDatasetSummary(column(record, 'dataset')),
    ),
    countRows(COUNT_DATASETS, filters),
  ]);

  return { items, total };
}

export async function listKeywords(
  query: KeywordListQuery,
  pagination: Pagination,
): Promise<KeywordSummary[]> {
  return runRead(
    LIST_KEYWORDS,
    { search: normaliseSearchTerm(query.search), ...pagination },
    (record) => mapKeywordSummary(column(record, 'keyword')),
  );
}
