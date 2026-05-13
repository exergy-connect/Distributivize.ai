import { parse } from "@babel/parser";
import { Analyzer, DcpCandidate, SourceFile } from "../core/types.js";
import { buildCandidate } from "./common.js";

interface NodeLike {
  type: string;
  start?: number | null;
  end?: number | null;
  loc?: {
    start: { line: number };
    end: { line: number };
  } | null;
  id?: { name?: string } | null;
  key?: { name?: string } | null;
  callee?: NodeLike & { property?: { name?: string }; name?: string };
  parentName?: string;
  [key: string]: unknown;
}

const LOOP_TYPES = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement"
]);

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod"
]);

export class JavaScriptAnalyzer implements Analyzer {
  name = "babel-javascript-analyzer";
  language = "javascript" as const;
  extensions = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"];

  async analyze(file: SourceFile): Promise<DcpCandidate[]> {
    let ast: NodeLike;
    try {
      ast = parse(file.text, {
        sourceType: "unambiguous",
        plugins: ["typescript", "jsx"],
        errorRecovery: true
      }) as unknown as NodeLike;
    } catch {
      return [];
    }

    const candidates: DcpCandidate[] = [];
    const functionStack: string[] = [];

    const visit = (node: unknown, parent?: NodeLike): void => {
      if (!isNode(node)) return;

      const name = nodeName(node, parent);
      if (FUNCTION_TYPES.has(node.type)) {
        functionStack.push(name ?? "anonymousFunction");
      }

      if (LOOP_TYPES.has(node.type) && node.loc) {
        const currentFunction = functionStack.at(-1) ?? "topLevel";
        candidates.push(
          buildCandidate({
            file,
            name: `${currentFunction} ${node.type.replace("Statement", "")}`,
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            idSuffix: node.type
          })
        );
      }

      if (node.type === "CallExpression" && node.loc && isMapReduceCall(node)) {
        const currentFunction = functionStack.at(-1) ?? "topLevel";
        const callName = node.callee?.property?.name ?? "array-call";
        candidates.push(
          buildCandidate({
            file,
            name: `${currentFunction} ${callName}`,
            kindHint: callName === "reduce" ? "map-reduce" : "loop",
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            idSuffix: `CallExpression-${callName}`
          })
        );
      }

      for (const [key, value] of Object.entries(node)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        if (Array.isArray(value)) {
          for (const child of value) {
            visit(child, node);
          }
        } else if (isNode(value)) {
          visit(value, node);
        }
      }

      if (FUNCTION_TYPES.has(node.type)) {
        functionStack.pop();
      }
    };

    visit(ast);
    return uniqueCandidates(candidates).filter((candidate) => candidate.score >= 35);
  }
}

function isNode(value: unknown): value is NodeLike {
  return Boolean(value && typeof value === "object" && typeof (value as NodeLike).type === "string");
}

function nodeName(node: NodeLike, parent?: NodeLike): string | undefined {
  if (node.id?.name) return node.id.name;
  if (parent?.type === "VariableDeclarator" && isIdentifier(parent.id)) return parent.id.name;
  if (parent?.type === "ObjectProperty" && parent.key?.name) return parent.key.name;
  if (node.key?.name) return node.key.name;
  return undefined;
}

function isIdentifier(value: unknown): value is { name: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string");
}

function isMapReduceCall(node: NodeLike): boolean {
  const propertyName = node.callee?.property?.name;
  return propertyName === "map" || propertyName === "reduce" || propertyName === "flatMap";
}

function uniqueCandidates(candidates: DcpCandidate[]): DcpCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.location.file}:${candidate.location.startLine}:${candidate.location.endLine}:${candidate.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
