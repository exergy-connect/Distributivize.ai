import path from "node:path";
import { Analyzer, ProjectReport } from "./types.js";
import { walkProject, writeJson } from "./fs.js";

export async function analyzeProject(
  projectRoot: string,
  analyzers: Analyzer[]
): Promise<ProjectReport> {
  const files = await walkProject(projectRoot, analyzers);
  const candidates = [];

  for (const file of files) {
    const analyzer = analyzers.find((plugin) => plugin.language === file.language);
    if (!analyzer) {
      continue;
    }

    candidates.push(...(await analyzer.analyze(file)));
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    projectRoot: path.resolve(projectRoot),
    generatedAt: new Date().toISOString(),
    summary: {
      filesAnalyzed: files.length,
      candidatesFound: candidates.length,
      highSuitability: candidates.filter((candidate) => candidate.score >= 75).length,
      mediumSuitability: candidates.filter((candidate) => candidate.score >= 50 && candidate.score < 75).length,
      lowSuitability: candidates.filter((candidate) => candidate.score < 50).length
    },
    candidates
  };
}

export async function persistReport(report: ProjectReport): Promise<string> {
  const reportPath = path.join(report.projectRoot, ".distributivize", "report.json");
  await writeJson(reportPath, report);
  return reportPath;
}
