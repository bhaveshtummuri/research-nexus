import { ENTITY_COUNTS } from '../config/index.js';
import { id } from '../generators/id.js';
import { searchText, slugify } from '../generators/text.js';
import type { FundingAgencyRow } from '../types.js';

import { FUNDING_AGENCIES } from './data.js';

export function generateFundingAgencies(): FundingAgencyRow[] {
  return FUNDING_AGENCIES.slice(0, ENTITY_COUNTS.fundingAgencies).map((agency, index) => ({
    id: id('agency', index),
    name: agency.name,
    country: agency.country,
    type: agency.type,
    annualBudgetUsd: agency.annualBudgetUsd,
    website: `https://www.${slugify(agency.name).slice(0, 30)}.org`,
    searchText: searchText(agency.name, agency.country, agency.type),
  }));
}
