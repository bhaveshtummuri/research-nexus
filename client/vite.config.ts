import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..');

export default defineConfig(({ mode }) => {
  // Environment is read from the repository root so one `.env` drives the
  // server, the seed CLI and the dev proxy.
  const env = loadEnv(mode, repoRoot, ['VITE_', 'PORT', 'API_PREFIX']);
  const apiPrefix = env.API_PREFIX ?? '/api/v1';
  const serverPort = env.PORT ?? '4000';

  return {
    plugins: [react()],
    envDir: repoRoot,
    resolve: {
      alias: { '@': path.resolve(currentDir, 'src') },
    },
    server: {
      port: 5173,
      strictPort: false,
      // Proxying in development keeps requests same-origin, so CORS and cookie
      // behaviour match production without extra configuration.
      proxy: {
        [apiPrefix]: {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: { port: 4173 },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          // Splitting the heavy, rarely-changing libraries into their own chunks
          // keeps the main bundle small and cacheable across deploys.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            charts: ['recharts'],
            graph: ['d3-force'],
            motion: ['framer-motion'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
