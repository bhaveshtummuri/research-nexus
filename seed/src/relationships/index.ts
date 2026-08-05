import { RELATIONSHIP_TUNING } from '../config/index.js';
import { AFFILIATION_ROLES } from '../authors/data.js';
import { DATASET_USAGE_TYPES } from '../datasets/data.js';
import { GRANT_PREFIXES } from '../projects/data.js';
import { CONFERENCE_TRACKS } from '../conferences/data.js';
import { PARTNERSHIP_FOCUS_AREAS } from '../universities/data.js';
import type { Random } from '../utils/random.js';
import type {
  AffiliatedEdge,
  AuthorRow,
  AuthoredEdge,
  CitesEdge,
  ConferenceRow,
  DatasetRow,
  FundedByEdge,
  FundingAgencyRow,
  HasKeywordEdge,
  HasTopicEdge,
  JournalRow,
  KeywordRow,
  PaperProjectEdge,
  PaperRow,
  PartnersWithEdge,
  PresentedAtEdge,
  ProjectRow,
  PublishedInEdge,
  RelatedKeywordEdge,
  RelatedTopicEdge,
  TopicRow,
  UniversityRow,
  UsesDatasetEdge,
} from '../types.js';

export interface RelationshipInput {
  random: Random;
  authors: AuthorRow[];
  papers: PaperRow[];
  universities: UniversityRow[];
  topics: TopicRow[];
  keywords: KeywordRow[];
  conferences: ConferenceRow[];
  journals: JournalRow[];
  datasets: DatasetRow[];
  fundingAgencies: FundingAgencyRow[];
  projects: ProjectRow[];
  anchorTopicByPaperId: Map<string, TopicRow>;
  anchorTopicByProjectId: Map<string, TopicRow>;
  homeUniversityId: Map<string, string>;
  fieldByAuthorId: Map<string, string>;
}

export interface RelationshipOutput {
  affiliatedWith: AffiliatedEdge[];
  authored: AuthoredEdge[];
  cites: CitesEdge[];
  paperTopics: HasTopicEdge[];
  projectTopics: HasTopicEdge[];
  datasetTopics: HasTopicEdge[];
  conferenceTopics: HasTopicEdge[];
  journalTopics: HasTopicEdge[];
  paperKeywords: HasKeywordEdge[];
  publishedIn: PublishedInEdge[];
  presentedAt: PresentedAtEdge[];
  usesDataset: UsesDatasetEdge[];
  fundedBy: FundedByEdge[];
  relatedTopics: RelatedTopicEdge[];
  paperProjects: PaperProjectEdge[];
  relatedKeywords: RelatedKeywordEdge[];
  partnersWith: PartnersWithEdge[];
  paperAuthorIds: Map<string, string[]>;
}

/** Canonical key for an undirected pair, so A-B and B-A collapse into one edge. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function generateRelationships(input: RelationshipInput): RelationshipOutput {
  const { random } = input;

  const topicsByField = groupBy(input.topics, (topic) => topic.field);
  const authorsByField = groupBy(input.authors, (author) => author.primaryField);
  const authorsByUniversity = groupByKey(input.authors, (author) =>
    input.homeUniversityId.get(author.id),
  );
  const keywordPoolByTopicId = buildKeywordPools(random, input.topics, input.keywords);

  const affiliatedWith = buildAffiliations(input);
  const { authored, paperAuthorIds } = buildAuthorship(input, authorsByField, authorsByUniversity);
  const paperTopics = buildPaperTopics(input, topicsByField);
  const paperKeywords = buildPaperKeywords(input, keywordPoolByTopicId);
  const { publishedIn, presentedAt } = buildVenueLinks(input);
  const usesDataset = buildDatasetUsage(input);
  const cites = buildCitations(input);
  const relatedTopics = buildRelatedTopics(input, topicsByField);
  const relatedKeywords = buildRelatedKeywords(input, keywordPoolByTopicId);
  const partnersWith = buildPartnerships(input);
  const { conferenceTopics, journalTopics } = buildVenueTopics(input, topicsByField);
  const datasetTopics = buildDatasetTopics(input, topicsByField);
  const projectTopics = buildProjectTopics(input, topicsByField);
  const { paperProjects } = buildProjectMembership(input);
  const fundedBy = buildFunding(input);

  return {
    affiliatedWith,
    authored,
    cites,
    paperTopics,
    projectTopics,
    datasetTopics,
    conferenceTopics,
    journalTopics,
    paperKeywords,
    publishedIn,
    presentedAt,
    usesDataset,
    fundedBy,
    relatedTopics,
    paperProjects,
    relatedKeywords,
    partnersWith,
    paperAuthorIds,
  };
}

// ---------------------------------------------------------------------------
// AFFILIATED_WITH
// ---------------------------------------------------------------------------

function buildAffiliations(input: RelationshipInput): AffiliatedEdge[] {
  const { random, authors, universities, homeUniversityId } = input;
  const edges: AffiliatedEdge[] = [];

  for (const author of authors) {
    const homeId = homeUniversityId.get(author.id);
    if (!homeId) continue;

    edges.push({
      from: author.id,
      to: homeId,
      props: {
        since: author.careerStartYear,
        role: roleForTitle(author.title, random),
        isPrimary: true,
      },
    });

    // Senior researchers frequently hold a second, visiting appointment. These
    // secondary edges are what let cross-institution paths stay short.
    if (random.bool(RELATIONSHIP_TUNING.secondaryAffiliationProbability)) {
      const secondary = random.pick(universities);
      if (secondary.id !== homeId) {
        edges.push({
          from: author.id,
          to: secondary.id,
          props: {
            since: Math.min(
              RELATIONSHIP_TUNING.latestPaperYear,
              author.careerStartYear + random.int(2, 10),
            ),
            role: 'Visiting Researcher',
            isPrimary: false,
          },
        });
      }
    }
  }

  return edges;
}

function roleForTitle(title: string, random: Random): string {
  if (title === 'PhD Candidate') return 'Doctoral Researcher';
  if (title === 'Department Chair' || title === 'Distinguished Professor') {
    return 'Principal Investigator';
  }
  return random.pick(AFFILIATION_ROLES);
}

// ---------------------------------------------------------------------------
// AUTHORED
// ---------------------------------------------------------------------------

/**
 * Co-authorship is the backbone of the whole graph, so it is sampled rather
 * than randomised. Three effects are reproduced deliberately:
 *
 *   1. A lead author is drawn from the field the paper belongs to.
 *   2. Co-authors come preferentially from the lead's institution and field,
 *      which produces genuine research groups.
 *   3. Past collaborators are re-selected with high probability, which turns
 *      COLLABORATED_WITH into a weighted network with real communities instead
 *      of a uniform random graph.
 */
function buildAuthorship(
  input: RelationshipInput,
  authorsByField: Map<string, AuthorRow[]>,
  authorsByUniversity: Map<string, AuthorRow[]>,
): { authored: AuthoredEdge[]; paperAuthorIds: Map<string, string[]> } {
  const { random, papers, authors, anchorTopicByPaperId, homeUniversityId } = input;
  const { authorsPerPaper } = RELATIONSHIP_TUNING;

  const authored: AuthoredEdge[] = [];
  const paperAuthorIds = new Map<string, string[]>();
  const priorCollaborators = new Map<string, string[]>();
  const authorById = new Map(authors.map((author) => [author.id, author]));

  for (const paper of papers) {
    const anchor = anchorTopicByPaperId.get(paper.id);
    const fieldPool = (anchor ? authorsByField.get(anchor.field) : undefined) ?? authors;
    const eligible = fieldPool.filter((author) => author.careerStartYear <= paper.year);
    const leadPool = eligible.length > 0 ? eligible : authors;

    const lead = random.pickSkewed(leadPool, 1.4);
    const teamSize = clamp(
      random.skewedInt(authorsPerPaper.min, authorsPerPaper.max, 1.7) + 1,
      authorsPerPaper.min,
      authorsPerPaper.max,
    );

    const team = [lead.id];
    const chosen = new Set(team);
    const leadUniversityId = homeUniversityId.get(lead.id);
    const leadCollaborators = priorCollaborators.get(lead.id) ?? [];

    while (team.length < teamSize) {
      const candidate = pickCoAuthor({
        random,
        authors,
        leadCollaborators,
        sameUniversity: leadUniversityId ? authorsByUniversity.get(leadUniversityId) : undefined,
        sameField: fieldPool,
        year: paper.year,
      });
      if (!candidate || chosen.has(candidate)) {
        // Fall back to any eligible author rather than looping indefinitely.
        const fallback = random.pick(authors);
        if (chosen.has(fallback.id)) continue;
        chosen.add(fallback.id);
        team.push(fallback.id);
        continue;
      }
      chosen.add(candidate);
      team.push(candidate);
    }

    const correspondingIndex = random.bool(0.75) ? 0 : team.length - 1;
    team.forEach((authorId, position) => {
      authored.push({
        from: authorId,
        to: paper.id,
        props: { position: position + 1, isCorresponding: position === correspondingIndex },
      });
    });

    paperAuthorIds.set(paper.id, team);
    rememberCollaborations(priorCollaborators, team);

    // Keep the author record's field aligned with what they actually publish.
    if (anchor) {
      const leadRecord = authorById.get(lead.id);
      if (leadRecord && random.bool(0.2)) leadRecord.primaryField = anchor.field;
    }
  }

  return { authored, paperAuthorIds };
}

function pickCoAuthor(options: {
  random: Random;
  authors: AuthorRow[];
  leadCollaborators: string[];
  sameUniversity: AuthorRow[] | undefined;
  sameField: AuthorRow[];
  year: number;
}): string | null {
  const { random, authors, leadCollaborators, sameUniversity, sameField, year } = options;
  const roll = random.next();

  if (roll < 0.4 && leadCollaborators.length > 0) {
    return random.pick(leadCollaborators);
  }
  if (roll < 0.68 && sameUniversity && sameUniversity.length > 1) {
    return random.pick(sameUniversity).id;
  }
  if (roll < 0.9 && sameField.length > 1) {
    const eligible = sameField.filter((author) => author.careerStartYear <= year);
    if (eligible.length > 0) return random.pick(eligible).id;
  }
  const candidate = authors[random.int(0, authors.length - 1)];
  return candidate ? candidate.id : null;
}

function rememberCollaborations(store: Map<string, string[]>, team: string[]): void {
  for (const authorId of team) {
    const existing = store.get(authorId) ?? [];
    for (const other of team) {
      if (other !== authorId) existing.push(other);
    }
    store.set(authorId, existing);
  }
}

// ---------------------------------------------------------------------------
// HAS_TOPIC (papers)
// ---------------------------------------------------------------------------

function buildPaperTopics(
  input: RelationshipInput,
  topicsByField: Map<string, TopicRow[]>,
): HasTopicEdge[] {
  const { random, papers, topics, anchorTopicByPaperId } = input;
  const { topicsPerPaper } = RELATIONSHIP_TUNING;

  const paperTopics: HasTopicEdge[] = [];

  for (const paper of papers) {
    const anchor = anchorTopicByPaperId.get(paper.id) ?? random.pick(topics);
    const assigned = [anchor.id];

    paperTopics.push({
      from: paper.id,
      to: anchor.id,
      props: { relevance: random.float(0.82, 1, 2) },
    });

    const extraCount = random.int(topicsPerPaper.min, topicsPerPaper.max) - 1;
    const siblings = (topicsByField.get(anchor.field) ?? topics).filter(
      (topic) => topic.id !== anchor.id,
    );

    for (let i = 0; i < extraCount; i += 1) {
      // Most secondary topics stay within the field; a minority reach across it,
      // which is exactly the signal the cross-domain query looks for.
      const pool = random.bool(0.75) && siblings.length > 0 ? siblings : topics;
      const extra = random.pick(pool);
      if (assigned.includes(extra.id)) continue;
      assigned.push(extra.id);
      paperTopics.push({
        from: paper.id,
        to: extra.id,
        props: { relevance: random.float(0.25, 0.8, 2) },
      });
    }

  }

  return paperTopics;
}

// ---------------------------------------------------------------------------
// HAS_KEYWORD
// ---------------------------------------------------------------------------

/**
 * Each topic gets a stable pool of keywords. Papers then draw mostly from their
 * topic's pool, so two papers on the same subject share keywords even when they
 * share no citation - the signal the similar-paper recommender relies on.
 */
function buildKeywordPools(
  random: Random,
  topics: readonly TopicRow[],
  keywords: readonly KeywordRow[],
): Map<string, KeywordRow[]> {
  const pools = new Map<string, KeywordRow[]>();
  for (const topic of topics) {
    pools.set(topic.id, random.sample(keywords, 12));
  }
  return pools;
}

function buildPaperKeywords(
  input: RelationshipInput,
  keywordPoolByTopicId: Map<string, KeywordRow[]>,
): HasKeywordEdge[] {
  const { random, papers, keywords, anchorTopicByPaperId } = input;
  const { keywordsPerPaper } = RELATIONSHIP_TUNING;
  const edges: HasKeywordEdge[] = [];

  for (const paper of papers) {
    const anchor = anchorTopicByPaperId.get(paper.id);
    const pool = (anchor ? keywordPoolByTopicId.get(anchor.id) : undefined) ?? keywords;
    const count = random.int(keywordsPerPaper.min, keywordsPerPaper.max);
    const selected = new Set<string>();

    for (let i = 0; i < count; i += 1) {
      const keyword = random.bool(0.8) ? random.pick(pool) : random.pick(keywords);
      if (selected.has(keyword.id)) continue;
      selected.add(keyword.id);
      edges.push({ from: paper.id, to: keyword.id, props: {} });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// PUBLISHED_IN / PRESENTED_AT
// ---------------------------------------------------------------------------

function buildVenueLinks(input: RelationshipInput): {
  publishedIn: PublishedInEdge[];
  presentedAt: PresentedAtEdge[];
} {
  const { random, papers, conferences, journals, anchorTopicByPaperId } = input;

  const conferencesByField = groupBy(conferences, (conference) => conference.field);
  const journalsByField = groupBy(journals, (journal) => journal.field);

  const publishedIn: PublishedInEdge[] = [];
  const presentedAt: PresentedAtEdge[] = [];

  for (const paper of papers) {
    const field = anchorTopicByPaperId.get(paper.id)?.field;

    if (random.bool(0.55)) {
      const pool = (field ? conferencesByField.get(field) : undefined) ?? conferences;
      const conference = random.pickSkewed(pool, 1.3);
      presentedAt.push({
        from: paper.id,
        to: conference.id,
        props: { year: paper.year, track: random.pick(CONFERENCE_TRACKS) },
      });
    } else {
      // Multidisciplinary journals accept work from every field, so they stay in
      // the candidate pool regardless of the paper's subject.
      const fieldPool = field ? (journalsByField.get(field) ?? []) : [];
      const generalPool = journalsByField.get('Multidisciplinary') ?? [];
      const pool = [...fieldPool, ...generalPool];
      const journal = random.pickSkewed(pool.length > 0 ? pool : journals, 1.5);
      publishedIn.push({
        from: paper.id,
        to: journal.id,
        props: {
          year: paper.year,
          volume: paper.year - journal.impactFactor > 0 ? random.int(1, 60) : 1,
          issue: random.int(1, 12),
        },
      });
    }
  }

  return { publishedIn, presentedAt };
}

// ---------------------------------------------------------------------------
// USES_DATASET
// ---------------------------------------------------------------------------

function buildDatasetUsage(input: RelationshipInput): UsesDatasetEdge[] {
  const { random, papers, datasets, anchorTopicByPaperId } = input;
  const datasetsByDomain = groupBy(datasets, (dataset) => dataset.domain);
  const { datasetsPerPaper } = RELATIONSHIP_TUNING;
  const edges: UsesDatasetEdge[] = [];

  for (const paper of papers) {
    const field = anchorTopicByPaperId.get(paper.id)?.field;
    const count = random.int(datasetsPerPaper.min, datasetsPerPaper.max);
    const selected = new Set<string>();

    for (let i = 0; i < count; i += 1) {
      const pool = (field && random.bool(0.8) && datasetsByDomain.get(field)) || datasets;
      const dataset = random.pick(pool);
      // A dataset released after the paper could not have been used by it.
      if (dataset.releaseYear > paper.year || selected.has(dataset.id)) continue;
      selected.add(dataset.id);
      edges.push({
        from: paper.id,
        to: dataset.id,
        props: { usageType: random.pick(DATASET_USAGE_TYPES) },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// CITES
// ---------------------------------------------------------------------------

/**
 * Citations are generated with preferential attachment.
 *
 * Every paper enters a "ticket" pool once it is published, and gains another
 * ticket each time it is cited. Drawing a uniformly random ticket therefore
 * favours already well-cited work, which reproduces the power-law citation
 * distribution seen in real bibliometrics. Separate per-topic pools mean most
 * references stay on-subject while a minority reach across topics.
 */
function buildCitations(input: RelationshipInput): CitesEdge[] {
  const { random, papers, anchorTopicByPaperId } = input;
  const { referencesPerPaper } = RELATIONSHIP_TUNING;

  const ordered = [...papers].sort((a, b) => a.year - b.year);
  const globalTickets: string[] = [];
  const topicTickets = new Map<string, string[]>();
  const edges: CitesEdge[] = [];
  const yearById = new Map(papers.map((paper) => [paper.id, paper.year]));

  // Papers published in the same year are staged and only become citable once
  // the year advances. Without this, two same-year papers could cite each other
  // purely because of processing order, and the citation graph would stop being
  // acyclic - which breaks lineage traversal.
  let stagedYear = ordered[0]?.year ?? 0;
  let staged: string[] = [];

  const releaseStaged = (): void => {
    for (const id of staged) {
      globalTickets.push(id);
      const topicId = anchorTopicByPaperId.get(id)?.id;
      if (topicId) {
        const pool = topicTickets.get(topicId) ?? [];
        pool.push(id);
        topicTickets.set(topicId, pool);
      }
    }
    staged = [];
  };

  for (const paper of ordered) {
    if (paper.year > stagedYear) {
      releaseStaged();
      stagedYear = paper.year;
    }
    const anchorId = anchorTopicByPaperId.get(paper.id)?.id;
    const topicPool = anchorId ? (topicTickets.get(anchorId) ?? []) : [];
    const references = new Set<string>();

    if (globalTickets.length > 0) {
      const target = random.int(referencesPerPaper.min, referencesPerPaper.max);
      // Bounded attempts: near the start of the timeline there simply are not
      // enough earlier papers to satisfy the target.
      for (let attempt = 0; attempt < target * 3 && references.size < target; attempt += 1) {
        const useTopicPool = topicPool.length > 0 && random.bool(0.6);
        const pool = useTopicPool ? topicPool : globalTickets;
        const candidate = pool[random.int(0, pool.length - 1)];
        if (!candidate || candidate === paper.id || references.has(candidate)) continue;
        if ((yearById.get(candidate) ?? paper.year) >= paper.year) continue;
        references.add(candidate);
      }
    }

    for (const reference of references) {
      edges.push({ from: paper.id, to: reference, props: { year: paper.year } });
      globalTickets.push(reference);
      if (anchorId) {
        const pool = topicTickets.get(anchorId) ?? [];
        pool.push(reference);
        topicTickets.set(anchorId, pool);
      }
    }

    staged.push(paper.id);
  }

  return edges;
}

// ---------------------------------------------------------------------------
// RELATED_TO (topics)
// ---------------------------------------------------------------------------

function buildRelatedTopics(
  input: RelationshipInput,
  topicsByField: Map<string, TopicRow[]>,
): RelatedTopicEdge[] {
  const { random, topics } = input;
  const { relatedTopicsPerTopic, crossFieldTopicShare } = RELATIONSHIP_TUNING;
  const seen = new Set<string>();
  const edges: RelatedTopicEdge[] = [];

  for (const topic of topics) {
    const siblings = (topicsByField.get(topic.field) ?? []).filter((other) => other.id !== topic.id);
    const count = random.int(relatedTopicsPerTopic.min, relatedTopicsPerTopic.max);

    for (let i = 0; i < count; i += 1) {
      const crossField = random.bool(crossFieldTopicShare) || siblings.length === 0;
      const pool = crossField ? topics : siblings;
      const other = random.pick(pool);
      if (other.id === topic.id) continue;

      const key = pairKey(topic.id, other.id);
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        from: topic.id,
        to: other.id,
        // In-field links are stronger; cross-field links are the weak ties that
        // make indirect topic discovery interesting.
        props: { strength: crossField ? random.float(0.2, 0.55, 2) : random.float(0.5, 0.95, 2) },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// RELATED_TO (keywords)
// ---------------------------------------------------------------------------

/**
 * The keyword semantic network.
 *
 * Two keywords are related when they are drawn from the same topic pools, which
 * is the seeded analogue of real co-occurrence: terms used together on the same
 * subject belong together. `kind` turns a flat association list into a navigable
 * taxonomy - `synonym` merges variants at query time, `broader`/`narrower` walk a
 * hierarchy, `co-occurring` supports discovery.
 *
 * This layer is what lets a search for "GNN" reach papers tagged "message
 * passing" without any text-matching heuristic.
 */
function buildRelatedKeywords(
  input: RelationshipInput,
  keywordPoolByTopicId: Map<string, KeywordRow[]>,
): RelatedKeywordEdge[] {
  const { random, topics } = input;
  const seen = new Set<string>();
  const edges: RelatedKeywordEdge[] = [];

  for (const topic of topics) {
    const pool = keywordPoolByTopicId.get(topic.id) ?? [];

    // Within a topic's pool, link a sample of pairs. Co-occurrence on the same
    // subject is the evidence; the pool is the subject.
    for (let i = 0; i < pool.length; i += 1) {
      const partners = random.sample(pool, random.int(1, 3));
      for (const partner of partners) {
        const source = pool[i];
        if (!source || partner.id === source.id) continue;

        const key = pairKey(source.id, partner.id);
        if (seen.has(key)) continue;
        seen.add(key);

        edges.push({
          from: source.id,
          to: partner.id,
          props: {
            strength: random.float(0.35, 0.95, 2),
            kind: random.pick(KEYWORD_RELATION_KINDS),
          },
        });
      }
    }
  }

  return edges;
}

const KEYWORD_RELATION_KINDS = ['co-occurring', 'co-occurring', 'synonym', 'broader', 'narrower'] as const;

// ---------------------------------------------------------------------------
// PARTNERS_WITH (universities)
// ---------------------------------------------------------------------------

function buildPartnerships(input: RelationshipInput): PartnersWithEdge[] {
  const { random, universities } = input;
  const { partnershipsPerUniversity } = RELATIONSHIP_TUNING;
  const seen = new Set<string>();
  const edges: PartnersWithEdge[] = [];

  for (const university of universities) {
    const count = random.int(partnershipsPerUniversity.min, partnershipsPerUniversity.max);
    for (let i = 0; i < count; i += 1) {
      const partner = random.pick(universities);
      if (partner.id === university.id) continue;

      const key = pairKey(university.id, partner.id);
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        from: university.id,
        to: partner.id,
        props: {
          since: random.int(2005, RELATIONSHIP_TUNING.latestPaperYear),
          focus: random.pick(PARTNERSHIP_FOCUS_AREAS),
        },
      });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// HAS_TOPIC (venues, datasets, projects)
// ---------------------------------------------------------------------------

function buildVenueTopics(
  input: RelationshipInput,
  topicsByField: Map<string, TopicRow[]>,
): { conferenceTopics: HasTopicEdge[]; journalTopics: HasTopicEdge[] } {
  const { random, conferences, journals, topics } = input;
  const { topicsPerVenue } = RELATIONSHIP_TUNING;

  const link = (venueId: string, field: string): HasTopicEdge[] => {
    const pool = topicsByField.get(field) ?? topics;
    const count = Math.min(random.int(topicsPerVenue.min, topicsPerVenue.max), pool.length);
    return random.sample(pool, count).map((topic) => ({
      from: venueId,
      to: topic.id,
      props: { relevance: random.float(0.5, 1, 2) },
    }));
  };

  return {
    conferenceTopics: conferences.flatMap((conference) => link(conference.id, conference.field)),
    journalTopics: journals.flatMap((journal) => link(journal.id, journal.field)),
  };
}

function buildDatasetTopics(
  input: RelationshipInput,
  topicsByField: Map<string, TopicRow[]>,
): HasTopicEdge[] {
  const { random, datasets, topics } = input;
  const { topicsPerDataset } = RELATIONSHIP_TUNING;

  return datasets.flatMap((dataset) => {
    const pool = topicsByField.get(dataset.domain) ?? topics;
    const count = Math.min(random.int(topicsPerDataset.min, topicsPerDataset.max), pool.length);
    return random.sample(pool, count).map((topic) => ({
      from: dataset.id,
      to: topic.id,
      props: { relevance: random.float(0.4, 1, 2) },
    }));
  });
}

function buildProjectTopics(
  input: RelationshipInput,
  topicsByField: Map<string, TopicRow[]>,
): HasTopicEdge[] {
  const { random, projects, topics, anchorTopicByProjectId } = input;
  const { topicsPerProject } = RELATIONSHIP_TUNING;
  const edges: HasTopicEdge[] = [];

  for (const project of projects) {
    const anchor = anchorTopicByProjectId.get(project.id) ?? random.pick(topics);
    const assigned = new Set([anchor.id]);
    edges.push({ from: project.id, to: anchor.id, props: { relevance: random.float(0.8, 1, 2) } });

    const pool = (topicsByField.get(anchor.field) ?? topics).filter(
      (topic) => topic.id !== anchor.id,
    );
    const extra = random.int(topicsPerProject.min, topicsPerProject.max) - 1;

    for (let i = 0; i < extra && pool.length > 0; i += 1) {
      const topic = random.pick(pool);
      if (assigned.has(topic.id)) continue;
      assigned.add(topic.id);
      edges.push({ from: project.id, to: topic.id, props: { relevance: random.float(0.3, 0.8, 2) } });
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// INCLUDES (Project -> Paper)
// ---------------------------------------------------------------------------

function buildProjectMembership(
  input: RelationshipInput,
): { paperProjects: PaperProjectEdge[] } {
  const { random, papers, projects, anchorTopicByPaperId, anchorTopicByProjectId } = input;
  const { paperProjectProbability } = RELATIONSHIP_TUNING;

  const projectsByField = groupByKey(projects, (project) =>
    anchorTopicByProjectId.get(project.id)?.field,
  );

  const paperProjects: PaperProjectEdge[] = [];

  for (const paper of papers) {
    if (!random.bool(paperProjectProbability)) continue;

    const field = anchorTopicByPaperId.get(paper.id)?.field;
    const pool = (field ? projectsByField.get(field) : undefined) ?? projects;
    const candidates = pool.filter(
      (project) => project.startYear <= paper.year && project.endYear >= paper.year - 1,
    );
    if (candidates.length === 0) continue;

    const project = random.pick(candidates);
    paperProjects.push({ from: project.id, to: paper.id, props: {} });

  }

  return { paperProjects };
}


// ---------------------------------------------------------------------------
// FUNDS (FundingAgency -> Project)
// ---------------------------------------------------------------------------

function buildFunding(input: RelationshipInput): FundedByEdge[] {
  const { random, projects, fundingAgencies } = input;
  const { fundersPerProject } = RELATIONSHIP_TUNING;
  const edges: FundedByEdge[] = [];

  for (const project of projects) {
    const funderCount = random.int(fundersPerProject.min, fundersPerProject.max);
    const funders = random.sample(fundingAgencies, funderCount);
    // The budget is split across funders, with the lead agency covering most.
    let remaining = project.budgetUsd;

    funders.forEach((agency, index) => {
      const isLast = index === funders.length - 1;
      const share = isLast ? remaining : Math.round(remaining * random.float(0.45, 0.8, 2));
      remaining -= share;
      edges.push({
        from: agency.id,
        to: project.id,
        props: {
          amountUsd: Math.max(share, 25_000),
          grantNumber: `${random.pick(GRANT_PREFIXES)}-${random.int(100000, 999999)}`,
          startYear: project.startYear,
        },
      });
    });
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = key(item);
    const existing = map.get(bucket);
    if (existing) existing.push(item);
    else map.set(bucket, [item]);
  }
  return map;
}

function groupByKey<T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = key(item);
    if (!bucket) continue;
    const existing = map.get(bucket);
    if (existing) existing.push(item);
    else map.set(bucket, [item]);
  }
  return map;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
