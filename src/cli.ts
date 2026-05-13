#!/usr/bin/env node
import path from "node:path";
import { defaultAnalyzers } from "./analyzers/index.js";
import { analyzeProject, persistReport } from "./core/project.js";
import { generateDcpScaffold } from "./generate/dcp.js";
import { formatConsoleReport } from "./report/console.js";

async function main(): Promise<void> {
  const [command, projectArg] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "analyze" && command !== "generate") {
    throw new Error(`Unknown command "${command}". Expected "analyze" or "generate".`);
  }

  const projectRoot = path.resolve(projectArg ?? ".");
  const report = await analyzeProject(projectRoot, defaultAnalyzers());
  const reportPath = await persistReport(report);

  console.log(formatConsoleReport(report));
  console.log("");
  console.log(`JSON report: ${reportPath}`);

  if (command === "generate") {
    const generated = await generateDcpScaffold(report);
    console.log(`Generated ${generated.length} scaffold file(s):`);
    for (const file of generated) {
      console.log(`  ${file}`);
    }
  }
}

function printHelp(): void {
  console.log(`distributivize

Usage:
  distributivize analyze ./project
  distributivize generate ./project

Commands:
  analyze   Detect DCP-suitable loops/functions and write .distributivize/report.json
  generate  Analyze and generate example DCP wrapper scaffolds in .distributivize/wrappers
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
