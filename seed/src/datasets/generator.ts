import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { DatasetRow } from '../types.js';

import { DATASETS } from './data.js';

export function generateDatasets(): DatasetRow[] {
  return DATASETS.slice(0, ENTITY_COUNTS.datasets).map((dataset, index) => ({
    id: id('dataset', index),
    name: dataset.name,
    domain: dataset.domain,
    license: dataset.license,
    sizeGb: dataset.sizeGb,
    releaseYear: dataset.releaseYear,
    url: `https://data.research-nexus.org/${slugify(dataset.name)}`,
    paperCount: 0,
    searchText: searchText(dataset.name, dataset.domain, dataset.license),
  }));
}
