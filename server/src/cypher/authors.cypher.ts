import { cypher } from '../database/cypher-tag.js';

/**
 * Author list, profile and publication queries.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_AUTHORS = cypher`
  MATCH (author:Author)
  WHERE ($search IS NULL OR author.searchText CONTAINS $search)
    AND ($minHIndex IS NULL OR author.hIndex >= $minHIndex)
  WITH author
  ORDER BY
    CASE $sort WHEN 'citations' THEN author.citationCount
               WHEN 'papers' THEN author.paperCount
               ELSE author.hIndex END DESC,
    author.name ASC
  SKIP $offset LIMIT $limit

  OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH author, head(collect(university)) AS home

  RETURN {
    id: author.id,
    name: author.name,
    title: author.title,
    orcid: author.orcid,
    hIndex: author.hIndex,
    citationCount: author.citationCount,
    paperCount: author.paperCount,
    primaryField: author.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END
  } AS author
`;

export const COUNT_AUTHORS = cypher`
  MATCH (author:Author)
  WHERE ($search IS NULL OR author.searchText CONTAINS $search)
    AND ($minHIndex IS NULL OR author.hIndex >= $minHIndex)
  RETURN count(author) AS total
`;

/**
 * A researcher profile assembled in a single round trip.
 *
 * In a relational schema this page would need six joins across five tables. Here
 * each `OPTIONAL MATCH` walks one relationship type from a node already pinned
 * by an index seek, and the results are folded into one nested document.
 */
export const GET_AUTHOR_DETAIL = cypher`
  MATCH (author:Author { id: $id })

  OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH author, head(collect(university)) AS home

  OPTIONAL MATCH (author)-[:AUTHORED]->(paper:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH author, home, topic, count(DISTINCT paper) AS topicPapers
  ORDER BY topicPapers DESC, topic.name ASC
  WITH author, home,
       [entry IN collect({ id: topic.id, name: topic.name, field: topic.field, paperCount: topicPapers })
        WHERE entry.id IS NOT NULL][0..8] AS topics

  OPTIONAL MATCH (author)-[:AUTHORED]->(recent:Paper)
  WITH author, home, topics, recent
  ORDER BY recent.year DESC, recent.citationCount DESC
  WITH author, home, topics,
       [entry IN collect(recent) WHERE entry IS NOT NULL][0..10] AS recentPapers

  OPTIONAL MATCH (author)-[collaboration:COLLABORATED_WITH]-(peer:Author)
  WITH author, home, topics, recentPapers, peer, collaboration
  ORDER BY collaboration.paperCount DESC, peer.hIndex DESC
  WITH author, home, topics, recentPapers,
       [entry IN collect(
          CASE WHEN peer IS NULL THEN NULL ELSE {
            id: peer.id,
            name: peer.name,
            title: peer.title,
            orcid: peer.orcid,
            hIndex: peer.hIndex,
            citationCount: peer.citationCount,
            paperCount: peer.paperCount,
            primaryField: peer.primaryField,
            affiliation: NULL,
            sharedPaperCount: collaboration.paperCount,
            firstCollaborationYear: collaboration.firstYear,
            lastCollaborationYear: collaboration.lastYear
          } END
       ) WHERE entry IS NOT NULL][0..10] AS collaborators

  // Authors are not attached to projects directly; the link runs through the
  // papers a project includes. Deriving it in the traversal is what lets an
  // author's project list exist at all without a denormalised join table.
  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)<-[:INCLUDES]-(project:Project)
  WITH author, home, topics, recentPapers, collaborators,
       // DISTINCT matters here: a project including several of this author's
       // papers would otherwise be listed once per paper.
       [entry IN collect(DISTINCT
          CASE WHEN project IS NULL THEN NULL ELSE {
            id: project.id, title: project.title, summary: project.summary,
            status: project.status, startYear: project.startYear,
            endYear: project.endYear, budgetUsd: project.budgetUsd
          } END
       ) WHERE entry IS NOT NULL][0..10] AS projects

  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)-[:PRESENTED_AT]->(conference:Conference)
  WITH author, home, topics, recentPapers, collaborators, projects,
       [entry IN collect(DISTINCT
          CASE WHEN conference IS NULL THEN NULL
               ELSE { id: conference.id, name: conference.acronym, kind: 'conference' } END
       ) WHERE entry IS NOT NULL] AS conferenceVenues

  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)-[:PUBLISHED_IN]->(journal:Journal)
  WITH author, home, topics, recentPapers, collaborators, projects, conferenceVenues,
       [entry IN collect(DISTINCT
          CASE WHEN journal IS NULL THEN NULL
               ELSE { id: journal.id, name: journal.name, kind: 'journal' } END
       ) WHERE entry IS NOT NULL] AS journalVenues

  WITH author, home, topics, collaborators, projects, conferenceVenues, journalVenues,
       [paperNode IN recentPapers | {
          id: paperNode.id, title: paperNode.title, year: paperNode.year,
          doi: paperNode.doi, citationCount: paperNode.citationCount,
          referenceCount: paperNode.referenceCount,
          authors: [], venue: NULL, topics: []
       }] AS papers

  RETURN {
    id: author.id,
    name: author.name,
    title: author.title,
    orcid: author.orcid,
    email: author.email,
    researchStatement: author.researchStatement,
    careerStartYear: author.careerStartYear,
    hIndex: author.hIndex,
    citationCount: author.citationCount,
    paperCount: author.paperCount,
    primaryField: author.primaryField,
    affiliation: CASE WHEN home IS NULL THEN NULL
                      ELSE { id: home.id, name: home.name, country: home.country } END,
    topics: topics,
    recentPapers: papers,
    frequentCollaborators: collaborators,
    projects: projects,
    venues: conferenceVenues + journalVenues
  } AS author
`;

export const LIST_AUTHOR_PAPERS = cypher`
  MATCH (author:Author { id: $id })-[:AUTHORED]->(paper:Paper)
  WITH paper
  ORDER BY paper.year DESC, paper.citationCount DESC
  SKIP $offset LIMIT $limit

  OPTIONAL MATCH (coAuthor:Author)-[authorship:AUTHORED]->(paper)
  WITH paper, coAuthor, authorship
  ORDER BY authorship.position ASC
  WITH paper, [entry IN collect(
         CASE WHEN coAuthor IS NULL THEN NULL ELSE { id: coAuthor.id, name: coAuthor.name } END
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
