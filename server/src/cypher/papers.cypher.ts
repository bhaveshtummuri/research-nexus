import { cypher } from '../database/cypher-tag.js';

/**
 * Paper list and full-record queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_PAPERS = cypher`
  MATCH (paper:Paper)
  WHERE ($search IS NULL OR paper.searchText CONTAINS $search)
    AND ($fromYear IS NULL OR paper.year >= $fromYear)
    AND ($toYear IS NULL OR paper.year <= $toYear)
    AND ($minCitations IS NULL OR paper.citationCount >= $minCitations)
  WITH paper
  ORDER BY
    CASE $sort WHEN 'year' THEN paper.year
               WHEN 'references' THEN paper.referenceCount
               ELSE paper.citationCount END DESC,
    paper.title ASC
  SKIP $offset LIMIT $limit

  OPTIONAL MATCH (author:Author)-[authorship:AUTHORED]->(paper)
  WITH paper, author, authorship
  ORDER BY authorship.position ASC
  WITH paper, [entry IN collect(
         CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL] AS authors

  OPTIONAL MATCH (paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH paper, authors, [entry IN collect(
         CASE WHEN topic IS NULL THEN NULL
              ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  OPTIONAL MATCH (paper)-[:PUBLISHED_IN]->(journal:Journal)
  OPTIONAL MATCH (paper)-[:PRESENTED_AT]->(conference:Conference)
  WITH paper, authors, topics, head(collect(journal)) AS journal, head(collect(conference)) AS conference

  RETURN {
    id: paper.id,
    title: paper.title,
    year: paper.year,
    doi: paper.doi,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount,
    authors: authors,
    topics: topics,
    venue: CASE
      WHEN journal IS NOT NULL THEN { id: journal.id, name: journal.name, kind: 'journal' }
      WHEN conference IS NOT NULL THEN { id: conference.id, name: conference.acronym, kind: 'conference' }
      ELSE NULL END
  } AS paper
`;

export const COUNT_PAPERS = cypher`
  MATCH (paper:Paper)
  WHERE ($search IS NULL OR paper.searchText CONTAINS $search)
    AND ($fromYear IS NULL OR paper.year >= $fromYear)
    AND ($toYear IS NULL OR paper.year <= $toYear)
    AND ($minCitations IS NULL OR paper.citationCount >= $minCitations)
  RETURN count(paper) AS total
`;

export const GET_PAPER_DETAIL = cypher`
  MATCH (paper:Paper { id: $id })

  OPTIONAL MATCH (author:Author)-[authorship:AUTHORED]->(paper)
  WITH paper, author, authorship
  ORDER BY authorship.position ASC
  WITH paper, [entry IN collect(
         CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL] AS authors

  OPTIONAL MATCH (paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH paper, authors, [entry IN collect(
         CASE WHEN topic IS NULL THEN NULL
              ELSE { id: topic.id, name: topic.name, field: topic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  OPTIONAL MATCH (paper)-[:HAS_KEYWORD]->(keyword:Keyword)
  WITH paper, authors, topics, [entry IN collect(
         CASE WHEN keyword IS NULL THEN NULL
              ELSE { id: keyword.id, term: keyword.term, paperCount: keyword.paperCount } END
       ) WHERE entry IS NOT NULL] AS keywords

  OPTIONAL MATCH (paper)-[:USES_DATASET]->(dataset:Dataset)
  WITH paper, authors, topics, keywords, [entry IN collect(
         CASE WHEN dataset IS NULL THEN NULL ELSE {
           id: dataset.id, name: dataset.name, domain: dataset.domain,
           license: dataset.license, sizeGb: dataset.sizeGb,
           releaseYear: dataset.releaseYear, paperCount: dataset.paperCount
         } END
       ) WHERE entry IS NOT NULL] AS datasets

  OPTIONAL MATCH (paper)<-[:INCLUDES]-(project:Project)
  OPTIONAL MATCH (paper)-[:PUBLISHED_IN]->(journal:Journal)
  OPTIONAL MATCH (paper)-[:PRESENTED_AT]->(conference:Conference)
  WITH paper, authors, topics, keywords, datasets,
       head(collect(project)) AS project,
       head(collect(journal)) AS journal,
       head(collect(conference)) AS conference

  OPTIONAL MATCH (citing:Paper)-[:CITES]->(paper)
  WITH paper, authors, topics, keywords, datasets, project, journal, conference, citing
  ORDER BY citing.citationCount DESC
  WITH paper, authors, topics, keywords, datasets, project, journal, conference,
       [entry IN collect(
          CASE WHEN citing IS NULL THEN NULL ELSE {
            id: citing.id, title: citing.title, year: citing.year, doi: citing.doi,
            citationCount: citing.citationCount, referenceCount: citing.referenceCount,
            authors: [], topics: [], venue: NULL
          } END
       ) WHERE entry IS NOT NULL][0..12] AS citedBy

  OPTIONAL MATCH (paper)-[:CITES]->(reference:Paper)
  WITH paper, authors, topics, keywords, datasets, project, journal, conference, citedBy, reference
  ORDER BY reference.citationCount DESC
  WITH paper, authors, topics, keywords, datasets, project, journal, conference, citedBy,
       [entry IN collect(
          CASE WHEN reference IS NULL THEN NULL ELSE {
            id: reference.id, title: reference.title, year: reference.year, doi: reference.doi,
            citationCount: reference.citationCount, referenceCount: reference.referenceCount,
            authors: [], topics: [], venue: NULL
          } END
       ) WHERE entry IS NOT NULL][0..12] AS references

  RETURN {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    year: paper.year,
    doi: paper.doi,
    url: paper.url,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount,
    authors: authors,
    topics: topics,
    keywords: keywords,
    datasets: datasets,
    citedBy: citedBy,
    references: references,
    project: CASE WHEN project IS NULL THEN NULL ELSE {
      id: project.id, title: project.title, summary: project.summary, status: project.status,
      startYear: project.startYear, endYear: project.endYear, budgetUsd: project.budgetUsd
    } END,
    venue: CASE
      WHEN journal IS NOT NULL THEN { id: journal.id, name: journal.name, kind: 'journal' }
      WHEN conference IS NOT NULL THEN { id: conference.id, name: conference.acronym, kind: 'conference' }
      ELSE NULL END
  } AS paper
`;
