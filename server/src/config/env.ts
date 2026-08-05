import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Environment files are resolved from the repository root first so that a
 * single `.env` powers the server, the seed CLI and the Vite dev proxy. A
 * package-local `server/.env` still wins when present, which is what platform
 * deployments (Render, Railway, Fly) tend to produce.
 */
function loadEnvFiles(): void {
  const repoRoot = path.resolve(currentDir, '../../..');
  const packageRoot = path.resolve(currentDir, '../..');

  for (const candidate of [path.join(repoRoot, '.env'), path.join(packageRoot, '.env')]) {
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate, override: true });
    }
  }
}

loadEnvFiles();

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  API_PREFIX: z
    .string()
    .default('/api/v1')
    .refine((value) => value.startsWith('/'), 'API_PREFIX must start with "/"'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),

  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csv),

  COGNODB_URI: z.string().min(1, 'COGNODB_URI is required').default('bolt://localhost:7687'),
  COGNODB_USERNAME: z.string().min(1).default('neo4j'),
  COGNODB_PASSWORD: z.string().min(1).default('research-nexus'),
  COGNODB_DATABASE: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined)),
  COGNODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(1000).default(50),
  COGNODB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15_000),
  COGNODB_MAX_TRANSACTION_RETRY_MS: z.coerce.number().int().min(0).default(15_000),
  COGNODB_ENCRYPTED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(300),

  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  MAX_GRAPH_NODES: z.coerce.number().int().min(10).max(2000).default(400),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
