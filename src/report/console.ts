import { DcpCandidate, ProjectReport } from "../core/types.js";

export function formatConsoleReport(report: ProjectReport): string {
  const lines: string[] = [];
  lines.push("DCP Suitability Report");
  lines.push(`Project: ${report.projectRoot}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(
    `Files analyzed: ${report.summary.filesAnalyzed} | Candidates: ${report.summary.candidatesFound} | High: ${report.summary.highSuitability} | Medium: ${report.summary.mediumSuitability} | Low: ${report.summary.lowSuitability}`
  );

  if (report.candidates.length === 0) {
    lines.push("");
    lines.push("No DCP candidates found. Try running on code with loops, map/reduce, parameter sweeps, Monte Carlo simulations, or batch inference.");
    return lines.join("\n");
  }

  for (const candidate of report.candidates) {
    lines.push("");
    lines.push(formatCandidate(candidate));
  }

  return lines.join("\n");
}

function formatCandidate(candidate: DcpCandidate): string {
  const lines: string[] = [];
  lines.push(
    `[${candidate.score}/100] ${candidate.name} (${candidate.kind}, ${candidate.language}) at ${candidate.location.file}:${candidate.location.startLine}`
  );
  lines.push(`  Granularity: ${candidate.granularity}`);
  lines.push(`  Scaling: ${candidate.expectedScaling}`);

  if (candidate.evidence.length > 0) {
    lines.push(`  Evidence: ${candidate.evidence.join(" ")}`);
  }

  if (candidate.serializationConcerns.length > 0) {
    lines.push(`  Serialization: ${candidate.serializationConcerns.join(" ")}`);
  }

  if (candidate.sharedStateWarnings.length > 0) {
    lines.push(`  Shared state: ${candidate.sharedStateWarnings.join(" ")}`);
  }

  if (candidate.batchingRecommendations.length > 0) {
    lines.push(`  Batching: ${candidate.batchingRecommendations.join(" ")}`);
  }

  if (candidate.localOptimizationAdvice.length > 0) {
    lines.push(`  Local optimization: ${candidate.localOptimizationAdvice.join(" ")}`);
  }

  return lines.join("\n");
}
