import { Analyzer, DcpCandidate, SourceFile } from "../core/types.js";
import { buildCandidate } from "./common.js";

export class MojoAnalyzer implements Analyzer {
  name = "mojo-text-analyzer";
  language = "mojo" as const;
  extensions = [".mojo", ".🔥"];

  async analyze(file: SourceFile): Promise<DcpCandidate[]> {
    const lines = file.text.split("\n");
    const candidates: DcpCandidate[] = [];
    let currentFunction = "top_level";

    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      const defMatch = /^(fn|def)\s+([a-zA-Z_][\w]*)/.exec(trimmed);
      if (defMatch) {
        currentFunction = defMatch[2];
      }

      if (/^(for|while)\s+/.test(trimmed) || /\bparallelize\b|\bsimd\b|\bvectorize\b/.test(trimmed)) {
        const endLine = findBlockEnd(lines, index);
        candidates.push(
          buildCandidate({
            file,
            name: `${currentFunction} ${trimmed.split(/\s+/)[0]}`,
            startLine: index + 1,
            endLine,
            idSuffix: "mojo-loop"
          })
        );
      }
    }

    return candidates.filter((candidate) => candidate.score >= 35);
  }
}

function findBlockEnd(lines: string[], startIndex: number): number {
  const startIndent = lines[startIndex].match(/^\s*/)?.[0].length ?? 0;
  let end = startIndex + 1;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= startIndent) break;
    end = index + 1;
  }

  return end;
}
