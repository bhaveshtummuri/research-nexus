import { cypher } from '../database/cypher-tag.js';

/**
 * Explainable recommendation queries.
 *
 * Each blends independent graph signals, aggregated per candidate before merging
 * so every contribution stays visible in the response. That is what lets the API
 * return a reason beside each result rather than an opaque score.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

/**
 * Blends four independent similarity signals into one ranking.
 *
 * Each signal is aggregated per candidate first, then the partial results are
 * unioned and summed. Doing it this way keeps every signal's contribution
 * visible, which is what lets the API return a human-readable reason next to
 * each recommendation instead of an opaque score.
 */
export const RECOMMEND_SIMILAR_PAPERS = cypher`
  MATCH (source:Paper { id: $paperId })

  OPTIONAL MATCH (source)-[:HAS_TOPIC]->(topic:ResearchTopic)<-[:HAS_TOPIC]-(byTopic:Paper)
  WHERE byTopic.id <> source.id
  WITH source, byTopic, count(DISTINCT topic) AS topicOverlap
  WITH source, [entry IN collect(
         CASE WHEN byTopic IS NULL THEN NULL
              ELSE { id: byTopic.id, topics: topicOverlap, keywords: 0, coCited: 0, sharedRefs: 0 } END
       ) WHERE entry IS NOT NULL] AS topicRows

  OPTIONAL MATCH (source)-[:HAS_KEYWORD]->(keyword:Keyword)<-[:HAS_KEYWORD]-(byKeyword:Paper)
  WHERE byKeyword.id <> source.id
  WITH source, topicRows, byKeyword, count(DISTINCT keyword) AS keywordOverlap
  WITH source, topicRows, [entry IN collect(
         CASE WHEN byKeyword IS NULL THEN NULL
              ELSE { id: byKeyword.id, topics: 0, keywords: keywordOverlap, coCited: 0, sharedRefs: 0 } END
       ) WHERE entry IS NOT NULL] AS keywordRows

  // Co-citation: another paper cited by the same works that cite this one.
  OPTIONAL MATCH (source)<-[:CITES]-(citing:Paper)-[:CITES]->(coCited:Paper)
  WHERE coCited.id <> source.id
  WITH source, topicRows, keywordRows, coCited, count(DISTINCT citing) AS coCitationCount
  WITH source, topicRows, keywordRows, [entry IN collect(
         CASE WHEN coCited IS NULL THEN NULL
              ELSE { id: coCited.id, topics: 0, keywords: 0, coCited: coCitationCount, sharedRefs: 0 } END
       ) WHERE entry IS NOT NULL] AS coCitationRows

  // Bibliographic coupling: another paper citing the same references.
  OPTIONAL MATCH (source)-[:CITES]->(reference:Paper)<-[:CITES]-(coupled:Paper)
  WHERE coupled.id <> source.id
  WITH source, topicRows, keywordRows, coCitationRows, coupled, count(DISTINCT reference) AS couplingCount
  WITH source, topicRows, keywordRows, coCitationRows, [entry IN collect(
         CASE WHEN coupled IS NULL THEN NULL
              ELSE { id: coupled.id, topics: 0, keywords: 0, coCited: 0, sharedRefs: couplingCount } END
       ) WHERE entry IS NOT NULL] AS couplingRows

  UNWIND (topicRows + keywordRows + coCitationRows + couplingRows) AS row
  WITH row.id AS candidateId,
       sum(row.topics) AS sharedTopics,
       sum(row.keywords) AS sharedKeywords,
       sum(row.coCited) AS coCitations,
       sum(row.sharedRefs) AS sharedReferences
  WITH candidateId, sharedTopics, sharedKeywords, coCitations, sharedReferences,
       toFloat(sharedTopics) * $topicWeight +
       toFloat(sharedKeywords) * $keywordWeight +
       toFloat(coCitations) * $coCitationWeight +
       toFloat(sharedReferences) * $couplingWeight AS score
  WHERE score > 0
  WITH candidateId, sharedTopics, sharedKeywords, coCitations, sharedReferences, score
  ORDER BY score DESC
  LIMIT $limit

  MATCH (candidate:Paper { id: candidateId })
  OPTIONAL MATCH (author:Author)-[authorship:AUTHORED]->(candidate)
  WITH candidate, sharedTopics, sharedKeywords, coCitations, sharedReferences, score, author, authorship
  ORDER BY score DESC, authorship.position ASC
  WITH candidate, sharedTopics, sharedKeywords, coCitations, sharedReferences, score,
       [entry IN collect(
          CASE WHEN author IS NULL THEN NULL ELSE { id: author.id, name: author.name } END
       ) WHERE entry IS NOT NULL] AS authors

  OPTIONAL MATCH (candidate)-[:HAS_TOPIC]->(candidateTopic:ResearchTopic)
  WITH candidate, sharedTopics, sharedKeywords, coCitations, sharedReferences, score, authors,
       [entry IN collect(
          CASE WHEN candidateTopic IS NULL THEN NULL
               ELSE { id: candidateTopic.id, name: candidateTopic.name, field: candidateTopic.field } END
       ) WHERE entry IS NOT NULL] AS topics

  RETURN {
    id: candidate.id,
    title: candidate.title,
    year: candidate.year,
    doi: candidate.doi,
    citationCount: candidate.citationCount,
    referenceCount: candidate.referenceCount,
    authors: authors,
    topics: topics,
    venue: NULL,
    score: score,
    reasons: [reason IN [
      { kind: 'shared-topic',
        label: toString(sharedTopics) + ' shared topic(s)',
        weight: toFloat(sharedTopics) * $topicWeight },
      { kind: 'shared-keyword',
        label: toString(sharedKeywords) + ' shared keyword(s)',
        weight: toFloat(sharedKeywords) * $keywordWeight },
      { kind: 'co-citation',
        label: 'Co-cited by ' + toString(coCitations) + ' paper(s)',
        weight: toFloat(coCitations) * $coCitationWeight },
      { kind: 'shared-citation',
        label: toString(sharedReferences) + ' shared reference(s)',
        weight: toFloat(sharedReferences) * $couplingWeight }
    ] WHERE reason.weight > 0]
  } AS paper
  ORDER BY paper.score DESC
`;

export const RECOMMEND_PAPERS_FOR_AUTHOR = cypher`
  MATCH (author:Author { id: $authorId })
  OPTIONAL MATCH (author)-[:AUTHORED]->(own:Paper)
  WITH author, collect(DISTINCT own.id) AS ownPaperIds

  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)-[:HAS_TOPIC]->(topic:ResearchTopic)
                 <-[:HAS_TOPIC]-(byTopic:Paper)
  WHERE NOT byTopic.id IN ownPaperIds
  WITH author, ownPaperIds, byTopic, count(DISTINCT topic) AS topicOverlap
  WITH author, ownPaperIds, [entry IN collect(
         CASE WHEN byTopic IS NULL THEN NULL
              ELSE { id: byTopic.id, topics: topicOverlap, collaborators: 0, citations: 0 } END
       ) WHERE entry IS NOT NULL] AS topicRows

  OPTIONAL MATCH (author)-[:COLLABORATED_WITH]-(peer:Author)-[:AUTHORED]->(byPeer:Paper)
  WHERE NOT byPeer.id IN ownPaperIds
  WITH author, ownPaperIds, topicRows, byPeer, count(DISTINCT peer) AS peerCount
  WITH author, ownPaperIds, topicRows, [entry IN collect(
         CASE WHEN byPeer IS NULL THEN NULL
              ELSE { id: byPeer.id, topics: 0, collaborators: peerCount, citations: 0 } END
       ) WHERE entry IS NOT NULL] AS peerRows

  OPTIONAL MATCH (author)-[:AUTHORED]->(:Paper)-[:CITES]->(:Paper)<-[:CITES]-(coupled:Paper)
  WHERE NOT coupled.id IN ownPaperIds
  WITH ownPaperIds, topicRows, peerRows, coupled, count(*) AS couplingCount
  WITH topicRows, peerRows, [entry IN collect(
         CASE WHEN coupled IS NULL THEN NULL
              ELSE { id: coupled.id, topics: 0, collaborators: 0, citations: couplingCount } END
       ) WHERE entry IS NOT NULL] AS couplingRows

  UNWIND (topicRows + peerRows + couplingRows) AS row
  WITH row.id AS candidateId,
       sum(row.topics) AS sharedTopics,
       sum(row.collaborators) AS viaCollaborators,
       sum(row.citations) AS sharedReferences
  WITH candidateId, sharedTopics, viaCollaborators, sharedReferences,
       toFloat(sharedTopics) * $topicWeight +
       toFloat(viaCollaborators) * $collaboratorWeight +
       toFloat(sharedReferences) * $couplingWeight AS score
  WHERE score > 0
  WITH candidateId, sharedTopics, viaCollaborators, sharedReferences, score
  ORDER BY score DESC
  LIMIT $limit

  MATCH (candidate:Paper { id: candidateId })
  OPTIONAL MATCH (candidateAuthor:Author)-[authorship:AUTHORED]->(candidate)
  WITH candidate, sharedTopics, viaCollaborators, sharedReferences, score, candidateAuthor, authorship
  ORDER BY score DESC, authorship.position ASC
  WITH candidate, sharedTopics, viaCollaborators, sharedReferences, score,
       [entry IN collect(
          CASE WHEN candidateAuthor IS NULL THEN NULL
               ELSE { id: candidateAuthor.id, name: candidateAuthor.name } END
       ) WHERE entry IS NOT NULL] AS authors

  RETURN {
    id: candidate.id,
    title: candidate.title,
    year: candidate.year,
    doi: candidate.doi,
    citationCount: candidate.citationCount,
    referenceCount: candidate.referenceCount,
    authors: authors,
    topics: [],
    venue: NULL,
    score: score,
    reasons: [reason IN [
      { kind: 'shared-topic',
        label: toString(sharedTopics) + ' topic(s) you publish in',
        weight: toFloat(sharedTopics) * $topicWeight },
      { kind: 'shared-collaborator',
        label: 'Written by ' + toString(viaCollaborators) + ' of your collaborators',
        weight: toFloat(viaCollaborators) * $collaboratorWeight },
      { kind: 'shared-citation',
        label: toString(sharedReferences) + ' reference(s) in common with your work',
        weight: toFloat(sharedReferences) * $couplingWeight }
    ] WHERE reason.weight > 0]
  } AS paper
  ORDER BY paper.score DESC
`;
