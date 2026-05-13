import { promises as fs } from "node:fs";
import path from "node:path";
import { Analyzer, Language, SourceFile } from "./types.js";

const IGNORED_DIRS = new Set([
  ".git",
  ".distributivize",
  "node_modules",
  "dist",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache"
]);

export async function walkProject(
  root: string,
  analyzers: Analyzer[]
): Promise<SourceFile[]> {
  const absoluteRoot = path.resolve(root);
  const extensionMap = new Map<string, Language>();

  for (const analyzer of analyzers) {
    for (const extension of analyzer.extensions) {
      extensionMap.set(extension, analyzer.language);
    }
  }

  const files: SourceFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await visit(absolutePath);
        }
        continue;
      }

      const language = extensionMap.get(path.extname(entry.name));
      if (!language) {
        continue;
      }

      const text = await fs.readFile(absolutePath, "utf8");
      files.push({
        absolutePath,
        relativePath: path.relative(absoluteRoot, absolutePath),
        language,
        text
      });
    }
  }

  await visit(absoluteRoot);
  return files;
}

export async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
