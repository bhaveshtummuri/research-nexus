import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildGraph, summariseGraph } from './build.js';
import { ENTITY_COUNTS, repoRoot, schemaDirectory, seedEnv, validationDirectory } from './config/index.js';
import { closeDriver, read, splitStatements, verifyConnection, write } from './utils/db.js';
import { applyDerivations } from './derive.js';
import type { GeneratedGraph } from './types.js';
import { writeEdges, writeNodes } from './utils/writer.js';

const COMMANDS = ['schema', 'seed', 'reset', 'stats', 'validate', 'sample'] as const;
type Command = (typeof COMMANDS)[number];

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function step(message: string): void {
  log(`\u001b[36m›\u001b[0m ${message}`);
}

function done(message: string): void {
  log(`\u001b[32m✓\u001b[0m ${message}`);
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

/**
 * Applies every `.cypher` file in `database/schema` in filename order.
 *
 * The optional full-text file is skipped unless `--with-fulltext` is passed, and
 * failures inside it are tolerated so the command still succeeds on engines
 * without full-text support.
 */
async function applySchema(withFulltext: boolean): Promise<void> {
  const files = (await readdir(schemaDirectory))
    .filter((file) => file.endsWith('.cypher'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const optional = file.includes('optional');
    if (optional && !withFulltext) {
      log(`  skipping ${file} (pass --with-fulltext to apply)`);
      continue;
    }

    const source = await readFile(path.join(schemaDirectory, file), 'utf8');
    const statements = splitStatements(source);
    step(`${file} — ${statements.length} statements`);

    let applied = 0;
    for (const statement of statements) {
      try {
        await write(statement);
        applied += 1;
      } catch (error) {
        if (!optional) throw error;
        log(`  skipped an unsupported optional statement: ${errorMessage(error)}`);
      }
    }
    done(`${file} applied (${applied}/${statements.length})`);
  }
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seedDatabase(options: { reset: boolean; withSchema: boolean }): Promise<void> {
  // Optional reset and schema application, so a full rebuild is one command.
  if (options.reset) {
    await resetDatabase();
  }
  if (options.withSchema) {
    await applySchema(false);
  }

  step(`Generating graph with seed "${seedEnv.SEED_RANDOM_SEED}"`);
  const startedAt = Date.now();
  const graph = buildGraph();
  const summary = summariseGraph(graph);
  done(
    `Generated ${formatNumber(summary.nodeTotal)} nodes and ` +
      `${formatNumber(summary.edgeTotal)} relationships in ${Date.now() - startedAt}ms`,
  );

  step('Writing nodes');
  await writeAllNodes(graph);

  step('Writing relationships');
  await writeAllEdges(graph);

  step('Deriving graph metrics');
  await applyDerivations((label, index, total) => log(`  [${index}/${total}] ${label}`));

  done(`Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  await printStats();
}

async function writeAllNodes(graph: GeneratedGraph): Promise<void> {
  const groups: Array<[string, readonly object[]]> = [
    ['University', graph.universities],
    ['ResearchTopic', graph.topics],
    ['Keyword', graph.keywords],
    ['Conference', graph.conferences],
    ['Journal', graph.journals],
    ['Dataset', graph.datasets],
    ['FundingAgency', graph.fundingAgencies],
    ['Project', graph.projects],
    ['Author', graph.authors],
    ['Paper', graph.papers],
  ];

  for (const [label, rows] of groups) {
    const written = await writeNodes(label, rows);
    log(`  ${label.padEnd(16)} ${formatNumber(written).padStart(6)}`);
  }
}

async function writeAllEdges(graph: GeneratedGraph): Promise<void> {
  const groups: Array<{
    spec: { type: string; fromLabel: string; toLabel: string };
    rows: readonly { from: string; to: string; props: Record<string, unknown> }[];
  }> = [
    { spec: { type: 'AFFILIATED_WITH', fromLabel: 'Author', toLabel: 'University' }, rows: graph.affiliatedWith },
    { spec: { type: 'AUTHORED', fromLabel: 'Author', toLabel: 'Paper' }, rows: graph.authored },
    { spec: { type: 'CITES', fromLabel: 'Paper', toLabel: 'Paper' }, rows: graph.cites },
    { spec: { type: 'HAS_TOPIC', fromLabel: 'Paper', toLabel: 'ResearchTopic' }, rows: graph.paperTopics },
    { spec: { type: 'HAS_TOPIC', fromLabel: 'Conference', toLabel: 'ResearchTopic' }, rows: graph.venueTopics.conferences },
    { spec: { type: 'HAS_TOPIC', fromLabel: 'Journal', toLabel: 'ResearchTopic' }, rows: graph.venueTopics.journals },
    { spec: { type: 'HAS_TOPIC', fromLabel: 'Dataset', toLabel: 'ResearchTopic' }, rows: graph.datasetTopics },
    { spec: { type: 'HAS_TOPIC', fromLabel: 'Project', toLabel: 'ResearchTopic' }, rows: graph.projectTopics },
    { spec: { type: 'HAS_KEYWORD', fromLabel: 'Paper', toLabel: 'Keyword' }, rows: graph.paperKeywords },
    { spec: { type: 'PUBLISHED_IN', fromLabel: 'Paper', toLabel: 'Journal' }, rows: graph.publishedIn },
    { spec: { type: 'PRESENTED_AT', fromLabel: 'Paper', toLabel: 'Conference' }, rows: graph.presentedAt },
    { spec: { type: 'USES_DATASET', fromLabel: 'Paper', toLabel: 'Dataset' }, rows: graph.usesDataset },
    { spec: { type: 'INCLUDES', fromLabel: 'Project', toLabel: 'Paper' }, rows: graph.paperProjects },
    { spec: { type: 'FUNDS', fromLabel: 'FundingAgency', toLabel: 'Project' }, rows: graph.fundedBy },
    { spec: { type: 'RELATED_TO', fromLabel: 'ResearchTopic', toLabel: 'ResearchTopic' }, rows: graph.relatedTopics },
    { spec: { type: 'RELATED_TO', fromLabel: 'Keyword', toLabel: 'Keyword' }, rows: graph.relatedKeywords },
    { spec: { type: 'PARTNERS_WITH', fromLabel: 'University', toLabel: 'University' }, rows: graph.partnersWith },
  ];

  for (const group of groups) {
    const written = await writeEdges(group.spec, group.rows);
    const label = `${group.spec.type} (${group.spec.fromLabel}→${group.spec.toLabel})`;
    log(`  ${label.padEnd(46)} ${formatNumber(written).padStart(6)}`);
  }
}

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

/**
 * Deletes the graph in bounded batches.
 *
 * A single `MATCH (n) DETACH DELETE n` would build one enormous transaction;
 * looping over a `LIMIT`ed batch keeps memory flat and works on instances with
 * conservative transaction limits.
 */
async function resetDatabase(): Promise<void> {
  step('Deleting all nodes and relationships');
  const batchSize = 5_000;
  let removed = 0;

  for (;;) {
    const result = await write(
      `
        MATCH (n)
        WITH n LIMIT $batchSize
        DETACH DELETE n
        RETURN count(n) AS deleted
      `,
      { batchSize },
    );
    const deleted = result.records[0]?.get('deleted');
    const count = typeof deleted === 'number' ? deleted : Number(deleted ?? 0);
    if (count === 0) break;
    removed += count;
    log(`  removed ${formatNumber(removed)} nodes`);
  }

  done(`Database cleared (${formatNumber(removed)} nodes removed)`);
}

// ---------------------------------------------------------------------------
// sample
// ---------------------------------------------------------------------------

/**
 * Writes a small, human-readable slice of the generated graph to disk.
 *
 * Useful for reviewing the data without a database, and for attaching a concrete
 * example to documentation. Generation is pure, so this never connects to
 * CognoDB.
 */
async function exportSample(): Promise<void> {
  const graph = buildGraph();
  const summary = summariseGraph(graph);

  const sample = {
    generatedWith: { seed: seedEnv.SEED_RANDOM_SEED, counts: ENTITY_COUNTS },
    totals: { nodes: summary.nodeTotal, relationships: summary.edgeTotal },
    breakdown: { nodes: summary.nodes, relationships: summary.edges },
    nodes: {
      authors: graph.authors.slice(0, 3),
      papers: graph.papers.slice(0, 2),
      universities: graph.universities.slice(0, 2),
      topics: graph.topics.slice(0, 2),
      keywords: graph.keywords.slice(0, 3),
      conferences: graph.conferences.slice(0, 2),
      journals: graph.journals.slice(0, 2),
      datasets: graph.datasets.slice(0, 2),
      projects: graph.projects.slice(0, 2),
      fundingAgencies: graph.fundingAgencies.slice(0, 2),
    },
    relationships: {
      authored: graph.authored.slice(0, 3),
      cites: graph.cites.slice(0, 3),
      affiliatedWith: graph.affiliatedWith.slice(0, 2),
      hasTopic: graph.paperTopics.slice(0, 2),
      hasKeyword: graph.paperKeywords.slice(0, 2),
      usesDataset: graph.usesDataset.slice(0, 2),
      presentedAt: graph.presentedAt.slice(0, 2),
      publishedIn: graph.publishedIn.slice(0, 2),
      includes: graph.paperProjects.slice(0, 2),
      funds: graph.fundedBy.slice(0, 2),
      relatedKeywords: graph.relatedKeywords.slice(0, 2),
      relatedTopics: graph.relatedTopics.slice(0, 2),
      partnersWith: graph.partnersWith.slice(0, 2),
    },
  };

  const target = path.join(repoRoot, 'seed', 'sample-dataset.json');
  await writeFile(target, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
  done(`Sample written to seed/sample-dataset.json`);
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

/**
 * Runs every check in `database/validation` and prints a pass/fail table.
 *
 * Each statement returns a `check` and a `status` column, so this runner never
 * needs to know what an individual check means. Exits non-zero on any failure,
 * which lets it gate a deployment or a CI merge.
 */
async function validateGraph(): Promise<boolean> {
  const files = (await readdir(validationDirectory))
    .filter((file) => file.endsWith('.cypher'))
    .sort((a, b) => a.localeCompare(b));

  let failures = 0;
  let passes = 0;

  for (const file of files) {
    const optional = file.includes('schema-objects');
    const source = await readFile(path.join(validationDirectory, file), 'utf8');
    const statements = splitStatements(source);
    step(`${file} — ${statements.length} checks`);

    for (const statement of statements) {
      try {
        const result = await read(statement);

        // A check that returns no rows found nothing wrong. Only the duplicate
        // detectors are written that way, and silence from them is a pass.
        if (result.records.length === 0) continue;

        for (const record of result.records) {
          const keys = record.keys.map(String);
          if (!keys.includes('check')) continue;

          const name = String(record.get('check'));
          const status = keys.includes('status') ? String(record.get('status')) : 'PASS';
          const context = keys
            .filter((key) => key !== 'check' && key !== 'status')
            .map((key) => `${key}=${formatCell(record.get(key))}`)
            .join(' ');

          if (status === 'PASS') {
            passes += 1;
            log(`  \u001b[32m✓\u001b[0m ${name.padEnd(34)} \u001b[90m${context}\u001b[0m`);
          } else {
            failures += 1;
            log(`  \u001b[31m✗\u001b[0m ${name.padEnd(34)} ${context}`);
          }
        }
      } catch (error) {
        if (optional) {
          log(`  skipped an unsupported check: ${errorMessage(error)}`);
          continue;
        }
        throw error;
      }
    }
  }

  log('');
  if (failures === 0) {
    done(`All ${passes} checks passed`);
    return true;
  }
  log(`\u001b[31m✗\u001b[0m ${failures} check(s) failed, ${passes} passed`);
  return false;
}

/** Compact rendering for whatever a check chose to return as context. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.slice(0, 3).map(formatCell).join(', ')}${value.length > 3 ? ', …' : ''}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('low' in record && 'high' in record) return String(Number(record.low));
    return JSON.stringify(value).slice(0, 60);
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

async function printStats(): Promise<void> {
  const labels = [
    'Author',
    'Paper',
    'University',
    'ResearchTopic',
    'Keyword',
    'Conference',
    'Journal',
    'Dataset',
    'FundingAgency',
    'Project',
  ];

  log('\nNodes in CognoDB');
  for (const label of labels) {
    const result = await read(
      `MATCH (n) WHERE $label IN labels(n) RETURN count(n) AS total`,
      { label },
    );
    const total = Number(result.records[0]?.get('total') ?? 0);
    log(`  ${label.padEnd(16)} ${formatNumber(total).padStart(7)}`);
  }

  const relationships = await read(
    `MATCH ()-[rel]->() RETURN type(rel) AS type, count(rel) AS total ORDER BY total DESC`,
  );
  log('\nRelationships in CognoDB');
  let edgeTotal = 0;
  for (const record of relationships.records) {
    const total = Number(record.get('total'));
    edgeTotal += total;
    log(`  ${String(record.get('type')).padEnd(20)} ${formatNumber(total).padStart(7)}`);
  }
  log(`  ${'TOTAL'.padEnd(20)} ${formatNumber(edgeTotal).padStart(7)}\n`);
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usage(): string {
  return [
    'Usage: npm run <command> --workspace seed',
    '',
    'Commands:',
    '  schema [--with-fulltext]  Apply constraints and indexes from database/schema',
    '  seed [--reset] [--with-schema]',
    '                            Generate and load the demo graph',
    '  reset                     Delete every node and relationship',
    '  stats                     Print node and relationship counts',
    '  validate                  Run graph integrity checks',
    '  sample                    Write a sample slice to seed/sample-dataset.json',
    '',
    `Target: ${seedEnv.COGNODB_URI}`,
    `Dataset: ${Object.entries(ENTITY_COUNTS)
      .map(([key, value]) => `${value} ${key}`)
      .join(', ')}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const [rawCommand, ...flags] = process.argv.slice(2);
  const command = rawCommand as Command | undefined;

  if (!command || !COMMANDS.includes(command)) {
    log(usage());
    process.exitCode = command ? 1 : 0;
    return;
  }

  if (command !== 'sample') {
    await verifyConnection();
  }

  switch (command) {
    case 'schema':
      await applySchema(flags.includes('--with-fulltext'));
      break;
    case 'seed':
      await seedDatabase({
        reset: flags.includes('--reset'),
        withSchema: flags.includes('--with-schema'),
      });
      break;
    case 'reset':
      await resetDatabase();
      break;
    case 'stats':
      await printStats();
      break;
    case 'sample':
      await exportSample();
      return;
    case 'validate': {
      const ok = await validateGraph();
      if (!ok) process.exitCode = 1;
      break;
    }
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`\u001b[31m✗\u001b[0m ${errorMessage(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDriver();
  });
