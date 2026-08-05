import {
  SEARCH_ALL,
  SEARCH_PAPERS_BY_KEYWORD,
} from '../cypher/index.js';
import { column, mapPaperSummary, round } from '../database/mappers.js';
import { runRead } from '../database/query.js';
import { toNumber } from '../database/serialize.js';
import type { NodeLabel, PaperSummary, SearchHit, SearchResults } from '../types/domain.js';
import type { Pagination } from '../utils/pagination.js';

/**
 * Client routes for each label. Building the link server-side keeps the
 * frontend's command palette free of a label-to-route switch statement, and
 * means a new searchable entity only has to be added in one place.
 */
const ROUTE_BY_LABEL: Record<NodeLabel, (id: string) => string> = {
  Author: (id) => `/authors/${id}`,
  Paper: (id) => `/papers/${id}`,
  ResearchTopic: (id) => `/topics/${id}`,
  University: (id) => `/universities/${id}`,
  Conference: (id) => `/conferences/${id}`,
  Journal: (id) => `/journals/${id}`,
  Dataset: (id) => `/datasets?highlight=${id}`,
  FundingAgency: (id) => `/funding/${id}`,
  Project: (id) => `/funding?project=${id}`,
  Keyword: (id) => `/papers?keyword=${id}`,
};

/** Order the result groups appear in, most useful first. */
const LABEL_ORDER: NodeLabel[] = [
  'Author',
  'Paper',
  'ResearchTopic',
  'University',
  'Conference',
  'Journal',
  'Project',
  'FundingAgency',
  'Dataset',
  'Keyword',
];

export async function search(query: string, perLabel: number): Promise<SearchResults> {
  // `searchText` is stored lowercased, so the term is normalised to match.
  const normalised = query.trim().toLowerCase();

  const hits = await runRead(SEARCH_ALL, { query: normalised, perLabel }, (record) => {
    const label = String(record.get('label')) as NodeLabel;
    const id = String(record.get('id'));
    return {
      id,
      label,
      title: String(record.get('title') ?? ''),
      subtitle: String(record.get('subtitle') ?? ''),
      score: round(toNumber(record.get('score')), 3),
      href: ROUTE_BY_LABEL[label]?.(id) ?? `/search?q=${encodeURIComponent(query)}`,
    } satisfies SearchHit;
  });

  const grouped = new Map<NodeLabel, SearchHit[]>();
  for (const hit of hits) {
    const bucket = grouped.get(hit.label) ?? [];
    bucket.push(hit);
    grouped.set(hit.label, bucket);
  }

  const groups = LABEL_ORDER.filter((label) => grouped.has(label)).map((label) => ({
    label,
    hits: (grouped.get(label) ?? []).sort((a, b) => b.score - a.score),
  }));

  return { query, totalHits: hits.length, groups };
}

export async function findPapersByKeyword(
  keywordId: string,
  pagination: Pagination,
): Promise<PaperSummary[]> {
  return runRead(SEARCH_PAPERS_BY_KEYWORD, { keywordId, ...pagination }, (record) =>
    mapPaperSummary(column(record, 'paper')),
  );
}
