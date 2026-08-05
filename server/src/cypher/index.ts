/**
 * Cypher query modules, grouped by feature.
 *
 * A statement lives in the module named for the *question it answers*, not for
 * the labels it touches — `FIND_SIMILAR_UNIVERSITIES` is a university query even
 * though it traverses authors, papers and topics to get there.
 */
export * from './authors.cypher.js';
export * from './papers.cypher.js';
export * from './universities.cypher.js';
export * from './topics.cypher.js';
export * from './keywords.cypher.js';
export * from './conferences.cypher.js';
export * from './journals.cypher.js';
export * from './datasets.cypher.js';
export * from './projects.cypher.js';
export * from './funding.cypher.js';
export * from './recommendations.cypher.js';
export * from './collaboration.cypher.js';
export * from './citations.cypher.js';
export * from './analytics.cypher.js';
export * from './search.cypher.js';
export * from './graph.cypher.js';
