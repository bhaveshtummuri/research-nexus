import { seedEnv } from './config/index.js';
import { generateAuthors } from './authors/generator.js';
import { generateConferences } from './conferences/generator.js';
import { generateDatasets } from './datasets/generator.js';
import { generateFundingAgencies } from './funding/generator.js';
import { generateJournals } from './journals/generator.js';
import { generateKeywords } from './keywords/generator.js';
import { generatePapers } from './papers/generator.js';
import { generateProjects } from './projects/generator.js';
import { generateTopics } from './topics/generator.js';
import { generateUniversities } from './universities/generator.js';
import { generateRelationships } from './relationships/index.js';
import { Random } from './utils/random.js';
import type { GeneratedGraph } from './types.js';

/**
 * Builds the entire graph in memory.
 *
 * Generation is deliberately separated from writing: the pipeline is pure and
 * deterministic, so it can be unit-tested and inspected without a database, and
 * the writer stays a thin batching layer.
 */
export function buildGraph(seed: string = seedEnv.SEED_RANDOM_SEED): GeneratedGraph {
  const random = new Random(seed);

  const universities = generateUniversities();
  const topics = generateTopics(random);
  const keywords = generateKeywords();
  const conferences = generateConferences();
  const journals = generateJournals();
  const datasets = generateDatasets();
  const fundingAgencies = generateFundingAgencies();

  const { authors, homeUniversityId, fieldByAuthorId } = generateAuthors(
    random,
    universities,
    topics,
  );
  const { papers, anchorTopicByPaperId } = generatePapers(random, topics);
  const { projects, anchorTopicByProjectId } = generateProjects(random, topics);

  const relationships = generateRelationships({
    random,
    authors,
    papers,
    universities,
    topics,
    keywords,
    conferences,
    journals,
    datasets,
    fundingAgencies,
    projects,
    anchorTopicByPaperId,
    anchorTopicByProjectId,
    homeUniversityId,
    fieldByAuthorId,
  });

  return {
    authors,
    papers,
    universities,
    topics,
    keywords,
    conferences,
    journals,
    datasets,
    fundingAgencies,
    projects,

    authored: relationships.authored,
    cites: relationships.cites,
    affiliatedWith: relationships.affiliatedWith,
    paperTopics: relationships.paperTopics,
    venueTopics: {
      conferences: relationships.conferenceTopics,
      journals: relationships.journalTopics,
    },
    projectTopics: relationships.projectTopics,
    datasetTopics: relationships.datasetTopics,
    paperKeywords: relationships.paperKeywords,
    publishedIn: relationships.publishedIn,
    presentedAt: relationships.presentedAt,
    usesDataset: relationships.usesDataset,
    fundedBy: relationships.fundedBy,
    relatedTopics: relationships.relatedTopics,
    relatedKeywords: relationships.relatedKeywords,
    paperProjects: relationships.paperProjects,
    partnersWith: relationships.partnersWith,
  };
}

/** Node and edge totals, used by the CLI summary and by the generator tests. */
export function summariseGraph(graph: GeneratedGraph): {
  nodes: Array<{ label: string; count: number }>;
  edges: Array<{ type: string; count: number }>;
  nodeTotal: number;
  edgeTotal: number;
} {
  const nodes = [
    { label: 'Author', count: graph.authors.length },
    { label: 'Paper', count: graph.papers.length },
    { label: 'University', count: graph.universities.length },
    { label: 'ResearchTopic', count: graph.topics.length },
    { label: 'Keyword', count: graph.keywords.length },
    { label: 'Conference', count: graph.conferences.length },
    { label: 'Journal', count: graph.journals.length },
    { label: 'Dataset', count: graph.datasets.length },
    { label: 'FundingAgency', count: graph.fundingAgencies.length },
    { label: 'Project', count: graph.projects.length },
  ];

  const edges = [
    { type: 'AUTHORED', count: graph.authored.length },
    { type: 'CITES', count: graph.cites.length },
    { type: 'AFFILIATED_WITH', count: graph.affiliatedWith.length },
    {
      type: 'HAS_TOPIC',
      count:
        graph.paperTopics.length +
        graph.venueTopics.conferences.length +
        graph.venueTopics.journals.length +
        graph.projectTopics.length +
        graph.datasetTopics.length,
    },
    { type: 'HAS_KEYWORD', count: graph.paperKeywords.length },
    { type: 'PUBLISHED_IN', count: graph.publishedIn.length },
    { type: 'PRESENTED_AT', count: graph.presentedAt.length },
    { type: 'USES_DATASET', count: graph.usesDataset.length },
    { type: 'FUNDS', count: graph.fundedBy.length },
    { type: 'RELATED_TO', count: graph.relatedTopics.length + graph.relatedKeywords.length },
    {
      type: 'INCLUDES',
      count: graph.paperProjects.length,
    },
    { type: 'PARTNERS_WITH', count: graph.partnersWith.length },
  ];

  return {
    nodes,
    edges,
    nodeTotal: nodes.reduce((total, entry) => total + entry.count, 0),
    edgeTotal: edges.reduce((total, entry) => total + entry.count, 0),
  };
}
