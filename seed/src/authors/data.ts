/**
 * Name pools used to compose author identities.
 *
 * Names are drawn from a broad set of linguistic origins so the generated
 * collaboration graph looks like a real international research community rather
 * than a single region. 72 given names and 78 family names give well over
 * 5,000 unique combinations for the 300 authors we need.
 */

export const GIVEN_NAMES = [
  'Aisha', 'Alejandro', 'Amara', 'Ana', 'Anders', 'Anika', 'Antoine', 'Arjun',
  'Astrid', 'Beatriz', 'Bilal', 'Camila', 'Carlos', 'Chidi', 'Chloe', 'Daniela',
  'Dmitri', 'Elena', 'Elias', 'Emeka', 'Emil', 'Esther', 'Fatima', 'Felipe',
  'Gabriel', 'Giulia', 'Hana', 'Hiroshi', 'Ibrahim', 'Ingrid', 'Isabel', 'Ivan',
  'Jae-won', 'Javier', 'Johanna', 'Jonas', 'Julia', 'Kaito', 'Kwame', 'Lars',
  'Leila', 'Liang', 'Lucia', 'Mahdi', 'Maria', 'Mateo', 'Meera', 'Mei',
  'Mikhail', 'Nadia', 'Naledi', 'Ngozi', 'Nikolai', 'Nina', 'Olga', 'Omar',
  'Priya', 'Rafael', 'Rania', 'Ravi', 'Rosa', 'Samuel', 'Sanjay', 'Sofia',
  'Soo-jin', 'Tariq', 'Tomas', 'Valentina', 'Wei', 'Yara', 'Yuki', 'Zainab',
] as const;

export const FAMILY_NAMES = [
  'Abadi', 'Adeyemi', 'Aggarwal', 'Almeida', 'Andersson', 'Bakker', 'Baptista', 'Bergman',
  'Bianchi', 'Blanchard', 'Cardoso', 'Castillo', 'Chandra', 'Chen', 'Cheng', 'Costa',
  'Dahl', 'Dubois', 'Duarte', 'Eriksen', 'Falkner', 'Ferreira', 'Fontaine', 'Gagnon',
  'Ghosh', 'Gruber', 'Haddad', 'Hansen', 'Hoffmann', 'Ibarra', 'Ikeda', 'Iyer',
  'Jansen', 'Kaur', 'Kimura', 'Klein', 'Kobayashi', 'Kowalski', 'Kumar', 'Larsen',
  'Lindqvist', 'Lombardi', 'Mahmoud', 'Marchetti', 'Mbeki', 'Mendes', 'Mensah', 'Moreau',
  'Nakamura', 'Navarro', 'Nguyen', 'Nowak', 'Okafor', 'Oliveira', 'Ortiz', 'Patel',
  'Petrov', 'Rahman', 'Ramirez', 'Reyes', 'Rossi', 'Sadeghi', 'Salazar', 'Sarkar',
  'Schmidt', 'Silva', 'Sorensen', 'Steiner', 'Suzuki', 'Tanaka', 'Torres', 'Vargas',
  'Vasquez', 'Virtanen', 'Wagner', 'Wang', 'Yamamoto', 'Zhao',
] as const;

/**
 * Academic ranks with the relative frequency they occur at in a department and
 * the seniority band that drives career length, h-index and paper volume.
 */
export const ACADEMIC_TITLES = [
  { title: 'PhD Candidate', weight: 14, seniority: 1 },
  { title: 'Postdoctoral Researcher', weight: 16, seniority: 2 },
  { title: 'Research Scientist', weight: 14, seniority: 3 },
  { title: 'Assistant Professor', weight: 16, seniority: 3 },
  { title: 'Associate Professor', weight: 15, seniority: 4 },
  { title: 'Professor', weight: 15, seniority: 5 },
  { title: 'Distinguished Professor', weight: 5, seniority: 6 },
  { title: 'Department Chair', weight: 5, seniority: 6 },
] as const;

export const AFFILIATION_ROLES = [
  'Faculty',
  'Principal Investigator',
  'Group Lead',
  'Visiting Researcher',
  'Adjunct Faculty',
  'Doctoral Researcher',
] as const;

/**
 * Sentence fragments assembled into an author's research statement. Keeping the
 * three parts separate produces varied prose without a template ever repeating
 * verbatim across 300 profiles.
 */
export const STATEMENT_OPENERS = [
  'Builds systems that make',
  'Investigates the theoretical foundations of',
  'Develops scalable methods for',
  'Studies the societal implications of',
  'Designs measurement techniques for',
  'Applies formal reasoning to',
  'Leads a laboratory focused on',
  'Bridges experimental and computational approaches to',
] as const;

export const STATEMENT_CLOSERS = [
  'with an emphasis on reproducibility and open tooling.',
  'in collaboration with industry and public-sector partners.',
  'while training the next generation of graduate researchers.',
  'across both simulation and real-world deployments.',
  'with particular attention to fairness and accountability.',
  'using large-scale empirical evaluation.',
  'grounded in long-running field studies.',
  'supported by multi-institution consortia.',
] as const;
