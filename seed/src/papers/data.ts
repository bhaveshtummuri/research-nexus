/**
 * Fragments assembled into paper titles and abstracts.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

export const TITLE_PATTERNS = [
  '{approach} {approach_noun} for {topic}',
  '{topic}: {contribution}',
  'Towards {qualifier} {topic}',
  'On the {property} of {topic}',
  '{contribution} in {topic}',
  'Rethinking {topic} with {approach} {approach_noun}',
  'A {qualifier} Framework for {topic}',
  '{topic} at Scale: {contribution}',
  'How {qualifier} is {topic}? {contribution}',
  'Beyond {baseline}: {contribution} for {topic}',
] as const;

export const APPROACHES = [
  'Hierarchical',
  'Self-Supervised',
  'Probabilistic',
  'Differentiable',
  'Compositional',
  'Adaptive',
  'Distributed',
  'Sparse',
  'Equivariant',
  'Contrastive',
  'Amortised',
  'End-to-End',
  'Physics-Informed',
  'Attention-Based',
  'Simulation-Driven',
] as const;

export const APPROACH_NOUNS = [
  'Models',
  'Methods',
  'Architectures',
  'Estimation',
  'Optimisation',
  'Inference',
  'Representations',
  'Pipelines',
  'Encoders',
  'Solvers',
] as const;

export const QUALIFIERS = [
  'Robust',
  'Interpretable',
  'Scalable',
  'Efficient',
  'Reproducible',
  'Data-Efficient',
  'Verifiable',
  'Generalisable',
  'Low-Latency',
  'Privacy-Preserving',
] as const;

export const PROPERTIES = [
  'Sample Complexity',
  'Generalisation Behaviour',
  'Computational Limits',
  'Statistical Efficiency',
  'Failure Modes',
  'Convergence Guarantees',
  'Expressive Power',
  'Empirical Reliability',
] as const;

export const CONTRIBUTIONS = [
  'A Large-Scale Empirical Study',
  'Benchmarks and Baselines',
  'An Open Evaluation Protocol',
  'Theory and Practice',
  'Lessons from Deployment',
  'A Systematic Review',
  'New Bounds and Algorithms',
  'A Reproducible Pipeline',
  'Evidence from Multi-Site Trials',
  'Design Principles and Trade-offs',
  'A Unified Formulation',
  'Measurement and Mitigation',
] as const;

export const BASELINES = [
  'Grid Search',
  'Static Heuristics',
  'Single-Site Evaluation',
  'Hand-Tuned Pipelines',
  'Point Estimates',
  'Synthetic Benchmarks',
  'Centralised Training',
] as const;

export const ABSTRACT_PROBLEM = [
  'Progress in {topic} is limited by evaluation protocols that do not transfer between laboratories.',
  'Existing approaches to {topic} scale poorly once the input distribution shifts.',
  'Practitioners working on {topic} lack tooling that makes results reproducible across sites.',
  'Current {topic} methods trade accuracy for interpretability in ways that are rarely quantified.',
  'The cost of state-of-the-art {topic} pipelines puts them out of reach for most research groups.',
  'Results reported for {topic} are difficult to compare because baselines differ between papers.',
] as const;

export const ABSTRACT_METHOD = [
  'We introduce a {qualifier_lower} formulation that separates representation from inference, allowing each component to be validated independently.',
  'Our approach combines {keyword_a} with {keyword_b}, yielding a pipeline that is both auditable and straightforward to retrain.',
  'We present an open framework that couples {keyword_a} to an explicit uncertainty model, making the failure surface visible before deployment.',
  'The method replaces hand-tuned heuristics with a learned component trained under an explicit {keyword_a} objective.',
  'We derive bounds relating {keyword_a} to observed error and use them to design a practical {keyword_b} procedure.',
] as const;

export const ABSTRACT_RESULT = [
  'Across {study_count} independent settings the method improves on strong baselines while using {reduction} percent less compute.',
  'Evaluated on {study_count} datasets, it matches specialised systems and generalises to two domains it was never trained on.',
  'We report a {reduction} percent reduction in error on held-out sites and release all code, configurations and analysis notebooks.',
  'The framework recovers known results on {study_count} benchmarks and surfaces two effects that prior protocols could not detect.',
  'A {study_count}-site replication confirms the effect, with confidence intervals reported for every comparison.',
] as const;

export const ABSTRACT_IMPLICATION = [
  'We argue this reframes {topic} as an engineering problem rather than a modelling one.',
  'These findings suggest that reporting standards for {topic} need to change.',
  'The released artefacts lower the barrier for smaller groups to contribute to {topic}.',
  'We outline the open questions this raises for the next generation of {topic} systems.',
  'Our analysis identifies which design decisions actually drive performance in {topic}.',
] as const;
