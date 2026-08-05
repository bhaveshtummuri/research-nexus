/**
 * Research project vocabulary.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

/** Building blocks for research project titles and summaries. */
export const PROJECT_PREFIXES = [
  'Consortium for',
  'National Initiative on',
  'Centre of Excellence in',
  'Collaborative Programme for',
  'Frontier Lab for',
  'Joint Task Force on',
  'Strategic Network for',
  'Open Platform for',
] as const;

export const PROJECT_QUALIFIERS = [
  'Trustworthy',
  'Scalable',
  'Sustainable',
  'Next-Generation',
  'Open',
  'Resilient',
  'Interpretable',
  'Energy-Efficient',
  'Equitable',
  'Verifiable',
] as const;

export const PROJECT_STATUSES = ['Active', 'Active', 'Active', 'Completed', 'Planned'] as const;

export const GRANT_PREFIXES = ['GA', 'RN', 'ERC', 'NSF', 'RGP', 'HZE', 'JSP'] as const;

export const PROJECT_SUMMARIES = [
  'Coordinates {count} partner institutions to build shared infrastructure for {topic}.',
  'Delivers open reference implementations and evaluation harnesses for {topic}.',
  'Runs multi-site studies that establish reproducible baselines in {topic}.',
  'Trains early-career researchers while advancing methodology in {topic}.',
  'Translates laboratory results in {topic} into deployable public-sector tooling.',
  'Builds a federated data platform that makes {topic} research possible without moving sensitive data.',
] as const;
