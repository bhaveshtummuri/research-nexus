import { cypher } from '../database/cypher-tag.js';

/**
 * Institution queries, including Jaccard topic-profile similarity.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_UNIVERSITIES = cypher`
  MATCH (university:University)
  WHERE ($search IS NULL OR university.searchText CONTAINS $search)
    AND ($country IS NULL OR university.country = $country)
  WITH university
  ORDER BY
    CASE $sort WHEN 'researchers' THEN -university.researcherCount
               WHEN 'name' THEN 0
               ELSE university.ranking END ASC,
    university.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: university.id,
    name: university.name,
    country: university.country,
    city: university.city,
    type: university.type,
    foundedYear: university.foundedYear,
    ranking: university.ranking,
    researcherCount: university.researcherCount
  } AS university
`;

export const COUNT_UNIVERSITIES = cypher`
  MATCH (university:University)
  WHERE ($search IS NULL OR university.searchText CONTAINS $search)
    AND ($country IS NULL OR university.country = $country)
  RETURN count(university) AS total
`;

export const GET_UNIVERSITY_DETAIL = cypher`
  MATCH (university:University { id: $id })

  OPTIONAL MATCH (author:Author)-[:AFFILIATED_WITH]->(university)
  WITH university, author
  ORDER BY author.hIndex DESC, author.citationCount DESC
  WITH university,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE {
            id: author.id, name: author.name, title: author.title, orcid: author.orcid,
            hIndex: author.hIndex, citationCount: author.citationCount,
            paperCount: author.paperCount, primaryField: author.primaryField, affiliation: NULL
          } END
       ) WHERE entry IS NOT NULL][0..12] AS topAuthors,
       [entry IN collect(author) WHERE entry IS NOT NULL] AS staff

  // Institutional output is the union of everything its researchers wrote, so
  // it is collected once and reused for both the totals and the topic profile.
  UNWIND (CASE WHEN size(staff) = 0 THEN [NULL] ELSE staff END) AS member
  OPTIONAL MATCH (member)-[:AUTHORED]->(authored:Paper)
  WITH university, topAuthors,
       [entry IN collect(DISTINCT authored) WHERE entry IS NOT NULL] AS papers
  WITH university, topAuthors, papers,
       size(papers) AS paperCount,
       reduce(total = 0, paper IN papers | total + coalesce(paper.citationCount, 0)) AS totalCitations

  UNWIND (CASE WHEN size(papers) = 0 THEN [NULL] ELSE papers END) AS institutionalPaper
  OPTIONAL MATCH (institutionalPaper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH university, topAuthors, paperCount, totalCitations, topic,
       count(DISTINCT institutionalPaper) AS topicPapers
  ORDER BY topicPapers DESC
  WITH university, topAuthors, paperCount, totalCitations,
       [entry IN collect(
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field, paperCount: topicPapers } END
       ) WHERE entry IS NOT NULL][0..10] AS topTopics

  OPTIONAL MATCH (university)-[partnership:PARTNERS_WITH]-(partner:University)
  WITH university, topAuthors, paperCount, totalCitations, topTopics,
       [entry IN collect(
          CASE WHEN partner IS NULL THEN NULL ELSE {
            id: partner.id, name: partner.name, country: partner.country,
            since: partnership.since, focus: partnership.focus
          } END
       ) WHERE entry IS NOT NULL] AS partners

  RETURN {
    id: university.id,
    name: university.name,
    country: university.country,
    city: university.city,
    type: university.type,
    foundedYear: university.foundedYear,
    ranking: university.ranking,
    researcherCount: university.researcherCount,
    website: university.website,
    paperCount: paperCount,
    totalCitations: totalCitations,
    topAuthors: topAuthors,
    topTopics: topTopics,
    partners: partners
  } AS university
`;

/**
 * Similarity is the Jaccard index over each institution's topic profile,
 * computed entirely from four-hop traversals. Getting this from a relational
 * schema means materialising a university x topic matrix first.
 */
export const FIND_SIMILAR_UNIVERSITIES = cypher`
  MATCH (source:University { id: $universityId })<-[:AFFILIATED_WITH]-(:Author)
        -[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH source, collect(DISTINCT topic) AS sourceTopics
  WITH source, sourceTopics, size(sourceTopics) AS sourceSize
  WHERE sourceSize > 0

  UNWIND sourceTopics AS sharedTopic
  MATCH (sharedTopic)<-[:HAS_TOPIC]-(:Paper)<-[:AUTHORED]-(:Author)
        -[:AFFILIATED_WITH]->(other:University)
  WHERE other.id <> source.id
  WITH source, sourceSize, other,
       collect(DISTINCT { id: sharedTopic.id, name: sharedTopic.name, field: sharedTopic.field }) AS sharedTopics
  WITH source, sourceSize, other, sharedTopics, size(sharedTopics) AS sharedCount

  MATCH (other)<-[:AFFILIATED_WITH]-(:Author)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(otherTopic:ResearchTopic)
  WITH source, sourceSize, other, sharedTopics, sharedCount, count(DISTINCT otherTopic) AS otherSize
  WITH other, sharedTopics, sharedCount,
       toFloat(sharedCount) / toFloat(sourceSize + otherSize - sharedCount) AS similarity
  WHERE sharedCount >= $minSharedTopics
  WITH other, sharedTopics, sharedCount, similarity
  ORDER BY similarity DESC, sharedCount DESC
  LIMIT $limit

  RETURN {
    university: {
      id: other.id, name: other.name, country: other.country, city: other.city,
      type: other.type, foundedYear: other.foundedYear, ranking: other.ranking,
      researcherCount: other.researcherCount
    },
    sharedTopicCount: sharedCount,
    similarity: similarity,
    sharedTopics: sharedTopics[0..8]
  } AS row
`;
