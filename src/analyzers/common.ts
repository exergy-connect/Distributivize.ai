import { DcpCandidate, SourceFile } from "../core/types.js";
import {
  defaultSignals,
  granularityFromLineCount,
  localOptimizationAdvice,
  scalingText,
  scoreSignals
} from "../core/scoring.js";

export function lineAtOffset(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

export function snippetByLines(text: string, startLine: number, endLine: number): string {
  return text
    .split("\n")
    .slice(Math.max(0, startLine - 1), endLine)
    .join("\n")
    .trim();
}

export function classifySnippet(snippet: string): {
  kind: DcpCandidate["kind"];
  evidence: string[];
  serializationConcerns: string[];
  sharedStateWarnings: string[];
  batchingRecommendations: string[];
  penalties: number;
  signals: ReturnType<typeof defaultSignals>;
} {
  const lower = snippet.toLowerCase();
  const signals = defaultSignals();
  const evidence: string[] = [];
  const serializationConcerns: string[] = [];
  const sharedStateWarnings: string[] = [];
  const batchingRecommendations: string[] = [];
  let penalties = 0;
  let kind: DcpCandidate["kind"] = "loop";

  if (/\bfor\b|\bwhile\b|\.map\s*\(/.test(snippet)) {
    signals.embarrassinglyParallel = true;
    signals.independentIterations = true;
    evidence.push("Loop or map-like iteration detected.");
  }

  if (/monte|random|rand\(|random\.|math\.random|np\.random/.test(lower)) {
    signals.monteCarlo = true;
    signals.retryTolerant = true;
    signals.highComputeToTransferRatio = true;
    kind = "monte-carlo";
    evidence.push("Random sampling pattern suggests a Monte Carlo workload.");
  }

  if (/sweep|grid|params|parameter|hyperparameter|learning_rate|temperature/.test(lower)) {
    signals.parameterSweep = true;
    signals.retryTolerant = true;
    kind = "parameter-sweep";
    evidence.push("Parameter/grid sweep terms detected.");
  }

  if (/\.reduce\s*\(|reduce\(|sum\(|aggregate|accumulat/.test(lower)) {
    signals.mapReduce = true;
    kind = "map-reduce";
    evidence.push("Reduction or aggregation step detected.");
  }

  if (/batch|infer|predict|model\.|token|embedding|classif/.test(lower)) {
    signals.batchInference = true;
    kind = "batch-inference";
    evidence.push("Batch/model inference terms detected.");
  }

  if (/combin|permutation|combination|brute|search|cartesian|product\(/.test(lower)) {
    signals.highComputeToTransferRatio = true;
    signals.retryTolerant = true;
    kind = "search";
    evidence.push("Combinatorial search terms detected.");
  }

  if (/push\s*\(|append\s*\(|\+=|-=|\+\+|--|global\b|nonlocal\b|shared|cache|memo|state/.test(snippet)) {
    sharedStateWarnings.push("Mutation or shared-state-like names found; verify each distributed task can run independently.");
    signals.minimalSharedState = false;
    penalties += 18;
  }

  if (/fs\.|readfile|writefile|open\(|requests\.|fetch\(|axios|database|sql|socket|process\.env/.test(lower)) {
    serializationConcerns.push("External I/O or environment access detected; DCP workers need explicit inputs and deterministic dependencies.");
    penalties += 12;
  }

  if (/class\s+|this\.|self\.|new\s+|datetime|regexp|map<|set<|dict\(/.test(lower)) {
    serializationConcerns.push("Objects, methods, dates, regexes, or collections may require custom serialization.");
    penalties += 6;
  }

  const lines = snippet.split("\n").length;
  if (lines >= 8 || /hash|crypto|matrix|fft|simulate|solve|score|distance|train|render/.test(lower)) {
    signals.highComputeToTransferRatio = true;
    evidence.push("Body appears compute-heavy enough to amortize transfer overhead.");
  }

  if (signals.embarrassinglyParallel) {
    batchingRecommendations.push("Start with one DCP task per chunk of iterations, not one task per single iteration.");
  }

  if (signals.mapReduce) {
    batchingRecommendations.push("Return compact partial results and reduce them locally or in a second DCP stage.");
  }

  if (signals.batchInference) {
    batchingRecommendations.push("Group inputs by model/version and use batches sized for worker memory.");
  }

  return {
    kind,
    evidence,
    serializationConcerns,
    sharedStateWarnings,
    batchingRecommendations,
    penalties,
    signals
  };
}

export function buildCandidate(args: {
  file: SourceFile;
  name: string;
  kindHint?: DcpCandidate["kind"];
  startLine: number;
  endLine: number;
  idSuffix: string;
}): DcpCandidate {
  const snippet = snippetByLines(args.file.text, args.startLine, args.endLine);
  const classification = classifySnippet(snippet);
  const signals = classification.signals;
  const score = scoreSignals(signals, classification.penalties);
  const lineCount = Math.max(1, args.endLine - args.startLine + 1);
  const granularity = granularityFromLineCount(lineCount);
  const candidate: DcpCandidate = {
    id: `${args.file.relativePath}:${args.startLine}:${args.idSuffix}`.replace(/[^a-zA-Z0-9_.:-]/g, "_"),
    language: args.file.language,
    name: args.name,
    kind: args.kindHint ?? classification.kind,
    location: {
      file: args.file.relativePath,
      startLine: args.startLine,
      endLine: args.endLine
    },
    score,
    granularity,
    signals,
    evidence: classification.evidence,
    serializationConcerns: classification.serializationConcerns,
    sharedStateWarnings: classification.sharedStateWarnings,
    batchingRecommendations: classification.batchingRecommendations,
    expectedScaling: "",
    localOptimizationAdvice: [],
    snippet
  };

  candidate.expectedScaling = scalingText(candidate);
  candidate.localOptimizationAdvice = localOptimizationAdvice(candidate);
  return candidate;
}
