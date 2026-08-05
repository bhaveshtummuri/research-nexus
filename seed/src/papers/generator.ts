import { ENTITY_COUNTS, RELATIONSHIP_TUNING } from '../config/index.js';
import { KEYWORDS } from '../keywords/data.js';
import { id } from '../generators/id.js';
import { buildAbstract, searchText, slugify } from '../generators/text.js';
import type { Random } from '../utils/random.js';
import type { PaperRow, TopicRow } from '../types.js';

import {
  APPROACHES,
  APPROACH_NOUNS,
  BASELINES,
  CONTRIBUTIONS,
  PROPERTIES,
  QUALIFIERS,
  TITLE_PATTERNS,
} from './data.js';

export interface PaperGeneration {
  papers: PaperRow[];
  /** The topic each paper was written about, before extra topics are attached. */
  anchorTopicByPaperId: Map<string, TopicRow>;
}

/**
 * Papers are anchored to a topic before their title is written, so title,
 * abstract and the eventual HAS_TOPIC edge all describe the same subject.
 *
 * Publication years are skewed toward the present and never precede the topic's
 * emergence year. That is what gives the trending-topic query real signal when
 * it compares a recent window against the preceding one.
 */
export function generatePapers(random: Random, topics: readonly TopicRow[]): PaperGeneration {
  const { earliestPaperYear, latestPaperYear } = RELATIONSHIP_TUNING;
  const papers: PaperRow[] = [];
  const anchorTopicByPaperId = new Map<string, TopicRow>();

  for (let index = 0; index < ENTITY_COUNTS.papers; index += 1) {
    const topic = random.pick(topics);
    const paperId = id('paper', index);

    const minYear = Math.max(earliestPaperYear, topic.emergenceYear);
    const span = latestPaperYear - minYear;
    const year = span <= 0 ? latestPaperYear : latestPaperYear - random.skewedInt(0, span, 1.8);

    const title = buildTitle(random, topic.name);
    const keywordPair = random.sample(KEYWORDS, 2);

    papers.push({
      id: paperId,
      title,
      abstract: buildAbstract(random, topic.name, keywordPair),
      year,
      doi: `10.${random.int(1000, 9999)}/rn.${String(index + 1).padStart(5, '0')}`,
      url: `https://papers.research-nexus.org/${slugify(title).slice(0, 60)}`,
      citationCount: 0,
      referenceCount: 0,
      searchText: searchText(title, topic.name, topic.field, keywordPair.join(' ')),
    });

    anchorTopicByPaperId.set(paperId, topic);
  }

  return { papers, anchorTopicByPaperId };
}

function buildTitle(random: Random, topicName: string): string {
  return random
    .pick(TITLE_PATTERNS)
    .replace('{approach}', random.pick(APPROACHES))
    .replace('{approach_noun}', random.pick(APPROACH_NOUNS))
    .replace('{qualifier}', random.pick(QUALIFIERS))
    .replace('{property}', random.pick(PROPERTIES))
    .replace('{contribution}', random.pick(CONTRIBUTIONS))
    .replace('{baseline}', random.pick(BASELINES))
    .replace(/\{topic\}/g, topicName);
}
