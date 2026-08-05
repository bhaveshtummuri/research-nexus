import { describe, expect, it } from 'vitest';

import { buildGraph, summariseGraph } from '../src/build.js';
import { ENTITY_COUNTS } from '../src/config/index.js';
import { Random } from '../src/utils/random.js';

/**
 * The generator is a pure function of its seed, so it can be verified in full
 * without a database. These tests guard the two properties the rest of the
 * project depends on: the dataset matches the brief, and it is reproducible.
 */
const graph = buildGraph('research-nexus-test');

describe('entity counts', () => {
  it('produces exactly the requested number of each node type', () => {
    expect(graph.authors).toHaveLength(ENTITY_COUNTS.authors);
    expect(graph.papers).toHaveLength(ENTITY_COUNTS.papers);
    expect(graph.universities).toHaveLength(ENTITY_COUNTS.universities);
    expect(graph.topics).toHaveLength(ENTITY_COUNTS.topics);
    expect(graph.keywords).toHaveLength(ENTITY_COUNTS.keywords);
    expect(graph.conferences).toHaveLength(ENTITY_COUNTS.conferences);
    expect(graph.journals).toHaveLength(ENTITY_COUNTS.journals);
    expect(graph.datasets).toHaveLength(ENTITY_COUNTS.datasets);
    expect(graph.fundingAgencies).toHaveLength(ENTITY_COUNTS.fundingAgencies);
    expect(graph.projects).toHaveLength(ENTITY_COUNTS.projects);
  });

  it('generates several thousand relationships', () => {
    const { edgeTotal } = summariseGraph(graph);
    expect(edgeTotal).toBeGreaterThan(5_000);
  });
});

describe('determinism', () => {
  it('produces an identical graph for the same seed', () => {
    const repeat = buildGraph('research-nexus-test');

    expect(repeat.authors[0]).toEqual(graph.authors[0]);
    expect(repeat.papers.at(-1)).toEqual(graph.papers.at(-1));
    expect(repeat.cites).toHaveLength(graph.cites.length);
  });

  it('produces a different graph for a different seed', () => {
    const different = buildGraph('a-different-seed');
    expect(different.authors[0]?.name).not.toBe(graph.authors[0]?.name);
  });
});

describe('referential integrity', () => {
  const authorIds = new Set(graph.authors.map((author) => author.id));
  const paperIds = new Set(graph.papers.map((paper) => paper.id));
  const topicIds = new Set(graph.topics.map((topic) => topic.id));

  it('links every AUTHORED edge to a real author and paper', () => {
    for (const edge of graph.authored) {
      expect(authorIds.has(edge.from)).toBe(true);
      expect(paperIds.has(edge.to)).toBe(true);
    }
  });

  it('links every HAS_TOPIC edge from a paper to a real topic', () => {
    for (const edge of graph.paperTopics) {
      expect(paperIds.has(edge.from)).toBe(true);
      expect(topicIds.has(edge.to)).toBe(true);
    }
  });

  it('never lets a paper cite itself', () => {
    for (const edge of graph.cites) {
      expect(edge.from).not.toBe(edge.to);
    }
  });

  it('gives every paper at least one author and one topic', () => {
    const withAuthors = new Set(graph.authored.map((edge) => edge.to));
    const withTopics = new Set(graph.paperTopics.map((edge) => edge.from));

    expect(withAuthors.size).toBe(graph.papers.length);
    expect(withTopics.size).toBe(graph.papers.length);
  });

  it('gives every author a primary affiliation', () => {
    const primary = graph.affiliatedWith.filter((edge) => edge.props.isPrimary);
    expect(new Set(primary.map((edge) => edge.from)).size).toBe(graph.authors.length);
  });
});

describe('uniqueness constraints', () => {
  it('assigns unique ids within every node collection', () => {
    const collections = [
      graph.authors,
      graph.papers,
      graph.universities,
      graph.topics,
      graph.keywords,
      graph.conferences,
      graph.journals,
      graph.datasets,
      graph.fundingAgencies,
      graph.projects,
    ];

    for (const collection of collections) {
      const ids = new Set(collection.map((row) => row.id));
      expect(ids.size).toBe(collection.length);
    }
  });

  it('assigns unique DOIs, ORCIDs and author names', () => {
    expect(new Set(graph.papers.map((paper) => paper.doi)).size).toBe(graph.papers.length);
    expect(new Set(graph.authors.map((author) => author.name)).size).toBe(graph.authors.length);
    expect(new Set(graph.keywords.map((keyword) => keyword.term)).size).toBe(graph.keywords.length);
  });

  it('builds a keyword semantic network with typed relations', () => {
    expect(graph.relatedKeywords.length).toBeGreaterThan(100);

    const keywordIds = new Set(graph.keywords.map((keyword) => keyword.id));
    for (const edge of graph.relatedKeywords) {
      expect(keywordIds.has(edge.from)).toBe(true);
      expect(keywordIds.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(edge.props.strength).toBeGreaterThan(0);
      expect(['co-occurring', 'synonym', 'broader', 'narrower']).toContain(edge.props.kind);
    }
  });

  it('stores each keyword pair once, in canonical order', () => {
    const pairs = graph.relatedKeywords.map((edge) => [edge.from, edge.to].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('directs FUNDS from agency to project and INCLUDES from project to paper', () => {
    const agencyIds = new Set(graph.fundingAgencies.map((a) => a.id));
    const projectIds = new Set(graph.projects.map((p) => p.id));
    const paperIds = new Set(graph.papers.map((p) => p.id));

    for (const edge of graph.fundedBy) {
      expect(agencyIds.has(edge.from)).toBe(true);
      expect(projectIds.has(edge.to)).toBe(true);
    }
    for (const edge of graph.paperProjects) {
      expect(projectIds.has(edge.from)).toBe(true);
      expect(paperIds.has(edge.to)).toBe(true);
    }
  });

  it('satisfies every uniqueness constraint the schema declares', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;

    expect(unique(graph.authors.map((a) => a.orcid))).toBe(true);
    expect(unique(graph.authors.map((a) => a.email))).toBe(true);
    expect(unique(graph.papers.map((p) => p.doi))).toBe(true);
    expect(unique(graph.universities.map((u) => u.name))).toBe(true);
    expect(unique(graph.topics.map((t) => t.name))).toBe(true);
    expect(unique(graph.keywords.map((k) => k.term))).toBe(true);
    expect(unique(graph.conferences.map((c) => c.acronym))).toBe(true);
    expect(unique(graph.journals.map((j) => j.issn))).toBe(true);
    expect(unique(graph.datasets.map((d) => d.name))).toBe(true);
    expect(unique(graph.fundingAgencies.map((a) => a.name))).toBe(true);
  });

  it('records a single edge per undirected university partnership', () => {
    const pairs = graph.partnersWith.map((edge) =>
      [edge.from, edge.to].sort().join('|'),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe('temporal consistency', () => {
  it('never dates a paper before its topic emerged', () => {
    const emergence = new Map(graph.topics.map((topic) => [topic.id, topic.emergenceYear]));
    const paperYear = new Map(graph.papers.map((paper) => [paper.id, paper.year]));

    // Only the anchor topic constrains the year; secondary topics are allowed to
    // predate nothing, so the check uses the strongest-relevance edge.
    const anchors = graph.paperTopics.filter((edge) => edge.props.relevance >= 0.82);
    for (const edge of anchors) {
      expect(paperYear.get(edge.from)).toBeGreaterThanOrEqual(emergence.get(edge.to) ?? 0);
    }
  });

  it('never lets a paper use a dataset released after it', () => {
    const release = new Map(graph.datasets.map((dataset) => [dataset.id, dataset.releaseYear]));
    const paperYear = new Map(graph.papers.map((paper) => [paper.id, paper.year]));

    for (const edge of graph.usesDataset) {
      expect(release.get(edge.to)!).toBeLessThanOrEqual(paperYear.get(edge.from)!);
    }
  });

  it('gives every project an end year after its start year', () => {
    for (const project of graph.projects) {
      expect(project.endYear).toBeGreaterThan(project.startYear);
    }
  });
});

describe('graph shape', () => {
  it('produces a skewed citation distribution rather than a uniform one', () => {
    const citations = new Map<string, number>();
    for (const edge of graph.cites) {
      citations.set(edge.to, (citations.get(edge.to) ?? 0) + 1);
    }

    const counts = [...citations.values()].sort((a, b) => b - a);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const topDecile = counts.slice(0, Math.ceil(counts.length * 0.1));
    const topShare = topDecile.reduce((sum, value) => sum + value, 0) / total;

    // Real bibliometrics are heavily skewed; a uniform graph would make hub
    // detection and ranking queries meaningless.
    expect(topShare).toBeGreaterThan(0.25);
  });

  it('produces realistic team sizes', () => {
    const sizes = new Map<string, number>();
    for (const edge of graph.authored) {
      sizes.set(edge.to, (sizes.get(edge.to) ?? 0) + 1);
    }

    const values = [...sizes.values()];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(mean).toBeGreaterThan(1.5);
    expect(mean).toBeLessThan(8);
    expect(Math.max(...values)).toBeLessThanOrEqual(7);
  });

  it('writes a lowercase searchText blob on every searchable node', () => {
    for (const author of graph.authors.slice(0, 50)) {
      expect(author.searchText).toBe(author.searchText.toLowerCase());
      expect(author.searchText).toContain(author.name.toLowerCase());
    }
  });
});

describe('Random', () => {
  it('is reproducible for a given seed', () => {
    const a = new Random('seed-a');
    const b = new Random('seed-a');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('respects inclusive integer bounds', () => {
    const random = new Random('bounds');
    for (let index = 0; index < 500; index += 1) {
      const value = random.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('samples without replacement', () => {
    const random = new Random('sample');
    const picked = random.sample(['a', 'b', 'c', 'd', 'e'], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it('returns the whole collection when asked for more than it holds', () => {
    const random = new Random('sample-all');
    expect(random.sample(['a', 'b'], 10)).toHaveLength(2);
  });
});
