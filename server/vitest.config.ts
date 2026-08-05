import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The '@' alias mirrors tsconfig paths. tsc leaves them unrewritten under
  // NodeNext, so 'tsc-alias' resolves them at build time and this mapping keeps
  // the test runner in step.
  resolve: {
    alias: { '@': path.resolve(currentDir, 'src') },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Integration specs talk to a real CognoDB instance and skip themselves
    // when one is not reachable, so they need room to attempt a connection.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
