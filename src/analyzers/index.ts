import { Analyzer } from "../core/types.js";
import { JavaScriptAnalyzer } from "./javascript.js";
import { MojoAnalyzer } from "./mojo.js";
import { PythonAnalyzer } from "./python.js";

export function defaultAnalyzers(): Analyzer[] {
  return [new JavaScriptAnalyzer(), new PythonAnalyzer(), new MojoAnalyzer()];
}
