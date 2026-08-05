/**
 * Journal vocabulary: 30 peer-reviewed venues.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface JournalSeed {
  name: string;
  publisher: string;
  field: string;
  impactFactor: number;
}

/** 30 journals, weighted so a handful of high-impact venues dominate citations. */
export const JOURNALS: readonly JournalSeed[] = [
  { name: 'Nature', publisher: 'Springer Nature', field: 'Multidisciplinary', impactFactor: 64.8 },
  { name: 'Science', publisher: 'AAAS', field: 'Multidisciplinary', impactFactor: 56.9 },
  { name: 'Nature Machine Intelligence', publisher: 'Springer Nature', field: 'Artificial Intelligence', impactFactor: 23.8 },
  { name: 'Journal of Machine Learning Research', publisher: 'JMLR Inc.', field: 'Artificial Intelligence', impactFactor: 6.0 },
  { name: 'Transactions on Pattern Analysis and Machine Intelligence', publisher: 'IEEE', field: 'Artificial Intelligence', impactFactor: 23.6 },
  { name: 'Artificial Intelligence', publisher: 'Elsevier', field: 'Artificial Intelligence', impactFactor: 14.4 },
  { name: 'Nature Biotechnology', publisher: 'Springer Nature', field: 'Computational Biology', impactFactor: 46.9 },
  { name: 'Bioinformatics', publisher: 'Oxford University Press', field: 'Computational Biology', impactFactor: 5.8 },
  { name: 'PLOS Computational Biology', publisher: 'PLOS', field: 'Computational Biology', impactFactor: 4.3 },
  { name: 'Genome Biology', publisher: 'Springer Nature', field: 'Computational Biology', impactFactor: 12.3 },
  { name: 'Nature Physics', publisher: 'Springer Nature', field: 'Quantum Information', impactFactor: 19.6 },
  { name: 'PRX Quantum', publisher: 'American Physical Society', field: 'Quantum Information', impactFactor: 9.7 },
  { name: 'Quantum', publisher: 'Verein zur Forderung des Open Access', field: 'Quantum Information', impactFactor: 6.4 },
  { name: 'Nature Climate Change', publisher: 'Springer Nature', field: 'Climate Science', impactFactor: 29.6 },
  { name: 'Journal of Climate', publisher: 'American Meteorological Society', field: 'Climate Science', impactFactor: 4.9 },
  { name: 'Earth System Dynamics', publisher: 'Copernicus', field: 'Climate Science', impactFactor: 7.4 },
  { name: 'Nature Materials', publisher: 'Springer Nature', field: 'Materials Science', impactFactor: 41.2 },
  { name: 'Advanced Materials', publisher: 'Wiley', field: 'Materials Science', impactFactor: 29.4 },
  { name: 'Acta Materialia', publisher: 'Elsevier', field: 'Materials Science', impactFactor: 9.4 },
  { name: 'Nature Neuroscience', publisher: 'Springer Nature', field: 'Neuroscience', impactFactor: 25.0 },
  { name: 'Neuron', publisher: 'Cell Press', field: 'Neuroscience', impactFactor: 16.2 },
  { name: 'Journal of Neuroscience', publisher: 'Society for Neuroscience', field: 'Neuroscience', impactFactor: 5.3 },
  { name: 'ACM Transactions on Privacy and Security', publisher: 'ACM', field: 'Cybersecurity', impactFactor: 3.0 },
  { name: 'IEEE Transactions on Information Forensics and Security', publisher: 'IEEE', field: 'Cybersecurity', impactFactor: 6.8 },
  { name: 'Journal of Cryptology', publisher: 'Springer', field: 'Cybersecurity', impactFactor: 3.6 },
  { name: 'Science Robotics', publisher: 'AAAS', field: 'Robotics', impactFactor: 26.1 },
  { name: 'IEEE Transactions on Robotics', publisher: 'IEEE', field: 'Robotics', impactFactor: 9.4 },
  { name: 'The VLDB Journal', publisher: 'Springer', field: 'Data Systems', impactFactor: 4.2 },
  { name: 'ACM Transactions on Database Systems', publisher: 'ACM', field: 'Data Systems', impactFactor: 2.4 },
  { name: 'ACM Transactions on Computer-Human Interaction', publisher: 'ACM', field: 'Human-Computer Interaction', impactFactor: 4.2 },
];
