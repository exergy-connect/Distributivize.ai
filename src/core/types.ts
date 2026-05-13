export type Language = "javascript" | "python" | "mojo";

export type CandidateKind =
  | "loop"
  | "function"
  | "map-reduce"
  | "batch-inference"
  | "parameter-sweep"
  | "monte-carlo"
  | "search";

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  language: Language;
  text: string;
}

export interface Location {
  file: string;
  startLine: number;
  endLine: number;
}

export interface SuitabilitySignals {
  embarrassinglyParallel: boolean;
  independentIterations: boolean;
  parameterSweep: boolean;
  monteCarlo: boolean;
  mapReduce: boolean;
  batchInference: boolean;
  retryTolerant: boolean;
  minimalSharedState: boolean;
  highComputeToTransferRatio: boolean;
}

export interface DcpCandidate {
  id: string;
  language: Language;
  name: string;
  kind: CandidateKind;
  location: Location;
  score: number;
  granularity: "tiny" | "small" | "medium" | "large" | "unknown";
  signals: SuitabilitySignals;
  evidence: string[];
  serializationConcerns: string[];
  sharedStateWarnings: string[];
  batchingRecommendations: string[];
  expectedScaling: string;
  localOptimizationAdvice: string[];
  snippet: string;
}

export interface Analyzer {
  name: string;
  language: Language;
  extensions: string[];
  analyze(file: SourceFile): Promise<DcpCandidate[]>;
}

export interface ProjectReport {
  projectRoot: string;
  generatedAt: string;
  summary: {
    filesAnalyzed: number;
    candidatesFound: number;
    highSuitability: number;
    mediumSuitability: number;
    lowSuitability: number;
  };
  candidates: DcpCandidate[];
}
