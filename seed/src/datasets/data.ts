/**
 * Dataset vocabulary.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export interface DatasetSeed {
  name: string;
  domain: string;
  license: string;
  sizeGb: number;
  releaseYear: number;
}

/** 40 datasets spanning every field, so USES_DATASET links across domains. */
export const DATASETS: readonly DatasetSeed[] = [
  { name: 'OpenGraph-Bench', domain: 'Artificial Intelligence', license: 'CC BY 4.0', sizeGb: 240, releaseYear: 2019 },
  { name: 'MultiModal-10M', domain: 'Artificial Intelligence', license: 'CC BY-NC 4.0', sizeGb: 1840, releaseYear: 2021 },
  { name: 'FairEval Corpus', domain: 'Artificial Intelligence', license: 'MIT', sizeGb: 42, releaseYear: 2018 },
  { name: 'LongContext-QA', domain: 'Artificial Intelligence', license: 'Apache 2.0', sizeGb: 96, releaseYear: 2022 },
  { name: 'ContinualStream', domain: 'Artificial Intelligence', license: 'CC BY 4.0', sizeGb: 310, releaseYear: 2020 },
  { name: 'ProteinAtlas-Structures', domain: 'Computational Biology', license: 'CC0 1.0', sizeGb: 780, releaseYear: 2018 },
  { name: 'SingleCell-Compendium', domain: 'Computational Biology', license: 'CC BY 4.0', sizeGb: 1250, releaseYear: 2020 },
  { name: 'MetaGut-Reference', domain: 'Computational Biology', license: 'ODbL', sizeGb: 640, releaseYear: 2017 },
  { name: 'VariantCall-Gold', domain: 'Computational Biology', license: 'CC BY 4.0', sizeGb: 88, releaseYear: 2016 },
  { name: 'SpatialOmics-Tissue', domain: 'Computational Biology', license: 'CC BY-NC 4.0', sizeGb: 420, releaseYear: 2022 },
  { name: 'QubitBench', domain: 'Quantum Information', license: 'Apache 2.0', sizeGb: 18, releaseYear: 2020 },
  { name: 'SurfaceCode-Traces', domain: 'Quantum Information', license: 'MIT', sizeGb: 64, releaseYear: 2021 },
  { name: 'PhotonLab-Archive', domain: 'Quantum Information', license: 'CC BY 4.0', sizeGb: 130, releaseYear: 2019 },
  { name: 'ERA-Reanalysis-Extended', domain: 'Climate Science', license: 'CC BY 4.0', sizeGb: 4200, releaseYear: 2015 },
  { name: 'CMIP-Ensemble-Subset', domain: 'Climate Science', license: 'CC BY 4.0', sizeGb: 3100, releaseYear: 2019 },
  { name: 'GlacierWatch', domain: 'Climate Science', license: 'ODbL', sizeGb: 210, releaseYear: 2018 },
  { name: 'OceanFloat-Profiles', domain: 'Climate Science', license: 'CC0 1.0', sizeGb: 560, releaseYear: 2016 },
  { name: 'ExtremeEvent-Catalogue', domain: 'Climate Science', license: 'CC BY 4.0', sizeGb: 75, releaseYear: 2021 },
  { name: 'MatProj-Snapshot', domain: 'Materials Science', license: 'CC BY 4.0', sizeGb: 190, releaseYear: 2017 },
  { name: 'PerovskiteLab-Runs', domain: 'Materials Science', license: 'CC BY 4.0', sizeGb: 54, releaseYear: 2020 },
  { name: 'AlloyMicrostructure-3D', domain: 'Materials Science', license: 'CC BY-NC 4.0', sizeGb: 880, releaseYear: 2021 },
  { name: 'MOF-Adsorption-DB', domain: 'Materials Science', license: 'ODbL', sizeGb: 36, releaseYear: 2016 },
  { name: 'HumanConnectome-Extended', domain: 'Neuroscience', license: 'CC BY-NC 4.0', sizeGb: 2600, releaseYear: 2015 },
  { name: 'CalciumImaging-Cortex', domain: 'Neuroscience', license: 'CC BY 4.0', sizeGb: 940, releaseYear: 2019 },
  { name: 'NeuroPixels-Recordings', domain: 'Neuroscience', license: 'CC BY 4.0', sizeGb: 1480, releaseYear: 2020 },
  { name: 'SleepStage-Cohort', domain: 'Neuroscience', license: 'DUA required', sizeGb: 320, releaseYear: 2018 },
  { name: 'MalwareCapture-2023', domain: 'Cybersecurity', license: 'Research use only', sizeGb: 410, releaseYear: 2023 },
  { name: 'NetFlow-Campus', domain: 'Cybersecurity', license: 'DUA required', sizeGb: 1120, releaseYear: 2019 },
  { name: 'PQC-Testvectors', domain: 'Cybersecurity', license: 'CC0 1.0', sizeGb: 8, releaseYear: 2021 },
  { name: 'SideChannel-Traces', domain: 'Cybersecurity', license: 'CC BY 4.0', sizeGb: 260, releaseYear: 2018 },
  { name: 'GraspNet-Extended', domain: 'Robotics', license: 'CC BY-NC 4.0', sizeGb: 720, releaseYear: 2020 },
  { name: 'UrbanDrive-Sequences', domain: 'Robotics', license: 'CC BY-NC-SA 4.0', sizeGb: 3400, releaseYear: 2019 },
  { name: 'LeggedGait-Logs', domain: 'Robotics', license: 'MIT', sizeGb: 150, releaseYear: 2021 },
  { name: 'TactileTouch-Corpus', domain: 'Robotics', license: 'CC BY 4.0', sizeGb: 95, releaseYear: 2022 },
  { name: 'GraphQuery-Workloads', domain: 'Data Systems', license: 'Apache 2.0', sizeGb: 68, releaseYear: 2020 },
  { name: 'StreamBench-Traces', domain: 'Data Systems', license: 'MIT', sizeGb: 220, releaseYear: 2018 },
  { name: 'VectorSearch-1B', domain: 'Data Systems', license: 'CC BY 4.0', sizeGb: 1900, releaseYear: 2022 },
  { name: 'InteractionLog-Lab', domain: 'Human-Computer Interaction', license: 'DUA required', sizeGb: 44, releaseYear: 2019 },
  { name: 'GazeTrack-Studies', domain: 'Human-Computer Interaction', license: 'CC BY 4.0', sizeGb: 130, releaseYear: 2020 },
  { name: 'AccessibilityAudit-Web', domain: 'Human-Computer Interaction', license: 'ODbL', sizeGb: 22, releaseYear: 2021 },
];

export const DATASET_USAGE_TYPES = [
  'training',
  'evaluation',
  'validation',
  'ablation',
  'replication',
] as const;
