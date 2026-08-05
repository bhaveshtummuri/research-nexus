/**
 * Conference vocabulary: 40 venues across 10 fields.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface ConferenceSeed {
  name: string;
  acronym: string;
  field: string;
  tier: 'A*' | 'A' | 'B';
  foundedYear: number;
  location: string;
}

/** 40 conferences, four per research field, spread across three quality tiers. */
export const CONFERENCES: readonly ConferenceSeed[] = [
  { name: 'Conference on Neural Information Processing Systems', acronym: 'NeurIPS', field: 'Artificial Intelligence', tier: 'A*', foundedYear: 1987, location: 'Vancouver, Canada' },
  { name: 'International Conference on Machine Learning', acronym: 'ICML', field: 'Artificial Intelligence', tier: 'A*', foundedYear: 1980, location: 'Vienna, Austria' },
  { name: 'International Conference on Learning Representations', acronym: 'ICLR', field: 'Artificial Intelligence', tier: 'A*', foundedYear: 2013, location: 'Kigali, Rwanda' },
  { name: 'AAAI Conference on Artificial Intelligence', acronym: 'AAAI', field: 'Artificial Intelligence', tier: 'A', foundedYear: 1980, location: 'Washington, United States' },
  { name: 'Intelligent Systems for Molecular Biology', acronym: 'ISMB', field: 'Computational Biology', tier: 'A*', foundedYear: 1993, location: 'Lyon, France' },
  { name: 'Research in Computational Molecular Biology', acronym: 'RECOMB', field: 'Computational Biology', tier: 'A', foundedYear: 1997, location: 'Istanbul, Turkey' },
  { name: 'Pacific Symposium on Biocomputing', acronym: 'PSB', field: 'Computational Biology', tier: 'B', foundedYear: 1996, location: 'Hawaii, United States' },
  { name: 'Machine Learning in Computational Biology', acronym: 'MLCB', field: 'Computational Biology', tier: 'B', foundedYear: 2006, location: 'Boston, United States' },
  { name: 'Conference on Quantum Information Processing', acronym: 'QIP', field: 'Quantum Information', tier: 'A*', foundedYear: 1998, location: 'Ghent, Belgium' },
  { name: 'Theory of Quantum Computation', acronym: 'TQC', field: 'Quantum Information', tier: 'A', foundedYear: 2006, location: 'Aveiro, Portugal' },
  { name: 'IEEE International Conference on Quantum Computing', acronym: 'QCE', field: 'Quantum Information', tier: 'A', foundedYear: 2020, location: 'Bellevue, United States' },
  { name: 'Workshop on Quantum Software Engineering', acronym: 'QSE', field: 'Quantum Information', tier: 'B', foundedYear: 2019, location: 'Zurich, Switzerland' },
  { name: 'American Geophysical Union Fall Meeting', acronym: 'AGU', field: 'Climate Science', tier: 'A', foundedYear: 1919, location: 'San Francisco, United States' },
  { name: 'European Geosciences Union General Assembly', acronym: 'EGU', field: 'Climate Science', tier: 'A', foundedYear: 2004, location: 'Vienna, Austria' },
  { name: 'Conference on Climate Informatics', acronym: 'CI', field: 'Climate Science', tier: 'B', foundedYear: 2011, location: 'Cambridge, United Kingdom' },
  { name: 'International Conference on Carbon Management', acronym: 'ICCM', field: 'Climate Science', tier: 'B', foundedYear: 2014, location: 'Oslo, Norway' },
  { name: 'Materials Research Society Spring Meeting', acronym: 'MRS', field: 'Materials Science', tier: 'A', foundedYear: 1973, location: 'Seattle, United States' },
  { name: 'European Materials Research Society Meeting', acronym: 'E-MRS', field: 'Materials Science', tier: 'A', foundedYear: 1983, location: 'Strasbourg, France' },
  { name: 'Conference on Machine Learning for Materials', acronym: 'ML4Mat', field: 'Materials Science', tier: 'B', foundedYear: 2018, location: 'Lausanne, Switzerland' },
  { name: 'International Symposium on Additive Manufacturing', acronym: 'ISAM', field: 'Materials Science', tier: 'B', foundedYear: 2015, location: 'Singapore' },
  { name: 'Society for Neuroscience Annual Meeting', acronym: 'SfN', field: 'Neuroscience', tier: 'A*', foundedYear: 1971, location: 'Chicago, United States' },
  { name: 'Cognitive Computational Neuroscience', acronym: 'CCN', field: 'Neuroscience', tier: 'A', foundedYear: 2017, location: 'Oxford, United Kingdom' },
  { name: 'Computational and Systems Neuroscience', acronym: 'Cosyne', field: 'Neuroscience', tier: 'A', foundedYear: 2004, location: 'Lisbon, Portugal' },
  { name: 'International BCI Meeting', acronym: 'BCI', field: 'Neuroscience', tier: 'B', foundedYear: 1999, location: 'Brussels, Belgium' },
  { name: 'IEEE Symposium on Security and Privacy', acronym: 'S&P', field: 'Cybersecurity', tier: 'A*', foundedYear: 1980, location: 'San Francisco, United States' },
  { name: 'USENIX Security Symposium', acronym: 'USENIX Sec', field: 'Cybersecurity', tier: 'A*', foundedYear: 1992, location: 'Anaheim, United States' },
  { name: 'ACM Conference on Computer and Communications Security', acronym: 'CCS', field: 'Cybersecurity', tier: 'A*', foundedYear: 1993, location: 'Copenhagen, Denmark' },
  { name: 'Network and Distributed System Security Symposium', acronym: 'NDSS', field: 'Cybersecurity', tier: 'A', foundedYear: 1993, location: 'San Diego, United States' },
  { name: 'IEEE International Conference on Robotics and Automation', acronym: 'ICRA', field: 'Robotics', tier: 'A*', foundedYear: 1984, location: 'Yokohama, Japan' },
  { name: 'IEEE/RSJ International Conference on Intelligent Robots and Systems', acronym: 'IROS', field: 'Robotics', tier: 'A', foundedYear: 1988, location: 'Detroit, United States' },
  { name: 'Robotics: Science and Systems', acronym: 'RSS', field: 'Robotics', tier: 'A*', foundedYear: 2005, location: 'Delft, Netherlands' },
  { name: 'Conference on Robot Learning', acronym: 'CoRL', field: 'Robotics', tier: 'A', foundedYear: 2017, location: 'Munich, Germany' },
  { name: 'ACM SIGMOD International Conference on Management of Data', acronym: 'SIGMOD', field: 'Data Systems', tier: 'A*', foundedYear: 1975, location: 'Santiago, Chile' },
  { name: 'International Conference on Very Large Data Bases', acronym: 'VLDB', field: 'Data Systems', tier: 'A*', foundedYear: 1975, location: 'Guangzhou, China' },
  { name: 'IEEE International Conference on Data Engineering', acronym: 'ICDE', field: 'Data Systems', tier: 'A', foundedYear: 1984, location: 'Utrecht, Netherlands' },
  { name: 'Conference on Innovative Data Systems Research', acronym: 'CIDR', field: 'Data Systems', tier: 'A', foundedYear: 2003, location: 'Chaminade, United States' },
  { name: 'ACM Conference on Human Factors in Computing Systems', acronym: 'CHI', field: 'Human-Computer Interaction', tier: 'A*', foundedYear: 1982, location: 'Honolulu, United States' },
  { name: 'ACM Symposium on User Interface Software and Technology', acronym: 'UIST', field: 'Human-Computer Interaction', tier: 'A*', foundedYear: 1988, location: 'Pittsburgh, United States' },
  { name: 'ACM Conference on Computer-Supported Cooperative Work', acronym: 'CSCW', field: 'Human-Computer Interaction', tier: 'A', foundedYear: 1986, location: 'Minneapolis, United States' },
  { name: 'International Conference on Intelligent User Interfaces', acronym: 'IUI', field: 'Human-Computer Interaction', tier: 'B', foundedYear: 1993, location: 'Greenville, United States' },
];

export const CONFERENCE_TRACKS = [
  'Main Track',
  'Oral',
  'Poster',
  'Industry Track',
  'Workshop',
  'Short Paper',
] as const;
