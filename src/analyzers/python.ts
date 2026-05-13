import { Analyzer, DcpCandidate, SourceFile } from "../core/types.js";
import { buildCandidate } from "./common.js";

export class PythonAnalyzer implements Analyzer {
  name = "python-heuristic-analyzer";
  language = "python" as const;
  extensions = [".py"];

  async analyze(file: SourceFile): Promise<DcpCandidate[]> {
    const lines = file.text.split("\n");
    const candidates: DcpCandidate[] = [];
    const functionStack: Array<{ name: string; indent: number }> = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      const indent = leadingSpaces(line);

      while (functionStack.length > 0 && indent <= functionStack.at(-1)!.indent && trimmed.length > 0) {
        functionStack.pop();
      }

      const defMatch = /^def\s+([a-zA-Z_][\w]*)\s*\(/.exec(trimmed);
      if (defMatch) {
        functionStack.push({ name: defMatch[1], indent });
      }

      if (/^(for|while)\s+/.test(trimmed)) {
        const endLine = findIndentedBlockEnd(lines, index);
        const currentFunction = functionStack.at(-1)?.name ?? "top_level";
        candidates.push(
          buildCandidate({
            file,
            name: `${currentFunction} ${trimmed.split(/\s+/)[0]}`,
            startLine: index + 1,
            endLine,
            idSuffix: "loop"
          })
        );
      }

      if (/\b(map|starmap|imap|pool\.map|executor\.map)\s*\(/.test(trimmed)) {
        const endLine = findExpressionEnd(lines, index);
        const currentFunction = functionStack.at(-1)?.name ?? "top_level";
        candidates.push(
          buildCandidate({
            file,
            name: `${currentFunction} map`,
            kindHint: "map-reduce",
            startLine: index + 1,
            endLine,
            idSuffix: "map"
          })
        );
      }
    }

    return candidates.filter((candidate) => candidate.score >= 35);
  }
}

function leadingSpaces(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function findIndentedBlockEnd(lines: string[], startIndex: number): number {
  const startIndent = leadingSpaces(lines[startIndex]);
  let end = startIndex + 1;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      continue;
    }

    if (leadingSpaces(line) <= startIndent) {
      break;
    }
    end = index + 1;
  }

  return end;
}

function findExpressionEnd(lines: string[], startIndex: number): number {
  let balance = 0;
  let end = startIndex + 1;

  for (let index = startIndex; index < lines.length; index += 1) {
    for (const char of lines[index]) {
      if (char === "(" || char === "[" || char === "{") balance += 1;
      if (char === ")" || char === "]" || char === "}") balance -= 1;
    }
    end = index + 1;
    if (balance <= 0) break;
  }

  return end;
}
