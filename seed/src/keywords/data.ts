/**
 * Keyword vocabulary: 150 fine-grained terms.
 *
 * Vocabulary only - no logic. Kept beside the generator that consumes it so
 * everything about one entity lives in one directory.
 */

/**
 * 150 keywords. Keywords are deliberately more granular than topics: they are
 * the fine-grained signal the paper-similarity query uses when two papers share
 * no topic but clearly address the same problem.
 */
export const KEYWORDS: readonly string[] = [
  'attention mechanism', 'transformer', 'contrastive learning', 'self-supervision', 'knowledge distillation',
  'model compression', 'quantisation', 'sparse activation', 'mixture of experts', 'curriculum learning',
  'transfer learning', 'domain adaptation', 'few-shot learning', 'zero-shot inference', 'prompt engineering',
  'embedding space', 'latent diffusion', 'variational inference', 'bayesian optimisation', 'gaussian process',
  'message passing', 'node embedding', 'link prediction', 'community detection', 'centrality measure',
  'random walk', 'spectral clustering', 'graph partitioning', 'subgraph matching', 'temporal graph',
  'differential privacy', 'secure aggregation', 'homomorphic encryption', 'secure enclave', 'threat model',
  'lattice cryptography', 'digital signature', 'key exchange', 'side channel', 'fuzz testing',
  'formal proof', 'model checking', 'type system', 'static analysis', 'symbolic execution',
  'consensus protocol', 'replication log', 'query planner', 'cost model', 'index structure',
  'columnar layout', 'vectorised execution', 'write-ahead log', 'snapshot isolation', 'sharding strategy',
  'cache coherence', 'load balancing', 'autoscaling', 'observability', 'fault injection',
  'sequence alignment', 'variant calling', 'gene expression', 'protein folding', 'binding affinity',
  'cell type annotation', 'batch effect correction', 'pathway enrichment', 'crispr screen', 'biomarker discovery',
  'molecular dynamics', 'density functional theory', 'crystal structure', 'band gap', 'catalysis',
  'thin film deposition', 'electron microscopy', 'spectroscopy', 'phase transition', 'grain boundary',
  'qubit coherence', 'gate fidelity', 'entanglement', 'decoherence', 'quantum circuit',
  'error syndrome', 'stabiliser code', 'quantum annealing', 'photon detection', 'cryogenic control',
  'climate projection', 'emission scenario', 'radiative forcing', 'satellite observation', 'reanalysis dataset',
  'ensemble forecast', 'sea level rise', 'carbon sink', 'land use change', 'extreme precipitation',
  'spiking neuron', 'calcium imaging', 'electrophysiology', 'functional connectivity', 'cortical column',
  'receptive field', 'neural oscillation', 'dopamine signalling', 'behavioural task', 'lesion study',
  'motion planning', 'inverse kinematics', 'model predictive control', 'imitation learning', 'reward shaping',
  'sensor fusion', 'point cloud', 'depth estimation', 'grasp synthesis', 'compliant actuation',
  'user study', 'think-aloud protocol', 'cognitive load', 'affordance', 'usability heuristic',
  'gesture recognition', 'gaze estimation', 'presence', 'accessibility audit', 'design probe',
  'reproducibility', 'benchmark suite', 'ablation study', 'statistical significance', 'effect size',
  'open dataset', 'annotation guideline', 'inter-rater agreement', 'data augmentation', 'label noise',
  'edge deployment', 'real-time inference', 'energy efficiency', 'hardware accelerator', 'memory bandwidth',
  'distributed training', 'gradient compression', 'checkpointing', 'pipeline parallelism', 'throughput scaling',
];
