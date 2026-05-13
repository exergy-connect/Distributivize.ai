# Distributivize Report: MDANSE

**Project:** MDANSE — Molecular Dynamics Analysis for Neutron Scattering Experiments
**Repository:** <https://github.com/ISISNeutronMuon/MDANSE>
**Version analyzed:** 2.0.1
**Language:** Python (pure — no C/Cython extensions)
**License:** GPL-3.0

---

## Summary

**Classification: Strong DCP candidate**

MDANSE is a scientific computing framework for analyzing molecular dynamics trajectories, primarily to predict neutron scattering experimental results. Its architecture is built around an `IJob` base class that decomposes every analysis into independent `run_step(index)` calls — a textbook map-reduce pattern. Each step reads from a shared HDF5 trajectory file, computes independently, and returns a compact result that is accumulated by a `combine()` method. A `finalize()` step handles normalization, FFT, and file I/O.

MDANSE already supports single-node multicore parallelism via `multiprocessing.Process` with queue-based dispatch. A `_run_remote` stub exists from a removed Pyro-based distributed execution system. DCP could replace this as the distributed backend with minimal changes to individual job classes.

## Suitability Score: 82 / 100

**Reasoning:**

The existing `run_step`/`combine`/`finalize` architecture maps directly to DCP's task model. All ~40 analysis jobs follow this pattern, and all `run_step()` implementations are independent (with one minor exception in Voronoi). The score is not higher because:

- Trajectory data lives in HDF5 files on local disk, creating a data-access boundary for remote workers
- Some per-atom jobs have modest per-step compute (milliseconds), which may not justify distribution overhead for small systems
- The `combine()` reduction requires a coordinator to accumulate results before `finalize()` writes output

## Distributable Regions

### Region 1: Per-Atom Analysis Jobs

**Files:**

- `Framework/Jobs/MeanSquareDisplacement.py`
- `Framework/Jobs/DynamicIncoherentStructureFactor.py`
- `Framework/Jobs/VelocityCorrelationFunction.py`
- `Framework/Jobs/CartesianCorrelationFunction.py`
- `Framework/Jobs/PositionCorrelationFunction.py`
- `Framework/Jobs/DensityOfStates.py`
- `Framework/Jobs/CartesianPowerSpectrum.py`
- `Framework/Jobs/PositionPowerSpectrum.py`
- `Framework/Jobs/GaussianDynamicIncoherentStructureFactor.py`
- `Framework/Jobs/ElasticIncoherentStructureFactor.py`
- `Framework/Jobs/VanHoveFunctionSelf.py`

**Workload type:** Per-atom trajectory correlation and spectral analysis

**Why it distributes well:**

- `numberOfSteps = len(self.trajectory.atom_indices)` — one step per selected atom
- Each `run_step(index)` reads a single atom's trajectory slice, computes MSD / correlation / FFT, and returns a compact numpy array
- Steps are fully independent — no inter-atom communication
- `combine()` is a simple additive accumulation: `self._outputData[key] += result`
- For large systems (10k–100k atoms), this creates thousands of independent tasks

**Serialization concerns:**

- Input: atom index (int) + trajectory file path (string) + configuration parameters (small dict)
- Output: 1D or 2D numpy array (typically hundreds to low-thousands of floats)
- Compact inputs/outputs — excellent for distribution

**Shared-state risks:**

- Trajectory HDF5 file is read-only during analysis — workers need access to the same file
- `_outputData` accumulation happens only in `combine()`, which runs on the coordinator

**Suggested batch size:** 10–100 atoms per task (for systems with >1000 atoms)

**Expected scaling:** Near-linear for large systems (>>100 atoms). For small systems (<100 atoms), distribution overhead dominates.

### Region 2: Per-Q-Shell Analysis Jobs

**Files:**

- `Framework/Jobs/DynamicCoherentStructureFactor.py`
- `Framework/Jobs/CurrentCorrelationFunction.py`

**Workload type:** Per-Q-shell scattering function and current correlation computation

**Why it distributes well:**

- `numberOfSteps = n_shells` — one step per Q-vector shell
- Each `run_step(index)` loops over all trajectory frames and all atoms for a single Q shell, computing `exp(i*q.r)` density and cross-correlations
- Steps are independent across Q shells
- These are the most compute-intensive jobs in MDANSE — each step involves O(n_frames × n_atoms × n_q_vectors) complex exponentials and correlations
- CurrentCorrelationFunction additionally computes velocities via differentiation and uses `np.einsum()` for longitudinal/transverse decomposition — the single most expensive per-step job

**Serialization concerns:**

- Input: shell index + Q vectors for that shell (small-medium array)
- Output: per-element density arrays `rho[element]` of shape `(n_frames, n_q_vectors)` in complex64 — sizeable but manageable

**Shared-state risks:**

- Reads the full trajectory for every frame — each worker needs trajectory file access
- Variable unit cells (NPT simulations) read per-frame from trajectory

**Suggested batch size:** 1–5 Q shells per task

**Expected scaling:** Excellent. DCSF is the canonical "embarrassingly parallel over Q shells" workload. Highest compute-to-transfer ratio in the codebase.

### Region 3: Per-Frame Analysis Jobs

**Files:**

- `Framework/Jobs/DistanceHistogram.py`
- `Framework/Jobs/PairDistributionFunction.py`
- `Framework/Jobs/VanHoveFunctionDistinct.py`
- `Framework/Jobs/VanHoveFunctionSelf.py`
- `Framework/Jobs/StaticStructureFactor.py`
- `Framework/Jobs/XRayStaticStructureFactor.py`
- `Framework/Jobs/SolventAccessibleSurface.py`

**Workload type:** Per-frame pairwise distance computation, surface analysis, and structural properties

**Why it distributes well:**

- `numberOfSteps = n_frames` — one step per trajectory frame
- Each step reads one frame's coordinates, computes all pairwise distances O(N²) per frame, and bins into histograms
- Steps are independent across frames
- `combine()` accumulates histogram bins additively
- VanHoveFunctionDistinct is especially expensive: O(n_configs × N²) per time-lag step
- SolventAccessibleSurface builds KDTrees and computes sparse distance matrices per frame

**Serialization concerns:**

- Input: frame index (int)
- Output: 3D histogram array `(n_elements, n_elements, n_bins)` of float64 + scalar volume — compact

**Shared-state risks:**

- Trajectory file access needed per worker
- `van_hove_distinct` is a pure-Python/numpy function — no compiled extension concerns

**Suggested batch size:** 10–50 frames per task

**Expected scaling:** Good for long trajectories (1000+ frames). Per-frame N² pairwise computation is the bottleneck.

### Region 4: Per-Frame Lightweight Jobs

**Files:**

- `Framework/Jobs/RadiusOfGyration.py`
- `Framework/Jobs/RootMeanSquareDeviation.py`
- `Framework/Jobs/RootMeanSquareFluctuation.py`
- `Framework/Jobs/Eccentricity.py`
- `Framework/Jobs/Density.py`
- `Framework/Jobs/Temperature.py`
- `Framework/Jobs/AverageStructure.py`

**Workload type:** Per-frame property calculation

**Why it distributes well:**

- One step per frame, fully independent
- Lightweight computation per step

**Serialization concerns:** Minimal — scalar or small array outputs

**Suggested batch size:** 50–200 frames per task (batch aggressively since per-step compute is low)

**Expected scaling:** Marginal benefit from DCP unless trajectory has >10k frames. Local multicore is likely sufficient.

## Execution Topology Recommendation

| Workload | Local CPU | Multiprocessing | SIMD/Vectorization | GPU | DCP |
|---|---|---|---|---|---|
| Per-atom correlation (MSD, DISF, VCF) | Baseline | Good (already supported) | Already uses numpy vectorization | Possible but complex | **Excellent** for large systems |
| DCSF / CCF (per-Q-shell) | Slow for many shells | Good (already supported) | numpy exp/dot already vectorized | **Good candidate** for exp(i*q·r) | **Excellent** |
| PDF / Distance histogram (per-frame) | Baseline | Good (already supported) | van_hove_distinct uses numpy | Good for N² pairwise distances | **Good** for long trajectories |
| Lightweight per-frame (Density, Temperature) | **Sufficient** | Minor benefit | N/A | Overkill | **Not worth it** |

### When DCP is clearly better than local multicore

- Systems with >10,000 atoms running per-atom analyses (MSD, DISF) — thousands of independent tasks
- DCSF / CCF with many Q shells and large trajectories — each Q shell is expensive
- Long trajectories (>10,000 frames) with per-frame PDF/distance calculations
- When users need to run multiple analyses on the same trajectory (analysis sweep)

### When local multicore is sufficient

- Small systems (<1000 atoms) with short trajectories (<1000 frames)
- Lightweight per-frame analyses (density, temperature, gyration radius)
- Interactive/exploratory use where distribution latency matters

## Architecture Assessment

### Strengths (favorable for distribution)

1. **Clean map-reduce contract:** `run_step(index) -> (index, result)` is a pure function of trajectory data and index
2. **Simple reduction:** `combine(index, result)` is additive accumulation — natural distributed reduce
3. **Single-writer I/O:** `finalize()` handles all file output after all steps complete
4. **Pickle-safe trajectory:** `FileTrajBase.__getstate__/__setstate__` drops the HDF5 handle and re-opens by path on unpickle — each subprocess gets its own file handle
5. **JSON-serializable configuration:** all job parameters can be serialized for remote transmission
6. **No GPU, database, or network dependencies:** pure CPU + HDF5 file I/O
7. **Read-only singletons:** `ATOMS_DATABASE`, `PLATFORM`, `UNITS_MANAGER` load from JSON at import time and are never mutated
8. **Existing extension point:** `_run_remote` stub and `_runner` dispatch dict ready for a new backend

### Concerns

1. **HDF5 file coupling:** every `run_step()` reads from the trajectory HDF5 file via `self.trajectory`. Workers need either shared filesystem access, pre-staged file copies, or a trajectory-serving layer.
2. **Voronoi shared-state bug:** `Voronoi.run_step()` mutates `self.neighbourhood_hist` and `self.mean_volume` directly, violating the map-reduce contract. Needs refactoring before any parallelization.
3. **Global random state:** Q-vector generators use `np.random.seed()` (global state). Distributed workers would need explicit per-worker seed management for reproducibility.
4. **No GPU acceleration:** the codebase uses pure numpy/scipy with no GPU. The `exp(i*q·r)` kernels in DCSF/DISF would benefit from GPU inside DCP tasks for maximum throughput.
5. **Logging:** `LOG` handlers are process-local. Distributed execution needs a logging aggregation strategy.

## Migration Plan

### Phase 1: Isolate pure compute (minimal changes)

1. Factor `run_step()` into standalone functions that take serializable inputs, separating trajectory I/O from computation.

2. Create `TaskDescriptor` dataclasses for each job type:

```python
@dataclass
class MSDTaskDescriptor:
    trajectory_path: str
    atom_index: int
    first_frame: int
    last_frame: int
    step: int
    n_configs: int
    projection: str
```

### Phase 2: DCP worker wrapper

3. Create a generic MDANSE DCP worker:

```python
def mdanse_worker(task_descriptor: dict) -> dict:
    """Generic DCP worker for MDANSE analysis steps."""
    from MDANSE.MolecularDynamics.Trajectory import Trajectory

    job_type = task_descriptor["job_type"]
    traj = Trajectory(task_descriptor["trajectory_path"])

    if job_type == "msd":
        from MDANSE.MolecularDynamics.Analysis import mean_square_displacement
        series = traj.read_atomic_trajectory(
            task_descriptor["atom_index"],
            first=task_descriptor["first_frame"],
            last=task_descriptor["last_frame"],
            step=task_descriptor["frame_step"],
        )
        result = mean_square_displacement(series, task_descriptor["n_configs"])
        traj.close()
        return {"index": task_descriptor["step_index"],
                "element": task_descriptor["element"],
                "result": result.tolist()}

    # ... similar for dcsf, pdf, etc.
    traj.close()
    return {"index": task_descriptor["step_index"], "result": None}
```

### Phase 3: Integrate with IJob framework

4. Add a `"distributed"` running mode alongside `"single-core"` and `"multicore"`:

```python
_runner = {
    "single-core": _run_singlecore,
    "multicore": _run_multicore,
    "distributed": _run_distributed,
    "remote": _run_remote,
}
```

5. Implement `_run_distributed()` that submits `run_step` tasks to a DCP scheduler and collects results for `combine()`.

### Phase 4: Fix anti-patterns

6. Refactor `Voronoi.run_step()` to return results instead of mutating shared state.
7. Replace `np.random.seed()` with `np.random.default_rng(seed)` in Q-vector generators.

### Phase 5: Benchmark

8. Compare single-core vs. multicore vs. distributed for:
   - Small system MSD (~100 atoms, ~1000 frames)
   - Large system DCSF (~10,000 atoms, 100 Q shells, ~5000 frames)
   - Long-trajectory PDF (~1000 atoms, ~50,000 frames)

9. Tune task granularity — batch multiple atoms/frames per DCP task to amortize overhead.

## Strongest DCP Candidates (Ranked)

| Rank | Job | Step Unit | Per-Step Cost | Why |
|---|---|---|---|---|
| 1 | CurrentCorrelationFunction | Q-shell | Very high | Inner loops over all atoms AND frames per shell; einsum + correlate |
| 2 | DynamicCoherentStructureFactor | Q-shell | High | Full trajectory scan with complex exponentials per shell |
| 3 | VanHoveFunctionDistinct | Time-lag | High | O(n_configs × N²) pairwise distances per step |
| 4 | DynamicIncoherentStructureFactor | Atom | Medium | All Q-shells computed per atom; ideal for batching |
| 5 | SolventAccessibleSurface | Frame | Medium-high | KDTree construction + sparse distance matrices per frame |
| 6 | MeanSquareDisplacement | Atom | Low-medium | Ideal for large systems (>10k atoms) with batching |
| 7 | DistanceHistogram / PDF | Frame | Medium | O(N²) per frame; good for long trajectories |

## Safety and Correctness

- **Deterministic:** most MDANSE analyses are deterministic given the same trajectory input. No RNG in the main analysis steps (only in Q-vector generation during initialization).
- **Idempotent retries:** all `run_step()` implementations are pure functions with no side effects (except Voronoi). Safe to retry on failure.
- **Validation:** compare distributed results against single-core results for the same trajectory/parameters. MDANSE's test suite provides reference trajectories and expected outputs.
- **Reproducibility:** straightforward once Q-vector generation uses explicit `default_rng` instances instead of global `np.random.seed`.

---

*Report generated by [distributivize](https://github.com/exergy-connect/Distributivize.ai)*
