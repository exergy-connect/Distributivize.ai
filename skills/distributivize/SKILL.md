---
name: distributivize
description: Analyze JavaScript, Python, and Mojo codebases for suitability with the Distributive Compute Protocol (DCP). Detect embarrassingly parallel workloads, parameter sweeps, Monte Carlo simulations, brute-force search, batch inference, and other distributable execution patterns. Generate DCP suitability reports, migration guidance, topology recommendations (CPU vs GPU vs DCP), and starter scaffolding for distributed execution.
disable-model-invocation: true
---

# Distributivize

Analyze existing codebases and identify opportunities to migrate compute-heavy workloads to DCP-style distributed execution.

The skill focuses on practical migration boundaries:
- independent loops
- coarse-grained task execution
- parameter sweeps
- simulation batches
- brute-force searches
- retry-tolerant compute pipelines

It also identifies anti-patterns and recommends when local SIMD, GPU acceleration, or multicore execution are better choices than distribution.

## When to use

Use this skill when the user:

- wants to analyze a repo for DCP suitability
- asks whether a workload is embarrassingly parallel
- wants to migrate local compute workloads to distributed execution
- wants to reduce hyperscaler/cloud compute costs
- has Monte Carlo, parameter sweep, search, or batch inference workloads
- asks whether a workload should use:
  - local CPU
  - multiprocessing
  - SIMD/vectorization
  - GPU
  - DCP/distributed compute
- wants help restructuring scientific or computational code
- asks about coarse-grained distributed execution patterns

## Core heuristic

DCP is most suitable for workloads with:

- independent tasks
- coarse-grained execution
- compact inputs and outputs
- retry-safe execution
- minimal communication
- low synchronization requirements
- high compute-to-transfer ratio

DCP is generally unsuitable for workloads dominated by:

- tight synchronization
- large shared mutable state
- low-latency coordination
- dense tensor kernels
- tightly coupled distributed linear algebra
- high-frequency communication
- GPU-saturating batch operations

Do not assume distributed execution is automatically better.

Always compare:
- local CPU
- vectorized/SIMD execution
- GPU acceleration
- DCP/distributed execution

## Analysis procedure

When analyzing code:

1. Identify the dominant compute structure.
2. Detect loops, sweeps, simulations, inference batches, or independent jobs.
3. Determine whether iterations are independent.
4. Estimate compute granularity.
5. Identify serialization boundaries.
6. Detect:
   - shared state
   - file dependencies
   - network/socket usage
   - database coupling
   - GPU dependencies
   - synchronization requirements
7. Evaluate suitability for:
   - local multicore
   - SIMD/vectorization
   - GPU
   - DCP
8. Recommend the least invasive optimization path first.
9. Generate DCP scaffolding only when the workload is a credible candidate.

## Strong DCP candidates

Typical strong candidates include:

- Monte Carlo simulations
- parameter sweeps
- hyperparameter search
- brute-force combinatorial search
- independent model evaluation
- cross-validation sweeps
- rendering batches
- scientific simulation ensembles
- chunked data processing
- batch inference with independent inputs

## Weak DCP candidates

Typical weak candidates include:

- tightly synchronized model training
- all-reduce heavy distributed workloads
- real-time serving pipelines
- latency-sensitive systems
- GPU-optimized dense tensor operations
- workloads dominated by I/O
- highly stateful systems
- database-heavy transaction processing

## GPU vs DCP guidance

Do not claim GPU is unsuitable merely because an algorithm is iterative.

Instead:

- GPU acceleration is often preferable for:
  - dense tensor operations
  - large matrix math
  - SIMD-friendly kernels
  - batched numerical workloads
  - vectorizable computation

- DCP is often preferable for:
  - coarse-grained independent jobs
  - parameter sweeps
  - simulation ensembles
  - retry-tolerant workloads
  - workloads with minimal communication

Some workloads benefit from both:
- GPU inside each task
- DCP across tasks

Always explain the tradeoffs clearly.

## Cloud-cost framing

Frame DCP as useful when projects hit scaling ceilings:

- free tiers become quotas
- APIs become rate limits
- cloud costs become operational constraints
- centralized compute economics stop making sense

Avoid overstating that developers are "locked out" of compute.

The more accurate framing is:
- easy to start
- increasingly expensive to scale

## Report format

Return a structured report with:

### Summary

Classify the workload as:
- Strong DCP candidate
- Possible DCP candidate with restructuring
- Better suited to GPU/local optimization
- Poor DCP candidate

### Suitability score

Provide a 0–100 score.

Suggested interpretation:
- 85–100: excellent DCP fit
- 65–84: likely fit with moderate restructuring
- 40–64: possible but uncertain
- 20–39: probably not worth distributing
- 0–19: poor fit

Explain the reasoning.

### Distributable regions

For each candidate region include:
- file/function/location
- workload type
- why it distributes well
- serialization concerns
- shared-state risks
- suggested batch size
- expected scaling characteristics

### Execution topology recommendation

Compare:
- local CPU
- multiprocessing
- SIMD/vectorization
- GPU
- DCP

Be explicit when DCP is not the best option.

### Migration plan

Provide incremental migration guidance:
1. isolate pure compute
2. remove shared mutable state
3. define serializable inputs/outputs
4. batch tasks
5. generate worker wrappers
6. benchmark locally
7. benchmark distributed execution
8. tune granularity

### Example scaffolding

Generate starter DCP-style pseudocode or wrapper examples when appropriate.

Do not present generated scaffolding as production-ready unless validated.

## JavaScript guidance

Look for:
- `for` loops
- `Promise.all`
- worker threads
- queue consumers
- batch processing
- combinatorial search
- image/data processing pipelines

Watch for:
- closure capture
- filesystem coupling
- mutable globals
- socket dependencies

## Python guidance

Look for:
- `multiprocessing`
- `joblib`
- `concurrent.futures`
- parameter grids
- sklearn sweeps
- simulation loops
- Monte Carlo workloads
- batch inference

Watch for:
- large DataFrame transfers
- notebook state
- GPU libraries
- local filesystem assumptions
- open handles
- non-serializable objects

## Mojo guidance

Mojo support may initially be heuristic.

Look for:
- explicit loops
- numeric kernels
- vectorization opportunities
- Python interop boundaries

Always consider whether local SIMD/vectorized optimization should precede distributed execution.

## Output style

Be direct and skeptical.

Do not over-recommend DCP.

If the workload is a poor fit, say so clearly and recommend a better execution topology.

Prioritize actionable engineering guidance:
- what to extract
- what to batch
- what to serialize
- what to benchmark
- what to avoid

## Example assessment language

Strong fit:

> This workload is a strong DCP candidate. The dominant computation is a parameter sweep over independent inputs with compact outputs and no inter-worker communication requirements.

Possible fit:

> This workload could be distributivized, but only after restructuring shared mutable state and isolating filesystem dependencies.

Poor fit:

> This workload is dominated by synchronization and dense tensor operations. Local GPU acceleration is likely a better first optimization step than DCP.

## Safety and correctness

Always recommend:
- correctness validation
- reproducible seeds
- idempotent retries
- local benchmarking
- distributed benchmarking
- logging task inputs/outputs

Never promise speedups without evidence.