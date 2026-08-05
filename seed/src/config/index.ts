import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(currentDir, '../../..');

for (const candidate of [path.join(repoRoot, '.env'), path.resolve(currentDir, '../.env')]) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate, override: true });
  }
}

const envSchema = z.object({
  COGNODB_URI: z.string().min(1).default('bolt://localhost:7687'),
  COGNODB_USERNAME: z.string().min(1).default('neo4j'),
  COGNODB_PASSWORD: z.string().min(1).default('research-nexus'),
  COGNODB_DATABASE: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? value.trim() : undefined)),
  COGNODB_ENCRYPTED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  COGNODB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30_000),
  SEED_RANDOM_SEED: z.string().min(1).default('research-nexus-2024'),
  SEED_BATCH_SIZE: z.coerce.number().int().min(50).max(5000).default(500),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid seed environment:\n${issues}`);
}

export const seedEnv = parsed.data;

export const schemaDirectory = path.join(repoRoot, 'database', 'schema');
export const validationDirectory = path.join(repoRoot, 'database', 'validation');

/**
 * Target cardinalities for the generated graph.
 *
 * These are the numbers the brief calls for. They are collected here rather
 * than scattered through the generators so the dataset can be scaled up or down
 * from one place - useful when demoing traversal performance on a larger graph.
 */
export const ENTITY_COUNTS = {
  authors: 300,
  papers: 600,
  universities: 50,
  topics: 100,
  keywords: 150,
  conferences: 40,
  journals: 30,
  datasets: 40,
  fundingAgencies: 25,
  projects: 80,
} as const;

/**
 * Tuning knobs for relationship density. Together these produce roughly 13,000
 * edges, which is dense enough for multi-hop traversals to return interesting
 * results and sparse enough to seed in a few seconds.
 */
export const RELATIONSHIP_TUNING = {
  /** Papers span this window; recency skew makes trend analysis meaningful. */
  earliestPaperYear: 2015,
  latestPaperYear: 2024,
  authorsPerPaper: { min: 1, max: 7, typical: 3 },
  topicsPerPaper: { min: 1, max: 4 },
  keywordsPerPaper: { min: 3, max: 6 },
  referencesPerPaper: { min: 0, max: 12 },
  datasetsPerPaper: { min: 0, max: 3 },
  /** Probability an author lists a second, secondary affiliation. */
  secondaryAffiliationProbability: 0.18,
  /** Probability a paper is attached to a funded project. */
  paperProjectProbability: 0.55,
  membersPerProject: { min: 3, max: 9 },
  fundersPerProject: { min: 1, max: 3 },
  topicsPerProject: { min: 1, max: 3 },
  relatedTopicsPerTopic: { min: 2, max: 5 },
  /** Share of RELATED_TO edges that deliberately cross field boundaries. */
  crossFieldTopicShare: 0.3,
  partnershipsPerUniversity: { min: 1, max: 5 },
  topicsPerVenue: { min: 2, max: 5 },
  topicsPerDataset: { min: 1, max: 3 },
} as const;
