/**
 * Service layer.
 *
 * Namespaced exports keep call sites explicit: `authorService.getAuthor(id)`
 * says more than a bare `getAuthor(id)`. Controllers import from here.
 */
export * as authorService from './author.service.js';
export * as paperService from './paper.service.js';
export * as universityService from './university.service.js';
export * as topicService from './topic.service.js';
export * as venueService from './venue.service.js';
export * as fundingService from './funding.service.js';
export * as searchService from './search.service.js';
export * as recommendationService from './discovery.service.js';
export * as collaborationService from './discovery.service.js';
export * as citationService from './path.service.js';
export * as pathService from './path.service.js';
export * as graphService from './graph.service.js';
export * as analyticsService from './analytics.service.js';
export type { ListResult } from './types.js';
