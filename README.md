# distributivize

`distributivize` is a prototype developer tool for migrating existing JavaScript, Python, and Mojo compute workloads to the Distributive Compute Protocol (DCP).

It follows the core workflow:

1. analyze existing source code
2. identify distributable regions
3. produce a DCP suitability report
4. generate starter DCP wrapper scaffolding

## Install Notes

### Install script (recommended)

Run from your project root:

```bash
bash <(curl -fsSL https://exergy-connect.github.io/xFrame.ai/install-skills.sh)
```

This installs both skills into `.cursor/skills/` and records the installed suite version.

To check the installed version later:

```bash
bash <(curl -fsSL https://exergy-connect.github.io/xFrame.ai/install-skills.sh) --check
```

### Local distributivize skill installer

This repository also includes a standalone installer for the `distributivize` skill:

```bash
bash install_cursor.sh
```

It installs the skill into `$HOME/.cursor/skills/distributivize` and records the version in `$HOME/.cursor/skills/.distributivize-latest`.

## CLI Install and Run

```bash
npm install
npm run build

node dist/cli.js analyze ./samples
node dist/cli.js generate ./samples
```

After linking or publishing, the intended CLI shape is:

```bash
distributivize analyze ./project
distributivize generate ./project
```

Both commands write `.distributivize/report.json`. `generate` also writes wrapper examples to `.distributivize/wrappers`.

## What It Detects

The prototype looks for DCP-friendly compute patterns:

- embarrassingly parallel loops
- independent iterations
- parameter sweeps
- Monte Carlo simulations
- map/reduce patterns
- batch inference
- retry-tolerant jobs
- minimal shared state
- high compute-to-transfer ratio

JavaScript and TypeScript files are parsed with Babel. Python and Mojo are currently heuristic/text-based so the architecture can demonstrate the plugin boundary before deeper AST support lands.

## Suitability Report

Each candidate includes:

- suitability score
- estimated task granularity
- serialization concerns
- shared-state warnings
- batching recommendations
- expected scaling characteristics
- advice on when SIMD/GPU/local optimization may be preferable

Scores are intentionally conservative. A high score means the region looks promising, not that it is production-safe to distribute without review.

## Good DCP Candidates

DCP is strongest when work can be split into many independent tasks with compact inputs and outputs. Good examples include:

- Monte Carlo sampling where each worker can use its own random seed
- parameter or hyperparameter sweeps
- brute-force combinatorial search over independent branches
- batch inference with explicit model inputs and compact prediction outputs
- map/reduce jobs where partial results can be merged after execution

## Anti-Patterns

Be cautious when code depends on:

- mutable global state
- cross-iteration dependencies
- open file handles, sockets, database connections, or process-local environment
- large object graphs that are expensive to serialize
- very tiny tasks where scheduler and transfer overhead dominate
- nondeterministic side effects that make retries unsafe

The tool flags these as serialization concerns or shared-state warnings when it sees likely indicators.

## DCP vs GPU Acceleration

DCP distributes work across remote or decentralized workers. GPU acceleration speeds up local data-parallel kernels on one machine.

Prefer GPU/SIMD first when:

- the workload is a dense numeric kernel over arrays or tensors
- data transfer would dwarf compute time
- tasks are very small
- a single host already has enough memory and accelerator throughput

Prefer DCP when:

- the workload is naturally split into independent jobs
- each job has enough compute to amortize scheduling and transfer
- retries are acceptable
- partial results are compact
- horizontal scaling matters more than single-device latency

Many migrations use both: optimize the per-task kernel locally, then distribute batches of those optimized kernels through DCP.

## Incremental Migration

Start by isolating pure functions. Make every distributed unit accept explicit serializable inputs and return compact serializable outputs. Then batch many iterations into each task, run a small correctness check locally, and only then submit larger jobs to DCP.

The generated wrappers are deliberately scaffold code. They show chunking, retry-oriented structure, and result merging locations, but you still need to connect them to your DCP client package and original workload.

## Architecture

The project is plugin-oriented:

- `src/core` contains report types, scoring, project walking, and JSON output
- `src/analyzers` contains language analyzers
- `src/report` formats console output
- `src/generate` creates DCP wrapper scaffolds
- `samples` contains representative workloads

Future plugins can add:

- deeper AST analysis
- runtime profiling
- Mojo AST support
- cloud cost estimation
- automatic code rewriting
- topology selection across local CPU, GPU, and DCP
