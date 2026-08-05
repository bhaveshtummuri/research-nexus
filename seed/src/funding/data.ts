/**
 * Funding agency vocabulary.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface FundingAgencySeed {
  name: string;
  country: string;
  type: 'Government' | 'Supranational' | 'Private Foundation' | 'Industry Consortium';
  annualBudgetUsd: number;
}

/** 30 funders covering public, supranational, philanthropic and industry money. */
export const FUNDING_AGENCIES: readonly FundingAgencySeed[] = [
  { name: 'National Science Foundation', country: 'United States', type: 'Government', annualBudgetUsd: 9_900_000_000 },
  { name: 'National Institutes of Health', country: 'United States', type: 'Government', annualBudgetUsd: 47_000_000_000 },
  { name: 'European Research Council', country: 'European Union', type: 'Supranational', annualBudgetUsd: 2_400_000_000 },
  { name: 'Horizon Europe', country: 'European Union', type: 'Supranational', annualBudgetUsd: 10_500_000_000 },
  { name: 'Deutsche Forschungsgemeinschaft', country: 'Germany', type: 'Government', annualBudgetUsd: 3_900_000_000 },
  { name: 'UK Research and Innovation', country: 'United Kingdom', type: 'Government', annualBudgetUsd: 10_100_000_000 },
  { name: 'Japan Society for the Promotion of Science', country: 'Japan', type: 'Government', annualBudgetUsd: 2_600_000_000 },
  { name: 'National Natural Science Foundation of China', country: 'China', type: 'Government', annualBudgetUsd: 5_100_000_000 },
  { name: 'Natural Sciences and Engineering Research Council', country: 'Canada', type: 'Government', annualBudgetUsd: 1_300_000_000 },
  { name: 'Australian Research Council', country: 'Australia', type: 'Government', annualBudgetUsd: 800_000_000 },
  { name: 'Swiss National Science Foundation', country: 'Switzerland', type: 'Government', annualBudgetUsd: 1_100_000_000 },
  { name: 'Agence Nationale de la Recherche', country: 'France', type: 'Government', annualBudgetUsd: 1_000_000_000 },
  { name: 'Netherlands Organisation for Scientific Research', country: 'Netherlands', type: 'Government', annualBudgetUsd: 1_200_000_000 },
  { name: 'Swedish Research Council', country: 'Sweden', type: 'Government', annualBudgetUsd: 750_000_000 },
  { name: 'Research Council of Norway', country: 'Norway', type: 'Government', annualBudgetUsd: 1_150_000_000 },
  { name: 'Academy of Finland', country: 'Finland', type: 'Government', annualBudgetUsd: 480_000_000 },
  { name: 'Science Foundation Ireland', country: 'Ireland', type: 'Government', annualBudgetUsd: 260_000_000 },
  { name: 'National Research Foundation of Korea', country: 'South Korea', type: 'Government', annualBudgetUsd: 4_800_000_000 },
  { name: 'Department of Science and Technology India', country: 'India', type: 'Government', annualBudgetUsd: 900_000_000 },
  { name: 'Fundacao de Amparo a Pesquisa de Sao Paulo', country: 'Brazil', type: 'Government', annualBudgetUsd: 320_000_000 },
  { name: 'National Research Foundation of South Africa', country: 'South Africa', type: 'Government', annualBudgetUsd: 180_000_000 },
  { name: 'Israel Science Foundation', country: 'Israel', type: 'Government', annualBudgetUsd: 210_000_000 },
  { name: 'Gordon and Betty Moore Foundation', country: 'United States', type: 'Private Foundation', annualBudgetUsd: 380_000_000 },
  { name: 'Wellcome Trust', country: 'United Kingdom', type: 'Private Foundation', annualBudgetUsd: 1_600_000_000 },
  { name: 'Chan Zuckerberg Initiative', country: 'United States', type: 'Private Foundation', annualBudgetUsd: 700_000_000 },
  { name: 'Alfred P. Sloan Foundation', country: 'United States', type: 'Private Foundation', annualBudgetUsd: 90_000_000 },
  { name: 'Volkswagen Foundation', country: 'Germany', type: 'Private Foundation', annualBudgetUsd: 200_000_000 },
  { name: 'Open Philanthropy', country: 'United States', type: 'Private Foundation', annualBudgetUsd: 650_000_000 },
  { name: 'Partnership on Trustworthy Computing', country: 'United States', type: 'Industry Consortium', annualBudgetUsd: 140_000_000 },
  { name: 'European Semiconductor Research Alliance', country: 'European Union', type: 'Industry Consortium', annualBudgetUsd: 310_000_000 },
];
