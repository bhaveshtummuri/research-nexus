/**
 * University vocabulary.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface UniversitySeed {
  name: string;
  country: string;
  city: string;
  type: 'Public Research' | 'Private Research' | 'Technical Institute' | 'National Laboratory';
  foundedYear: number;
  ranking: number;
}

/**
 * 50 institutions spread across 20 countries. The mix of public, private,
 * technical and national-laboratory types matters for the analytics queries,
 * which report cross-institution and international collaboration shares.
 */
export const UNIVERSITIES: readonly UniversitySeed[] = [
  { name: 'Massachusetts Institute of Technology', country: 'United States', city: 'Cambridge', type: 'Private Research', foundedYear: 1861, ranking: 1 },
  { name: 'Stanford University', country: 'United States', city: 'Stanford', type: 'Private Research', foundedYear: 1885, ranking: 2 },
  { name: 'University of Cambridge', country: 'United Kingdom', city: 'Cambridge', type: 'Public Research', foundedYear: 1209, ranking: 3 },
  { name: 'University of Oxford', country: 'United Kingdom', city: 'Oxford', type: 'Public Research', foundedYear: 1096, ranking: 4 },
  { name: 'ETH Zurich', country: 'Switzerland', city: 'Zurich', type: 'Technical Institute', foundedYear: 1855, ranking: 5 },
  { name: 'National University of Singapore', country: 'Singapore', city: 'Singapore', type: 'Public Research', foundedYear: 1905, ranking: 6 },
  { name: 'University of California, Berkeley', country: 'United States', city: 'Berkeley', type: 'Public Research', foundedYear: 1868, ranking: 7 },
  { name: 'Imperial College London', country: 'United Kingdom', city: 'London', type: 'Public Research', foundedYear: 1907, ranking: 8 },
  { name: 'Tsinghua University', country: 'China', city: 'Beijing', type: 'Public Research', foundedYear: 1911, ranking: 9 },
  { name: 'Peking University', country: 'China', city: 'Beijing', type: 'Public Research', foundedYear: 1898, ranking: 10 },
  { name: 'California Institute of Technology', country: 'United States', city: 'Pasadena', type: 'Private Research', foundedYear: 1891, ranking: 11 },
  { name: 'University of Tokyo', country: 'Japan', city: 'Tokyo', type: 'Public Research', foundedYear: 1877, ranking: 12 },
  { name: 'Carnegie Mellon University', country: 'United States', city: 'Pittsburgh', type: 'Private Research', foundedYear: 1900, ranking: 13 },
  { name: 'EPFL', country: 'Switzerland', city: 'Lausanne', type: 'Technical Institute', foundedYear: 1969, ranking: 14 },
  { name: 'University of Toronto', country: 'Canada', city: 'Toronto', type: 'Public Research', foundedYear: 1827, ranking: 15 },
  { name: 'Technical University of Munich', country: 'Germany', city: 'Munich', type: 'Technical Institute', foundedYear: 1868, ranking: 16 },
  { name: 'KAIST', country: 'South Korea', city: 'Daejeon', type: 'Technical Institute', foundedYear: 1971, ranking: 17 },
  { name: 'University of Melbourne', country: 'Australia', city: 'Melbourne', type: 'Public Research', foundedYear: 1853, ranking: 18 },
  { name: 'Delft University of Technology', country: 'Netherlands', city: 'Delft', type: 'Technical Institute', foundedYear: 1842, ranking: 19 },
  { name: 'University of Edinburgh', country: 'United Kingdom', city: 'Edinburgh', type: 'Public Research', foundedYear: 1583, ranking: 20 },
  { name: 'Princeton University', country: 'United States', city: 'Princeton', type: 'Private Research', foundedYear: 1746, ranking: 21 },
  { name: 'Yale University', country: 'United States', city: 'New Haven', type: 'Private Research', foundedYear: 1701, ranking: 22 },
  { name: 'KU Leuven', country: 'Belgium', city: 'Leuven', type: 'Public Research', foundedYear: 1425, ranking: 23 },
  { name: 'University of British Columbia', country: 'Canada', city: 'Vancouver', type: 'Public Research', foundedYear: 1908, ranking: 24 },
  { name: 'Seoul National University', country: 'South Korea', city: 'Seoul', type: 'Public Research', foundedYear: 1946, ranking: 25 },
  { name: 'University of Copenhagen', country: 'Denmark', city: 'Copenhagen', type: 'Public Research', foundedYear: 1479, ranking: 26 },
  { name: 'Karolinska Institute', country: 'Sweden', city: 'Stockholm', type: 'Public Research', foundedYear: 1810, ranking: 27 },
  { name: 'University of Amsterdam', country: 'Netherlands', city: 'Amsterdam', type: 'Public Research', foundedYear: 1632, ranking: 28 },
  { name: 'Indian Institute of Science', country: 'India', city: 'Bengaluru', type: 'Technical Institute', foundedYear: 1909, ranking: 29 },
  { name: 'University of Sao Paulo', country: 'Brazil', city: 'Sao Paulo', type: 'Public Research', foundedYear: 1934, ranking: 30 },
  { name: 'Sorbonne University', country: 'France', city: 'Paris', type: 'Public Research', foundedYear: 1257, ranking: 31 },
  { name: 'Heidelberg University', country: 'Germany', city: 'Heidelberg', type: 'Public Research', foundedYear: 1386, ranking: 32 },
  { name: 'University of Michigan', country: 'United States', city: 'Ann Arbor', type: 'Public Research', foundedYear: 1817, ranking: 33 },
  { name: 'Australian National University', country: 'Australia', city: 'Canberra', type: 'Public Research', foundedYear: 1946, ranking: 34 },
  { name: 'Chalmers University of Technology', country: 'Sweden', city: 'Gothenburg', type: 'Technical Institute', foundedYear: 1829, ranking: 35 },
  { name: 'Hebrew University of Jerusalem', country: 'Israel', city: 'Jerusalem', type: 'Public Research', foundedYear: 1918, ranking: 36 },
  { name: 'Technion Israel Institute of Technology', country: 'Israel', city: 'Haifa', type: 'Technical Institute', foundedYear: 1912, ranking: 37 },
  { name: 'Indian Institute of Technology Bombay', country: 'India', city: 'Mumbai', type: 'Technical Institute', foundedYear: 1958, ranking: 38 },
  { name: 'University of Cape Town', country: 'South Africa', city: 'Cape Town', type: 'Public Research', foundedYear: 1829, ranking: 39 },
  { name: 'Universidad Nacional Autonoma de Mexico', country: 'Mexico', city: 'Mexico City', type: 'Public Research', foundedYear: 1910, ranking: 40 },
  { name: 'Aalto University', country: 'Finland', city: 'Espoo', type: 'Technical Institute', foundedYear: 2010, ranking: 41 },
  { name: 'University of Vienna', country: 'Austria', city: 'Vienna', type: 'Public Research', foundedYear: 1365, ranking: 42 },
  { name: 'Politecnico di Milano', country: 'Italy', city: 'Milan', type: 'Technical Institute', foundedYear: 1863, ranking: 43 },
  { name: 'Lawrence Berkeley National Laboratory', country: 'United States', city: 'Berkeley', type: 'National Laboratory', foundedYear: 1931, ranking: 44 },
  { name: 'Max Planck Institute for Intelligent Systems', country: 'Germany', city: 'Tubingen', type: 'National Laboratory', foundedYear: 2011, ranking: 45 },
  { name: 'RIKEN Center for Advanced Intelligence Project', country: 'Japan', city: 'Tokyo', type: 'National Laboratory', foundedYear: 2016, ranking: 46 },
  { name: 'INRIA', country: 'France', city: 'Rocquencourt', type: 'National Laboratory', foundedYear: 1967, ranking: 47 },
  { name: 'Barcelona Supercomputing Center', country: 'Spain', city: 'Barcelona', type: 'National Laboratory', foundedYear: 2005, ranking: 48 },
  { name: 'University of Buenos Aires', country: 'Argentina', city: 'Buenos Aires', type: 'Public Research', foundedYear: 1821, ranking: 49 },
  { name: 'Nanyang Technological University', country: 'Singapore', city: 'Singapore', type: 'Technical Institute', foundedYear: 1981, ranking: 50 },
];

/** Focus areas attached to university-to-university PARTNERS_WITH edges. */
export const PARTNERSHIP_FOCUS_AREAS = [
  'Joint doctoral programme',
  'Shared instrumentation facility',
  'Exchange fellowship',
  'Co-funded research centre',
  'Open data consortium',
  'Industry translation hub',
  'Climate observation network',
  'Clinical trials network',
] as const;
