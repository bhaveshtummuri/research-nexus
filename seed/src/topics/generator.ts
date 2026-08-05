import { ENTITY_COUNTS } from '../config/index.js';
import { APPROACHES, APPROACH_NOUNS } from '../papers/data.js';
import { id } from '../generators/id.js';
import { searchText } from '../generators/text.js';
import type { Random } from '../utils/random.js';
import type { TopicRow } from '../types.js';

import { TOPICS } from './data.js';

export function generateTopics(random: Random): TopicRow[] {
  return TOPICS.slice(0, ENTITY_COUNTS.topics).map((topic, index) => ({
    id: id('topic', index),
    name: topic.name,
    field: topic.field,
    description:
      `${topic.name} studies how ${topic.field.toLowerCase()} problems can be addressed with ` +
      `${random.pick(APPROACHES).toLowerCase()} ${random.pick(APPROACH_NOUNS).toLowerCase()}. ` +
      `The area has attracted sustained attention since ${topic.emergenceYear}.`,
    emergenceYear: topic.emergenceYear,
    paperCount: 0,
    searchText: searchText(topic.name, topic.field),
  }));
}
