import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { ConferenceRow } from '../types.js';

import { CONFERENCES } from './data.js';

export function generateConferences(): ConferenceRow[] {
  return CONFERENCES.slice(0, ENTITY_COUNTS.conferences).map((conference, index) => ({
    id: id('conference', index),
    name: conference.name,
    acronym: conference.acronym,
    field: conference.field,
    tier: conference.tier,
    foundedYear: conference.foundedYear,
    location: conference.location,
    website: `https://${slugify(conference.acronym)}.org`,
    paperCount: 0,
    searchText: searchText(conference.name, conference.acronym, conference.field, conference.tier),
  }));
}
