import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { UniversityRow } from '../types.js';

import { UNIVERSITIES } from './data.js';

export function generateUniversities(): UniversityRow[] {
  return UNIVERSITIES.slice(0, ENTITY_COUNTS.universities).map((university, index) => ({
    id: id('university', index),
    name: university.name,
    country: university.country,
    city: university.city,
    type: university.type,
    foundedYear: university.foundedYear,
    ranking: university.ranking,
    website: `https://www.${slugify(university.name).slice(0, 28)}.edu`,
    // Recomputed by the derived-metrics pass once affiliations exist.
    researcherCount: 0,
    searchText: searchText(university.name, university.city, university.country, university.type),
  }));
}
