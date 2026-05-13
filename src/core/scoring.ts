import { DcpCandidate, SuitabilitySignals } from "./types.js";

export function defaultSignals(): SuitabilitySignals {
  return {
    embarrassinglyParallel: false,
    independentIterations: false,
    parameterSweep: false,
    monteCarlo: false,
    mapReduce: false,
    batchInference: false,
    retryTolerant: false,
    minimalSharedState: true,
    highComputeToTransferRatio: false
  };
}

export function scoreSignals(
  signals: SuitabilitySignals,
  penalties: number
): number {
  let score = 10;

  if (signals.embarrassinglyParallel) score += 18;
  if (signals.independentIterations) score += 16;
  if (signals.parameterSweep) score += 12;
  if (signals.monteCarlo) score += 14;
  if (signals.mapReduce) score += 12;
  if (signals.batchInference) score += 12;
  if (signals.retryTolerant) score += 8;
  if (signals.minimalSharedState) score += 12;
  if (signals.highComputeToTransferRatio) score += 14;

  score -= penalties;
  return Math.max(0, Math.min(100, score));
}

export function scalingText(candidate: Pick<DcpCandidate, "score" | "signals" | "granularity">): string {
  if (candidate.score >= 75) {
    return "Strong DCP candidate. Expect near-linear scaling until scheduler overhead, data transfer, or result reduction dominates.";
  }

  if (candidate.score >= 50) {
    return "Moderate DCP candidate. Scaling should improve with batching and larger per-task granularity.";
  }

  return "Weak DCP candidate as written. Prefer refactoring to isolate pure work units before distributing.";
}

export function granularityFromLineCount(lineCount: number): DcpCandidate["granularity"] {
  if (lineCount <= 3) return "tiny";
  if (lineCount <= 8) return "small";
  if (lineCount <= 25) return "medium";
  return "large";
}

export function localOptimizationAdvice(candidate: DcpCandidate): string[] {
  const advice: string[] = [];

  if (candidate.granularity === "tiny" || candidate.granularity === "small") {
    advice.push("Task granularity may be too small for DCP overhead. Batch many iterations per task or try local SIMD/GPU first.");
  }

  if (!candidate.signals.highComputeToTransferRatio) {
    advice.push("If each task moves large arrays but performs little compute, local GPU/vectorization may beat distribution.");
  }

  if (candidate.signals.batchInference) {
    advice.push("For single-host tensor models, compare DCP batching against GPU inference throughput before migrating.");
  }

  return advice;
}
