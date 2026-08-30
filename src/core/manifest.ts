import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertValidManifest, validateManifest } from "./validation.ts";
import type { LoadedStack, StackManifest } from "./types.ts";

const MANIFEST_NAMES = ["stack.json", "stack.yaml", "stack.yml"] as const;

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findManifest(start: string): Promise<string> {
  const initial = path.resolve(start);
  if (MANIFEST_NAMES.some((name) => initial.endsWith(path.sep + name) || path.basename(initial) === name)) {
    if (await exists(initial)) return initial;
  }

  let current = initial;
  while (true) {
    for (const name of MANIFEST_NAMES) {
      const candidate = path.join(current, name);
      if (await exists(candidate)) return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`No Stack manifest found from ${initial}. Expected one of: ${MANIFEST_NAMES.join(", ")}.`);
}

async function parseManifestFile(manifestPath: string): Promise<unknown> {
  const raw = await readFile(manifestPath, "utf8");
  const extension = path.extname(manifestPath).toLowerCase();
  if (extension === ".json") return JSON.parse(raw) as unknown;
  if (extension === ".yaml" || extension === ".yml") {
    const yaml = await import("yaml");
    return yaml.parse(raw) as unknown;
  }
  throw new Error(`Unsupported manifest extension: ${extension}.`);
}

export async function loadStack(start = process.cwd()): Promise<LoadedStack> {
  const manifestPath = await findManifest(start);
  const parsed = await parseManifestFile(manifestPath);
  assertValidManifest(parsed);
  return {
    root: path.dirname(manifestPath),
    manifestPath,
    manifest: parsed,
  };
}

export async function inspectManifest(start = process.cwd()): Promise<{
  manifestPath: string;
  parsed: unknown;
  valid: boolean;
  errors: string[];
}> {
  const manifestPath = await findManifest(start);
  const parsed = await parseManifestFile(manifestPath);
  const result = validateManifest(parsed);
  return { manifestPath, parsed, ...result };
}

export function componentById(manifest: StackManifest, id: string) {
  return manifest.components.find((component) => component.id === id);
}
