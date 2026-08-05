import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText } from '../generators/text.js';
import type { KeywordRow } from '../types.js';

import { KEYWORDS } from './data.js';

export function generateKeywords(): KeywordRow[] {
  return KEYWORDS.slice(0, ENTITY_COUNTS.keywords).map((term, index) => ({
    id: id('keyword', index),
    term,
    paperCount: 0,
    searchText: searchText(term),
  }));
}
