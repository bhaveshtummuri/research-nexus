/**
 * API layer.
 *
 * The only place in the client that talks HTTP. Hooks in `hooks/` wrap these
 * with caching; components never call them directly.
 *
 * Split from `hooks/` on purpose: services know *how to call the API*, hooks
 * know *how to cache it*. Keeping them apart means this layer is testable
 * without React, and swapping TanStack Query touches one folder.
 */
export * as authorService from './author.service';
export * as paperService from './paper.service';
export * as graphService from './graph.service';
export * as searchService from './search.service';
export { httpClient } from './http-client';
