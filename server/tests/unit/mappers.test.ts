import { describe, expect, it } from 'vitest';

import {
  mapAuthorSummary,
  mapGraphPath,
  mapPaperSummary,
  mapScoredPaper,
  round,
} from '../../src/database/mappers.js';

describe('mapAuthorSummary', () => {
  it('maps a fully populated projection', () => {
    const author = mapAuthorSummary({
      id: 'author-0001',
      name: 'Ada Okafor',
      title: 'Professor',
      orcid: '0000-1111-2222-3333',
      hIndex: 34,
      citationCount: 5120,
      paperCount: 87,
      primaryField: 'Quantum Information',
      affiliation: { id: 'university-0005', name: 'ETH Zurich', country: 'Switzerland' },
    });

    expect(author.name).toBe('Ada Okafor');
    expect(author.hIndex).toBe(34);
    expect(author.affiliation?.name).toBe('ETH Zurich');
  });

  it('fills defaults so the client never has to guard against undefined', () => {
    const author = mapAuthorSummary({ id: 'author-0002' });

    expect(author).toEqual({
      id: 'author-0002',
      name: '',
      title: '',
      orcid: '',
      hIndex: 0,
      citationCount: 0,
      paperCount: 0,
      primaryField: '',
      affiliation: null,
    });
  });

  it('returns a null affiliation when the OPTIONAL MATCH found nothing', () => {
    expect(mapAuthorSummary({ id: 'author-0003', affiliation: null }).affiliation).toBeNull();
    expect(mapAuthorSummary({ id: 'author-0004', affiliation: {} }).affiliation).toBeNull();
  });
});

describe('mapPaperSummary', () => {
  it('distinguishes journal and conference venues', () => {
    const journalPaper = mapPaperSummary({
      id: 'paper-0001',
      venue: { id: 'journal-0001', name: 'Nature', kind: 'journal' },
    });
    const conferencePaper = mapPaperSummary({
      id: 'paper-0002',
      venue: { id: 'conference-0001', name: 'NeurIPS', kind: 'conference' },
    });

    expect(journalPaper.venue?.kind).toBe('journal');
    expect(conferencePaper.venue?.kind).toBe('conference');
  });

  it('defaults collections to empty arrays', () => {
    const paper = mapPaperSummary({ id: 'paper-0003' });

    expect(paper.authors).toEqual([]);
    expect(paper.topics).toEqual([]);
    expect(paper.venue).toBeNull();
  });
});

describe('mapScoredPaper', () => {
  it('carries the reason breakdown alongside the score', () => {
    const paper = mapScoredPaper({
      id: 'paper-0004',
      title: 'Graph traversal at scale',
      score: 12.34567,
      reasons: [{ kind: 'shared-topic', label: '2 shared topics', weight: 6.0 }],
    });

    expect(paper.score).toBe(12.346);
    expect(paper.reasons).toHaveLength(1);
    expect(paper.reasons[0]?.kind).toBe('shared-topic');
  });
});

describe('mapGraphPath', () => {
  it('builds a readable narrative from the ordered nodes', () => {
    const path = mapGraphPath({
      length: 2,
      nodes: [
        { elementId: '1', id: 'author-0001', label: 'Author', name: 'Ada Okafor' },
        { elementId: '2', id: 'author-0002', label: 'Author', name: 'Liang Chen' },
        { elementId: '3', id: 'author-0003', label: 'Author', name: 'Nadia Haddad' },
      ],
      edges: [
        { elementId: 'r1', type: 'COLLABORATED_WITH', startElementId: '1', endElementId: '2' },
        { elementId: 'r2', type: 'COLLABORATED_WITH', startElementId: '2', endElementId: '3' },
      ],
    });

    expect(path.length).toBe(2);
    expect(path.narrative).toBe('Ada Okafor → Liang Chen → Nadia Haddad');
  });

  it('derives the length from the edge count when it is absent', () => {
    const path = mapGraphPath({
      nodes: [{ elementId: '1', id: 'a', label: 'Author', name: 'A' }],
      edges: [],
    });

    expect(path.length).toBe(0);
  });
});

describe('round', () => {
  it('keeps scores readable without hiding meaningful precision', () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.14159, 3)).toBe(3.142);
    expect(round(10, 2)).toBe(10);
  });
});
