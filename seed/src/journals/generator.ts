import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { JournalRow } from '../types.js';

import { JOURNALS } from './data.js';

export function generateJournals(): JournalRow[] {
  return JOURNALS.slice(0, ENTITY_COUNTS.journals).map((journal, index) => ({
    id: id('journal', index),
    name: journal.name,
    publisher: journal.publisher,
    // Derived from the index, not random: ISSN carries a uniqueness constraint,
    // and a random pair could collide under a different seed.
    issn: formatIssn(index),
    field: journal.field,
    impactFactor: journal.impactFactor,
    website: `https://www.${slugify(journal.name).slice(0, 28)}.org`,
    paperCount: 0,
    searchText: searchText(journal.name, journal.publisher, journal.field),
  }));
}

/** ISSN is 8 digits as NNNN-NNNC. Deterministic, so the constraint always holds. */
function formatIssn(index: number): string {
  const serial = 20250000 + index * 7;
  const digits = String(serial).padStart(8, '0');
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}
