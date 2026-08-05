/**
 * Repository barrel.
 *
 * Namespaced re-exports keep call sites explicit at the point of use -
 * `authorRepository.findById(id)` says more than a bare `findById(id)`.
 */
export * as authorRepository from './author.repository.js';
export * as paperRepository from './paper.repository.js';
