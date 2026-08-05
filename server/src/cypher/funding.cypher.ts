import { cypher } from '../database/cypher-tag.js';

/**
 * Funding agency queries, including portfolio similarity.
 *
 * Every statement is parameterised, bounded and index-backed. The `cypher` tag
 * refuses interpolation, so no runtime value can reach the query text.
 */

export const LIST_FUNDING_AGENCIES = cypher`
  MATCH (agency:FundingAgency)
  WHERE ($search IS NULL OR agency.searchText CONTAINS $search)
    AND ($country IS NULL OR agency.country = $country)
    AND ($type IS NULL OR agency.type = $type)
  OPTIONAL MATCH (project:Project)<-[grant:FUNDS]-(agency)
  WITH agency, count(project) AS projectCount, sum(coalesce(grant.amountUsd, 0)) AS totalAwardedUsd
  ORDER BY
    CASE $sort WHEN 'budget' THEN toFloat(agency.annualBudgetUsd)
               WHEN 'projects' THEN toFloat(projectCount)
               ELSE toFloat(totalAwardedUsd) END DESC,
    agency.name ASC
  SKIP $offset LIMIT $limit
  RETURN {
    id: agency.id,
    name: agency.name,
    country: agency.country,
    type: agency.type,
    annualBudgetUsd: agency.annualBudgetUsd,
    projectCount: projectCount,
    totalAwardedUsd: totalAwardedUsd
  } AS agency
`;

export const COUNT_FUNDING_AGENCIES = cypher`
  MATCH (agency:FundingAgency)
  WHERE ($search IS NULL OR agency.searchText CONTAINS $search)
    AND ($country IS NULL OR agency.country = $country)
    AND ($type IS NULL OR agency.type = $type)
  RETURN count(agency) AS total
`;

export const GET_FUNDING_AGENCY_DETAIL = cypher`
  MATCH (agency:FundingAgency { id: $id })

  OPTIONAL MATCH (project:Project)<-[grant:FUNDS]-(agency)
  WITH agency, project, grant
  ORDER BY grant.amountUsd DESC
  WITH agency,
       count(project) AS projectCount,
       sum(coalesce(grant.amountUsd, 0)) AS totalAwardedUsd,
       [entry IN collect(
          CASE WHEN project IS NULL THEN NULL ELSE {
            id: project.id, title: project.title, summary: project.summary,
            status: project.status, startYear: project.startYear, endYear: project.endYear,
            budgetUsd: project.budgetUsd, awardedUsd: grant.amountUsd, grantNumber: grant.grantNumber
          } END
       ) WHERE entry IS NOT NULL][0..20] AS projects

  OPTIONAL MATCH (:Project)<-[:FUNDS]-(agency)
  WITH agency, projectCount, totalAwardedUsd, projects
  OPTIONAL MATCH (funded:Project)<-[:FUNDS]-(agency)
  OPTIONAL MATCH (funded)-[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH agency, projectCount, totalAwardedUsd, projects, topic, count(DISTINCT funded) AS topicProjects
  ORDER BY topicProjects DESC
  WITH agency, projectCount, totalAwardedUsd, projects,
       [entry IN collect(
          CASE WHEN topic IS NULL THEN NULL
               ELSE { id: topic.id, name: topic.name, field: topic.field, paperCount: topicProjects } END
       ) WHERE entry IS NOT NULL][0..10] AS topTopics

  RETURN {
    id: agency.id,
    name: agency.name,
    country: agency.country,
    type: agency.type,
    annualBudgetUsd: agency.annualBudgetUsd,
    website: agency.website,
    projectCount: projectCount,
    totalAwardedUsd: totalAwardedUsd,
    projects: projects,
    topTopics: topTopics,
    partnerAgencies: []
  } AS agency
`;

export const FIND_SIMILAR_FUNDING_AGENCIES = cypher`
  MATCH (source:FundingAgency { id: $agencyId })-[:FUNDS]->(:Project)
        -[:HAS_TOPIC]->(topic:ResearchTopic)
  WITH source, collect(DISTINCT topic) AS sourceTopics
  WITH source, sourceTopics, size(sourceTopics) AS sourceSize
  WHERE sourceSize > 0

  UNWIND sourceTopics AS sharedTopic
  MATCH (sharedTopic)<-[:HAS_TOPIC]-(project:Project)<-[grant:FUNDS]-(other:FundingAgency)
  WHERE other.id <> source.id
  WITH source, sourceSize, other,
       collect(DISTINCT { id: sharedTopic.id, name: sharedTopic.name, field: sharedTopic.field }) AS sharedTopics,
       sum(coalesce(grant.amountUsd, 0)) AS combinedAwardUsd
  WITH source, sourceSize, other, sharedTopics, size(sharedTopics) AS sharedCount, combinedAwardUsd

  MATCH (other)-[:FUNDS]->(:Project)-[:HAS_TOPIC]->(otherTopic:ResearchTopic)
  WITH source, sourceSize, other, sharedTopics, sharedCount, combinedAwardUsd,
       count(DISTINCT otherTopic) AS otherSize
  WITH other, sharedTopics, sharedCount, combinedAwardUsd,
       toFloat(sharedCount) / toFloat(sourceSize + otherSize - sharedCount) AS similarity
  WHERE sharedCount >= $minSharedTopics
  WITH other, sharedTopics, sharedCount, combinedAwardUsd, similarity
  ORDER BY similarity DESC, sharedCount DESC
  LIMIT $limit

  OPTIONAL MATCH (funded:Project)<-[award:FUNDS]-(other)
  WITH other, sharedTopics, sharedCount, combinedAwardUsd, similarity,
       count(funded) AS projectCount, sum(coalesce(award.amountUsd, 0)) AS totalAwardedUsd

  RETURN {
    agency: {
      id: other.id, name: other.name, country: other.country, type: other.type,
      annualBudgetUsd: other.annualBudgetUsd,
      projectCount: projectCount, totalAwardedUsd: totalAwardedUsd
    },
    sharedTopicCount: sharedCount,
    similarity: similarity,
    sharedTopics: sharedTopics[0..8],
    combinedAwardUsd: combinedAwardUsd
  } AS row
`;
