import { write } from './utils/db.js';

export interface DerivationStep {
  label: string;
  statement: string;
}

/**
 * Metrics that are computed from the graph rather than invented by the
 * generator.
 *
 * Deriving them in Cypher after the edges exist guarantees the denormalised
 * counters can never disagree with the relationships they summarise, and it
 * doubles as a demonstration of aggregation over traversals - the same idea the
 * analytics endpoints use at query time.
 *
 * Every step is written with OPTIONAL MATCH plus `count()` instead of pattern
 * counting, which keeps the statements valid on any OpenCypher engine.
 */
export const DERIVATION_STEPS: readonly DerivationStep[] = [
  {
    label: 'COLLABORATED_WITH edges from shared authorship',
    statement: `
      MATCH (a:Author)-[:AUTHORED]->(paper:Paper)<-[:AUTHORED]-(b:Author)
      WHERE a.id < b.id
      WITH a, b, count(paper) AS sharedPapers, min(paper.year) AS firstYear, max(paper.year) AS lastYear
      MERGE (a)-[rel:COLLABORATED_WITH]->(b)
      SET rel.paperCount = sharedPapers,
          rel.firstYear = firstYear,
          rel.lastYear = lastYear
    `,
  },
  {
    label: 'Paper citation and reference counts',
    statement: `
      MATCH (paper:Paper)
      OPTIONAL MATCH (paper)<-[incoming:CITES]-(:Paper)
      WITH paper, count(incoming) AS citations
      OPTIONAL MATCH (paper)-[outgoing:CITES]->(:Paper)
      WITH paper, citations, count(outgoing) AS references
      SET paper.citationCount = citations,
          paper.referenceCount = references
    `,
  },
  {
    label: 'Author paper and citation totals',
    statement: `
      MATCH (author:Author)
      OPTIONAL MATCH (author)-[:AUTHORED]->(paper:Paper)
      WITH author, count(paper) AS papers, sum(paper.citationCount) AS citations
      SET author.paperCount = papers,
          author.citationCount = citations
    `,
  },
  {
    label: 'Author h-index',
    statement: `
      MATCH (author:Author)
      OPTIONAL MATCH (author)-[:AUTHORED]->(paper:Paper)
      WITH author, paper
      ORDER BY paper.citationCount DESC
      WITH author, collect(coalesce(paper.citationCount, 0)) AS citations
      WITH author, [index IN range(0, size(citations) - 1)
                    WHERE citations[index] >= index + 1 | index + 1] AS qualifying
      SET author.hIndex = CASE WHEN size(qualifying) = 0 THEN 0 ELSE qualifying[size(qualifying) - 1] END
    `,
  },
  {
    label: 'Topic paper counts',
    statement: `
      MATCH (topic:ResearchTopic)
      OPTIONAL MATCH (paper:Paper)-[:HAS_TOPIC]->(topic)
      WITH topic, count(paper) AS tagged
      SET topic.paperCount = tagged
    `,
  },
  {
    label: 'Keyword paper counts',
    statement: `
      MATCH (keyword:Keyword)
      OPTIONAL MATCH (paper:Paper)-[:HAS_KEYWORD]->(keyword)
      WITH keyword, count(paper) AS tagged
      SET keyword.paperCount = tagged
    `,
  },
  {
    label: 'University researcher counts',
    statement: `
      MATCH (university:University)
      OPTIONAL MATCH (:Author)-[affiliation:AFFILIATED_WITH]->(university)
      WITH university, count(affiliation) AS researchers
      SET university.researcherCount = researchers
    `,
  },
  {
    label: 'Conference paper counts',
    statement: `
      MATCH (conference:Conference)
      OPTIONAL MATCH (paper:Paper)-[:PRESENTED_AT]->(conference)
      WITH conference, count(paper) AS presented
      SET conference.paperCount = presented
    `,
  },
  {
    label: 'Journal paper counts',
    statement: `
      MATCH (journal:Journal)
      OPTIONAL MATCH (paper:Paper)-[:PUBLISHED_IN]->(journal)
      WITH journal, count(paper) AS published
      SET journal.paperCount = published
    `,
  },
  {
    label: 'Dataset usage counts',
    statement: `
      MATCH (dataset:Dataset)
      OPTIONAL MATCH (paper:Paper)-[:USES_DATASET]->(dataset)
      WITH dataset, count(paper) AS uses
      SET dataset.paperCount = uses
    `,
  },
];

export async function applyDerivations(
  onStep?: (label: string, index: number, total: number) => void,
): Promise<void> {
  for (const [index, step] of DERIVATION_STEPS.entries()) {
    onStep?.(step.label, index + 1, DERIVATION_STEPS.length);
    await write(step.statement);
  }
}
