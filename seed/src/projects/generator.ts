import { ENTITY_COUNTS, RELATIONSHIP_TUNING } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText } from '../generators/text.js';
import type { Random } from '../utils/random.js';
import type { ProjectRow, TopicRow } from '../types.js';

import {
  PROJECT_PREFIXES,
  PROJECT_QUALIFIERS,
  PROJECT_STATUSES,
  PROJECT_SUMMARIES,
} from './data.js';

export interface ProjectGeneration {
  projects: ProjectRow[];
  anchorTopicByProjectId: Map<string, TopicRow>;
}

/**
 * Projects sit between authors and funding agencies. Their year window is what
 * lets the funding explorer separate active work from completed work.
 */
export function generateProjects(random: Random, topics: readonly TopicRow[]): ProjectGeneration {
  const projects: ProjectRow[] = [];
  const anchorTopicByProjectId = new Map<string, TopicRow>();

  for (let index = 0; index < ENTITY_COUNTS.projects; index += 1) {
    const topic = random.pick(topics);
    const projectId = id('project', index);
    const startYear = random.int(
      Math.max(RELATIONSHIP_TUNING.earliestPaperYear, topic.emergenceYear),
      RELATIONSHIP_TUNING.latestPaperYear - 1,
    );
    const endYear = startYear + random.int(2, 6);
    const title = `${random.pick(PROJECT_PREFIXES)} ${random.pick(PROJECT_QUALIFIERS)} ${topic.name}`;

    projects.push({
      id: projectId,
      title,
      summary: random
        .pick(PROJECT_SUMMARIES)
        .replace('{count}', String(random.int(3, 12)))
        .replace(/\{topic\}/g, topic.name),
      status:
        endYear < RELATIONSHIP_TUNING.latestPaperYear ? 'Completed' : random.pick(PROJECT_STATUSES),
      startYear,
      endYear,
      budgetUsd: random.int(4, 240) * 250_000,
      searchText: searchText(title, topic.name, topic.field),
    });

    anchorTopicByProjectId.set(projectId, topic);
  }

  return { projects, anchorTopicByProjectId };
}
