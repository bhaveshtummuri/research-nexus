/**
 * Research topic vocabulary: 100 topics across 10 fields.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface TopicSeed {
  name: string;
  field: string;
  /** Year the topic became a recognisable research area, used for trend maths. */
  emergenceYear: number;
}

export const RESEARCH_FIELDS = [
  'Artificial Intelligence',
  'Computational Biology',
  'Quantum Information',
  'Climate Science',
  'Materials Science',
  'Neuroscience',
  'Cybersecurity',
  'Robotics',
  'Data Systems',
  'Human-Computer Interaction',
] as const;

export type ResearchField = (typeof RESEARCH_FIELDS)[number];

/**
 * 100 research topics, ten per field. Emergence years are staggered so the
 * trending-topics query has genuine signal to find: newer topics accelerate
 * while established ones plateau.
 */
export const TOPICS: readonly TopicSeed[] = [
  { name: 'Graph Neural Networks', field: 'Artificial Intelligence', emergenceYear: 2017 },
  { name: 'Retrieval-Augmented Generation', field: 'Artificial Intelligence', emergenceYear: 2021 },
  { name: 'Federated Learning', field: 'Artificial Intelligence', emergenceYear: 2017 },
  { name: 'Mechanistic Interpretability', field: 'Artificial Intelligence', emergenceYear: 2022 },
  { name: 'Reinforcement Learning from Human Feedback', field: 'Artificial Intelligence', emergenceYear: 2020 },
  { name: 'Causal Representation Learning', field: 'Artificial Intelligence', emergenceYear: 2019 },
  { name: 'Algorithmic Fairness', field: 'Artificial Intelligence', emergenceYear: 2016 },
  { name: 'Neural Architecture Search', field: 'Artificial Intelligence', emergenceYear: 2017 },
  { name: 'Multimodal Representation Learning', field: 'Artificial Intelligence', emergenceYear: 2020 },
  { name: 'Continual Learning', field: 'Artificial Intelligence', emergenceYear: 2018 },

  { name: 'Protein Structure Prediction', field: 'Computational Biology', emergenceYear: 2018 },
  { name: 'Single-Cell Transcriptomics', field: 'Computational Biology', emergenceYear: 2016 },
  { name: 'Genome-Wide Association Studies', field: 'Computational Biology', emergenceYear: 2007 },
  { name: 'Metagenomic Assembly', field: 'Computational Biology', emergenceYear: 2012 },
  { name: 'Molecular Docking', field: 'Computational Biology', emergenceYear: 2005 },
  { name: 'Synthetic Gene Circuits', field: 'Computational Biology', emergenceYear: 2014 },
  { name: 'Spatial Omics', field: 'Computational Biology', emergenceYear: 2021 },
  { name: 'Cryo-EM Reconstruction', field: 'Computational Biology', emergenceYear: 2015 },
  { name: 'Phylogenetic Inference', field: 'Computational Biology', emergenceYear: 2003 },
  { name: 'Antimicrobial Resistance Modelling', field: 'Computational Biology', emergenceYear: 2019 },

  { name: 'Quantum Error Correction', field: 'Quantum Information', emergenceYear: 2015 },
  { name: 'Variational Quantum Algorithms', field: 'Quantum Information', emergenceYear: 2018 },
  { name: 'Topological Qubits', field: 'Quantum Information', emergenceYear: 2016 },
  { name: 'Quantum Key Distribution', field: 'Quantum Information', emergenceYear: 2009 },
  { name: 'Quantum Advantage Benchmarking', field: 'Quantum Information', emergenceYear: 2019 },
  { name: 'Photonic Quantum Computing', field: 'Quantum Information', emergenceYear: 2017 },
  { name: 'Quantum Machine Learning', field: 'Quantum Information', emergenceYear: 2019 },
  { name: 'Superconducting Circuits', field: 'Quantum Information', emergenceYear: 2012 },
  { name: 'Quantum Sensing', field: 'Quantum Information', emergenceYear: 2018 },
  { name: 'Fault-Tolerant Compilation', field: 'Quantum Information', emergenceYear: 2021 },

  { name: 'Regional Climate Downscaling', field: 'Climate Science', emergenceYear: 2011 },
  { name: 'Carbon Capture and Storage', field: 'Climate Science', emergenceYear: 2013 },
  { name: 'Extreme Event Attribution', field: 'Climate Science', emergenceYear: 2018 },
  { name: 'Ocean Heat Uptake', field: 'Climate Science', emergenceYear: 2014 },
  { name: 'Permafrost Feedback Modelling', field: 'Climate Science', emergenceYear: 2017 },
  { name: 'Atmospheric Aerosol Dynamics', field: 'Climate Science', emergenceYear: 2010 },
  { name: 'Renewable Grid Integration', field: 'Climate Science', emergenceYear: 2016 },
  { name: 'Earth System Emulators', field: 'Climate Science', emergenceYear: 2021 },
  { name: 'Glacial Mass Balance', field: 'Climate Science', emergenceYear: 2012 },
  { name: 'Climate Risk Analytics', field: 'Climate Science', emergenceYear: 2020 },

  { name: 'Perovskite Photovoltaics', field: 'Materials Science', emergenceYear: 2015 },
  { name: 'Solid-State Electrolytes', field: 'Materials Science', emergenceYear: 2017 },
  { name: 'Two-Dimensional Materials', field: 'Materials Science', emergenceYear: 2012 },
  { name: 'High-Entropy Alloys', field: 'Materials Science', emergenceYear: 2016 },
  { name: 'Metal-Organic Frameworks', field: 'Materials Science', emergenceYear: 2011 },
  { name: 'Autonomous Materials Discovery', field: 'Materials Science', emergenceYear: 2021 },
  { name: 'Additive Manufacturing Microstructure', field: 'Materials Science', emergenceYear: 2018 },
  { name: 'Thermoelectric Conversion', field: 'Materials Science', emergenceYear: 2013 },
  { name: 'Self-Healing Polymers', field: 'Materials Science', emergenceYear: 2019 },
  { name: 'Neuromorphic Memristors', field: 'Materials Science', emergenceYear: 2020 },

  { name: 'Connectome Mapping', field: 'Neuroscience', emergenceYear: 2014 },
  { name: 'Brain-Computer Interfaces', field: 'Neuroscience', emergenceYear: 2016 },
  { name: 'Neural Decoding', field: 'Neuroscience', emergenceYear: 2015 },
  { name: 'Synaptic Plasticity Models', field: 'Neuroscience', emergenceYear: 2010 },
  { name: 'Optogenetic Circuit Dissection', field: 'Neuroscience', emergenceYear: 2013 },
  { name: 'Computational Psychiatry', field: 'Neuroscience', emergenceYear: 2018 },
  { name: 'Predictive Coding', field: 'Neuroscience', emergenceYear: 2017 },
  { name: 'Neuroimmune Signalling', field: 'Neuroscience', emergenceYear: 2020 },
  { name: 'Sleep and Memory Consolidation', field: 'Neuroscience', emergenceYear: 2011 },
  { name: 'Whole-Brain Simulation', field: 'Neuroscience', emergenceYear: 2019 },

  { name: 'Post-Quantum Cryptography', field: 'Cybersecurity', emergenceYear: 2018 },
  { name: 'Zero-Knowledge Proof Systems', field: 'Cybersecurity', emergenceYear: 2019 },
  { name: 'Supply Chain Integrity', field: 'Cybersecurity', emergenceYear: 2021 },
  { name: 'Side-Channel Analysis', field: 'Cybersecurity', emergenceYear: 2012 },
  { name: 'Confidential Computing', field: 'Cybersecurity', emergenceYear: 2020 },
  { name: 'Formal Verification of Protocols', field: 'Cybersecurity', emergenceYear: 2015 },
  { name: 'Intrusion Detection at Scale', field: 'Cybersecurity', emergenceYear: 2014 },
  { name: 'Privacy-Preserving Analytics', field: 'Cybersecurity', emergenceYear: 2017 },
  { name: 'Hardware Root of Trust', field: 'Cybersecurity', emergenceYear: 2016 },
  { name: 'Adversarial Robustness', field: 'Cybersecurity', emergenceYear: 2018 },

  { name: 'Dexterous Manipulation', field: 'Robotics', emergenceYear: 2018 },
  { name: 'Legged Locomotion', field: 'Robotics', emergenceYear: 2016 },
  { name: 'Visual-Inertial SLAM', field: 'Robotics', emergenceYear: 2014 },
  { name: 'Soft Robotic Actuators', field: 'Robotics', emergenceYear: 2017 },
  { name: 'Multi-Robot Coordination', field: 'Robotics', emergenceYear: 2015 },
  { name: 'Sim-to-Real Transfer', field: 'Robotics', emergenceYear: 2019 },
  { name: 'Surgical Robotics', field: 'Robotics', emergenceYear: 2013 },
  { name: 'Autonomous Driving Perception', field: 'Robotics', emergenceYear: 2017 },
  { name: 'Aerial Swarm Control', field: 'Robotics', emergenceYear: 2018 },
  { name: 'Tactile Sensing', field: 'Robotics', emergenceYear: 2020 },

  { name: 'Graph Query Optimisation', field: 'Data Systems', emergenceYear: 2018 },
  { name: 'Vector Similarity Search', field: 'Data Systems', emergenceYear: 2021 },
  { name: 'Stream Processing Semantics', field: 'Data Systems', emergenceYear: 2015 },
  { name: 'Serverless Data Pipelines', field: 'Data Systems', emergenceYear: 2019 },
  { name: 'Learned Index Structures', field: 'Data Systems', emergenceYear: 2018 },
  { name: 'Distributed Consensus', field: 'Data Systems', emergenceYear: 2012 },
  { name: 'Data Lineage and Provenance', field: 'Data Systems', emergenceYear: 2017 },
  { name: 'Columnar Storage Formats', field: 'Data Systems', emergenceYear: 2014 },
  { name: 'Approximate Query Processing', field: 'Data Systems', emergenceYear: 2016 },
  { name: 'Multi-Model Databases', field: 'Data Systems', emergenceYear: 2020 },

  { name: 'Mixed Reality Interaction', field: 'Human-Computer Interaction', emergenceYear: 2018 },
  { name: 'Accessible Interface Design', field: 'Human-Computer Interaction', emergenceYear: 2013 },
  { name: 'Human-AI Teaming', field: 'Human-Computer Interaction', emergenceYear: 2020 },
  { name: 'Eye-Tracking Analytics', field: 'Human-Computer Interaction', emergenceYear: 2014 },
  { name: 'Conversational Interfaces', field: 'Human-Computer Interaction', emergenceYear: 2019 },
  { name: 'Haptic Feedback Systems', field: 'Human-Computer Interaction', emergenceYear: 2016 },
  { name: 'Participatory Design Methods', field: 'Human-Computer Interaction', emergenceYear: 2012 },
  { name: 'Information Visualisation', field: 'Human-Computer Interaction', emergenceYear: 2010 },
  { name: 'Digital Wellbeing', field: 'Human-Computer Interaction', emergenceYear: 2019 },
  { name: 'Crowdsourced Evaluation', field: 'Human-Computer Interaction', emergenceYear: 2015 },
];
