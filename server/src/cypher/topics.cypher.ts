import { cypher } from '../database/cypher-tag.js';

/**
 * Research topic queries: listing, detail, relatedness, trends and expertise.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_TOPICS = cypher`
  MATCH (topic:ResearchTopic)
  WHERE ($search IS NULL OR topic.searchText CONTAINS $search)
    AND ($field IS NULL OR topic.field = $field)
  WITH topic
  ORDER BY
    CASE $sort WHEN 'recent' THEN topic.emergenceYear
               ELSE topic.paperCount END DESC,
    topic.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: topic.id,
    name: topic.name,
    field: topic.field,
    description: topic.description,
    emergenceYear: topic.emergenceYear,
    paperCount: topic.paperCount
  } AS topic
`;

export const COUNT_TOPICS = cypher`
  MATCH (topic:ResearchTopic)
  WHERE ($search IS NULL OR topic.searchText CONTAINS $search)
    AND ($field IS NULL OR topic.field = $field)
  RETURN count(topic) AS total
`;

export const LIST_TOPIC_FIELDS = cypher`
  MATCH (topic:ResearchTopic)
  WITH topic.field AS field, count(topic) AS topicCount, sum(topic.paperCount) AS paperCount
  ORDER BY paperCount DESC
  RETURN { field: field, topicCount: topicCount, paperCount: paperCount } AS row
`;

export const GET_TOPIC_DETAIL = cypher`
  MATCH (topic:ResearchTopic { id: $id })

  OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(paper:Paper)
  WITH topic, paper
  ORDER BY paper.citationCount DESC
  WITH topic,
       [entry IN collect(
          CASE WHEN paper IS NULL THEN NULL ELSE {
            id: paper.id, title: paper.title, year: paper.year, doi: paper.doi,
            citationCount: paper.citationCount, referenceCount: paper.referenceCount,
            authors: [], topics: [], venue: NULL
          } END
       ) WHERE entry IS NOT NULL][0..10] AS topPapers,
       [entry IN collect(paper) WHERE entry IS NOT NULL] AS allPapers

  UNWIND (CASE WHEN size(allPapers) = 0 THEN [NULL] ELSE allPapers END) AS yearPaper
  WITH topic, topPapers, allPapers, yearPaper.year AS year, count(yearPaper) AS yearCount
  ORDER BY year ASC
  WITH topic, topPapers, allPapers,
       [entry IN collect(
          CASE WHEN year IS NULL THEN NULL ELSE { year: year, count: yearCount } END
       ) WHERE entry IS NOT NULL] AS yearlyOutput

  UNWIND (CASE WHEN size(allPapers) = 0 THEN [NULL] ELSE allPapers END) AS uniPaper
  OPTIONAL MATCH (uniPaper)<-[:AUTHORED]-(:Author)-[:AFFILIATED_WITH]->(university:University)
  WITH topic, topPapers, yearlyOutput, university, count(DISTINCT uniPaper) AS universityPapers
  ORDER BY universityPapers DESC
  WITH topic, topPapers, yearlyOutput,
       [entry IN collect(
          CASE WHEN university IS NULL THEN NULL ELSE {
            id: university.id, name: university.name, country: university.country,
            city: university.city, type: university.type, foundedYear: university.foundedYear,
            ranking: university.ranking, researcherCount: university.researcherCount,
            paperCount: universityPapers
          } END
       ) WHERE entry IS NOT NULL][0..10] AS universities

  RETURN {
    id: topic.id,
    name: topic.name,
    field: topic.field,
    description: topic.description,
    emergenceYear: topic.emergenceYear,
    paperCount: topic.paperCount,
    topPapers: topPapers,
    yearlyOutput: yearlyOutput,
    universities: universities,
    relatedTopics: [],
    topExperts: []
  } AS topic
`;

/**
 * Combines curated RELATED_TO edges with topics inferred from co-occurrence on
 * the same papers. The inferred half is what surfaces connections nobody
 * recorded explicitly.
 */
export const FIND_RELATED_TOPICS = cypher`
  MATCH (topic:ResearchTopic { id: $topicId })

  OPTIONAL MATCH (topic)-[link:RELATED_TO]-(direct:ResearchTopic)
  WITH topic, [entry IN collect(
         CASE WHEN direct IS NULL THEN NULL
              ELSE { id: direct.id, name: direct.name, field: direct.field,
                     strength: link.strength, connectionKind: 'direct' } END
       ) WHERE entry IS NOT NULL] AS directLinks

  OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(paper:Paper)-[:HAS_TOPIC]->(inferred:ResearchTopic)
  WHERE inferred.id <> topic.id
  WITH topic, directLinks, inferred, count(DISTINCT paper) AS coOccurrence
  WITH topic, directLinks, [entry IN collect(
         CASE WHEN inferred IS NULL THEN NULL
              ELSE { id: inferred.id, name: inferred.name, field: inferred.field,
                     strength: toFloat(coOccurrence), connectionKind: 'inferred' } END
       ) WHERE entry IS NOT NULL] AS inferredLinks

  UNWIND (directLinks + inferredLinks) AS link
  WITH link.id AS topicId, link.name AS name, link.field AS field,
       max(link.strength) AS strength,
       CASE WHEN 'direct' IN collect(link.connectionKind) THEN 'direct' ELSE 'inferred' END AS connectionKind
  ORDER BY connectionKind ASC, strength DESC, name ASC
  LIMIT $limit
  RETURN {
    id: topicId, name: name, field: field,
    strength: strength, connectionKind: connectionKind
  } AS related
`;

/**
 * Topic similarity measured through the keyword vocabulary:
 * Topic→Paper→Keyword→Paper→Topic.
 *
 * This finds what `FIND_RELATED_TOPICS` cannot. That query needs two topics to
 * co-occur on the *same* paper; this one connects topics that share no paper at
 * all but draw on the same vocabulary — the case where two communities are
 * working on one problem without citing each other.
 *
 * The score is a Jaccard ratio over keyword sets rather than a raw count, so a
 * broad topic that shares keywords with everything does not dominate a narrow
 * topic that overlaps almost perfectly.
 */
export const FIND_SIMILAR_TOPICS_BY_KEYWORD = cypher`
  MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(keyword:Keyword)
  WITH topic, collect(DISTINCT keyword.id) AS sourceKeywordIds
  WHERE size(sourceKeywordIds) > 0

  MATCH (candidate:ResearchTopic)<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(shared:Keyword)
  WHERE candidate.id <> topic.id
    AND shared.id IN sourceKeywordIds
  WITH topic, sourceKeywordIds, candidate,
       collect(DISTINCT { id: shared.id, term: shared.term }) AS sharedKeywords

  // Denominator of the Jaccard ratio: the candidate's own keyword breadth.
  MATCH (candidate)<-[:HAS_TOPIC]-(:Paper)-[:HAS_KEYWORD]->(candidateKeyword:Keyword)
  WITH topic, sourceKeywordIds, candidate, sharedKeywords,
       count(DISTINCT candidateKeyword) AS candidateKeywordCount
  WITH topic, candidate, sharedKeywords, size(sharedKeywords) AS sharedKeywordCount,
       toFloat(size(sharedKeywords)) /
         toFloat(size(sourceKeywordIds) + candidateKeywordCount - size(sharedKeywords)) AS similarity
  WHERE sharedKeywordCount >= $minSharedKeywords
  WITH topic, candidate, sharedKeywords, sharedKeywordCount, similarity
  ORDER BY similarity DESC, sharedKeywordCount DESC
  LIMIT $limit

  // Papers carrying both topics: the concrete evidence behind the score.
  OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(joint:Paper)-[:HAS_TOPIC]->(candidate)
  WITH topic, candidate, sharedKeywords, sharedKeywordCount, similarity,
       [entry IN collect(DISTINCT
          CASE WHEN joint IS NULL THEN NULL
               ELSE { id: joint.id, title: joint.title, year: joint.year } END
       ) WHERE entry IS NOT NULL][0..5] AS commonPapers

  OPTIONAL MATCH (candidate)<-[:HAS_TOPIC]-(paper:Paper)<-[:AUTHORED]-(researcher:Author)
  WITH candidate, sharedKeywords, sharedKeywordCount, similarity, commonPapers,
       researcher, count(DISTINCT paper) AS researcherPapers
  ORDER BY researcherPapers DESC, researcher.citationCount DESC
  WITH candidate, sharedKeywords, sharedKeywordCount, similarity, commonPapers,
       [entry IN collect(
          CASE WHEN researcher IS NULL THEN NULL
               ELSE { id: researcher.id, name: researcher.name, paperCount: researcherPapers } END
       ) WHERE entry IS NOT NULL][0..5] AS relatedResearchers

  RETURN {
    id: candidate.id,
    name: candidate.name,
    field: candidate.field,
    description: candidate.description,
    emergenceYear: candidate.emergenceYear,
    paperCount: candidate.paperCount,
    similarity: similarity,
    sharedKeywordCount: sharedKeywordCount,
    sharedKeywords: sharedKeywords[0..10],
    commonPapers: commonPapers,
    relatedResearchers: relatedResearchers
  } AS topic
  ORDER BY topic.similarity DESC
`;

/**
 * Compares output in a recent window against the window immediately before it.
 * Both counts come from the same traversal, so a topic's growth rate is derived
 * rather than stored - no nightly aggregation job required.
 */
export const FIND_TRENDING_TOPICS = cypher`
  MATCH (topic:ResearchTopic)<-[:HAS_TOPIC]-(paper:Paper)
  WHERE paper.year >= $priorFromYear
  WITH topic,
       sum(CASE WHEN paper.year >= $recentFromYear THEN 1 ELSE 0 END) AS recentPaperCount,
       sum(CASE WHEN paper.year < $recentFromYear THEN 1 ELSE 0 END) AS priorPaperCount
  WHERE recentPaperCount >= $minRecentPapers

  WITH topic, recentPaperCount, priorPaperCount,
       toFloat(recentPaperCount) / toFloat(CASE WHEN priorPaperCount = 0 THEN 1 ELSE priorPaperCount END) AS growthRate
  WITH topic, recentPaperCount, priorPaperCount, growthRate,
       growthRate * log(toFloat(recentPaperCount) + 1) AS momentum
  ORDER BY momentum DESC
  LIMIT $limit

  OPTIONAL MATCH (topic)<-[:HAS_TOPIC]-(recent:Paper)<-[:AUTHORED]-(author:Author)
  WHERE recent.year >= $recentFromYear
  WITH topic, recentPaperCount, priorPaperCount, growthRate, momentum, author, count(recent) AS authored
  ORDER BY momentum DESC, authored DESC
  WITH topic, recentPaperCount, priorPaperCount, growthRate, momentum,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL][0..5] AS topAuthors

  RETURN {
    id: topic.id,
    name: topic.name,
    field: topic.field,
    description: topic.description,
    emergenceYear: topic.emergenceYear,
    paperCount: topic.paperCount,
    recentPaperCount: recentPaperCount,
    priorPaperCount: priorPaperCount,
    growthRate: growthRate,
    momentum: momentum,
    topAuthors: topAuthors
  } AS topic
  ORDER BY topic.momentum DESC
`;

/**
 * Ranks researchers on a topic by blending volume, impact and focus.
 *
 * Focus matters: someone with four papers out of five on a topic is a better
 * expert signal than someone with six out of two hundred. The ratio is computed
 * from two traversals off the same author node in a single query.
 */
export const FIND_EXPERTS_FOR_TOPIC = cypher`
  MATCH (topic:ResearchTopic { id: $topicId })<-[:HAS_TOPIC]-(paper:Paper)<-[:AUTHORED]-(author:Author)
  WITH author,
       count(DISTINCT paper) AS topicPaperCount,
       sum(coalesce(paper.citationCount, 0)) AS topicCitationCount
  WHERE topicPaperCount >= $minPapers

  WITH author, topicPaperCount, topicCitationCount,
       CASE WHEN coalesce(author.paperCount, 0) = 0 THEN 0.0
            ELSE toFloat(topicPaperCount) / toFloat(author.paperCount) END AS focusRatio

  WITH author, topicPaperCount, topicCitationCount, focusRatio,
       toFloat(topicPaperCount) * $paperWeight +
       log(toFloat(topicCitationCount) + 1) * $citationWeight +
       focusRatio * $focusWeight +
       toFloat(coalesce(author.hIndex, 0)) * $hIndexWeight AS expertiseScore
  ORDER BY expertiseScore DESC
  SKIP $offset LIMIT $limit

  // Standing and current activity are enriched after SKIP/LIMIT, so these three
  // expansions run over one page of experts rather than every candidate author.
  OPTIONAL MATCH (author)-[:COLLABORATED_WITH]-(peer:Author)
  WITH author, topicPaperCount, topicCitationCount, focusRatio, expertiseScore,
       count(DISTINCT peer) AS collaboratorCount

  // No direct Author→Project edge exists; membership is inferred through the
  // papers a project includes.
  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)<-[:INCLUDES]-(project:Project)
  WHERE project.status = 'Active'
  // Counted before slicing: the count reports every active project, while the
  // list carries only the handful the UI shows.
  WITH author, topicPaperCount, topicCitationCount, focusRatio, expertiseScore, collaboratorCount,
       [entry IN collect(DISTINCT
          CASE WHEN project IS NULL THEN NULL
               ELSE { id: project.id, title: project.title, status: project.status,
                      startYear: project.startYear, endYear: project.endYear } END
       ) WHERE entry IS NOT NULL] AS allActiveProjects

  OPTIONAL MATCH (author)-[:AFFILIATED_WITH { isPrimary: true }]->(university:University)
  WITH author, topicPaperCount, topicCitationCount, focusRatio, expertiseScore,
       collaboratorCount, allActiveProjects, head(collect(university)) AS home

  // Slicing is kept out of the aggregating WITH above so the grouping key stays
  // a plain variable list.
  WITH author, topicPaperCount, topicCitationCount, focusRatio, expertiseScore,
       collaboratorCount, home,
       size(allActiveProjects) AS activeProjectCount,
       allActiveProjects[0..5] AS activeProjects

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
                      ELSE { id: home.id, name: home.name, country: home.country } END,
    topicPaperCount: topicPaperCount,
    topicCitationCount: topicCitationCount,
    focusRatio: focusRatio,
    expertiseScore: expertiseScore,
    collaboratorCount: collaboratorCount,
    activeProjectCount: activeProjectCount,
    activeProjects: activeProjects
  } AS expert
  ORDER BY expert.expertiseScore DESC
`;
