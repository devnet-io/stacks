import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { componentRoot, contextAbsolutePath } from "./paths.ts";
import type { CapabilityExport, ComponentDescriptor, ComponentDescriptorReport, ContextPath, LoadedStack, StackComponent } from "./types.ts";

export const COMPONENT_DESCRIPTOR_PATH = ".stack/component.json";
export const COMPONENT_DESCRIPTOR_MAX_BYTES = 65_536;
const MAX_CAPABILITIES = 100;
const MAX_CONTEXT_PATHS = 20;
const strength = new Set(["required", "preferred", "reference"]);

export interface ComponentDescriptorResolution {
  stack: LoadedStack;
  reports: Record<string, ComponentDescriptorReport>;
}

export async function resolveComponentDescriptors(stack: LoadedStack): Promise<ComponentDescriptorResolution> {
  const reports: Record<string, ComponentDescriptorReport> = {};
  const components: StackComponent[] = [];
  for (const component of stack.manifest.components) {
    const loaded = await readComponentDescriptor(stack, component);
    const explicit = new Set((component.provides ?? []).map((item) => item.capability));
    const published = loaded.descriptor?.provides ?? [];
    const applied = published.filter((item) => !explicit.has(item.capability));
    const overridden = published.filter((item) => explicit.has(item.capability));
    reports[component.id] = {
      componentId: component.id,
      path: loaded.path,
      status: loaded.status,
      publishedCapabilities: published.map((item) => item.capability),
      appliedCapabilities: applied.map((item) => item.capability),
      overriddenCapabilities: overridden.map((item) => item.capability),
      errors: loaded.errors,
    };
    components.push(applied.length === 0 ? component : { ...component, provides: [...applied, ...(component.provides ?? [])] });
  }
  return { stack: { ...stack, manifest: { ...stack.manifest, components } }, reports };
}

async function readComponentDescriptor(
  stack: LoadedStack,
  component: StackComponent,
): Promise<{ path: string; status: ComponentDescriptorReport["status"]; descriptor?: ComponentDescriptor; errors: string[] }> {
  let root: string;
  try { root = componentRoot(stack, component); }
  catch (error) { return { path: COMPONENT_DESCRIPTOR_PATH, status: "unavailable", errors: [message(error)] }; }
  const descriptorPath = path.join(root, ...COMPONENT_DESCRIPTOR_PATH.split("/"));
  try {
    const descriptorInfo = await lstat(descriptorPath);
    if (!descriptorInfo.isFile() && !descriptorInfo.isSymbolicLink()) return invalid(descriptorPath, "Descriptor must be a regular file.");
    const [canonicalRoot, canonicalDescriptor] = await Promise.all([realpath(root), realpath(descriptorPath)]);
    const relative = path.relative(canonicalRoot, canonicalDescriptor);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return invalid(descriptorPath, "Descriptor symlink escapes the component root.");
    const descriptorStats = await stat(canonicalDescriptor);
    if (!descriptorStats.isFile()) return invalid(descriptorPath, "Descriptor must resolve to a regular file.");
    if (descriptorStats.size > COMPONENT_DESCRIPTOR_MAX_BYTES) return invalid(descriptorPath, `Descriptor exceeds the ${COMPONENT_DESCRIPTOR_MAX_BYTES}-byte limit.`);
    let parsed: unknown;
    try { parsed = JSON.parse(await readFile(canonicalDescriptor, "utf8")) as unknown; }
    catch (error) { return invalid(descriptorPath, `Descriptor is not valid JSON: ${message(error)}`); }
    const validation = validateComponentDescriptor(parsed, root);
    if (!validation.valid) return { path: descriptorPath, status: "invalid", errors: validation.errors };
    return { path: descriptorPath, status: "valid", descriptor: parsed as ComponentDescriptor, errors: [] };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path: descriptorPath, status: "absent", errors: [] };
    return { path: descriptorPath, status: "unavailable", errors: [message(error)] };
  }
}

export function validateComponentDescriptor(value: unknown, root = process.cwd()): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!record(value)) return { valid: false, errors: ["Descriptor must be an object."] };
  rejectUnknown(value, ["schemaVersion", "provides"], "descriptor", errors);
  if (value.schemaVersion !== "0.1") errors.push("descriptor.schemaVersion must be 0.1.");
  if (!Array.isArray(value.provides)) errors.push("descriptor.provides must be an array.");
  else {
    if (value.provides.length > MAX_CAPABILITIES) errors.push(`descriptor.provides must contain at most ${MAX_CAPABILITIES} capabilities.`);
    value.provides.forEach((item, index) => validateExport(item, `descriptor.provides[${index}]`, root, errors));
    const names = value.provides.flatMap((item) => record(item) && nonEmpty(item.capability) ? [item.capability] : []);
    for (const duplicate of new Set(names.filter((name, index) => names.indexOf(name) !== index))) errors.push(`Duplicate descriptor capability: ${duplicate}.`);
  }
  return { valid: errors.length === 0, errors };
}

function validateExport(value: unknown, at: string, root: string, errors: string[]): value is CapabilityExport {
  if (!record(value)) { errors.push(`${at} must be an object.`); return false; }
  rejectUnknown(value, ["capability", "description", "context", "artifact"], at, errors);
  if (!nonEmpty(value.capability)) errors.push(`${at}.capability must be a non-empty string.`);
  if (value.description !== undefined && !nonEmpty(value.description)) errors.push(`${at}.description must be a non-empty string.`);
  if (value.artifact !== undefined) {
    if (!record(value.artifact)) errors.push(`${at}.artifact must be an object.`);
    else {
      rejectUnknown(value.artifact, ["ecosystem", "name", "path"], `${at}.artifact`, errors);
      if (!nonEmpty(value.artifact.ecosystem)) errors.push(`${at}.artifact.ecosystem must be a non-empty string.`);
      if (!nonEmpty(value.artifact.name)) errors.push(`${at}.artifact.name must be a non-empty string.`);
      if (value.artifact.path !== undefined) {
        if (!nonEmpty(value.artifact.path)) errors.push(`${at}.artifact.path must be a non-empty relative path.`);
        else {
          try { contextAbsolutePath(root, value.artifact.path, `${at}.artifact.path`); }
          catch (error) { errors.push(message(error)); }
        }
      }
    }
  }
  if (value.context !== undefined) {
    if (!Array.isArray(value.context)) errors.push(`${at}.context must be an array.`);
    else {
      if (value.context.length > MAX_CONTEXT_PATHS) errors.push(`${at}.context must contain at most ${MAX_CONTEXT_PATHS} paths.`);
      value.context.forEach((item, index) => validateContext(item, `${at}.context[${index}]`, root, errors));
    }
  }
  return true;
}

function validateContext(value: unknown, at: string, root: string, errors: string[]): value is ContextPath {
  if (!record(value)) { errors.push(`${at} must be an object.`); return false; }
  rejectUnknown(value, ["path", "description", "strength", "priority", "tags"], at, errors);
  if (!nonEmpty(value.path)) errors.push(`${at}.path must be a non-empty string.`);
  else {
    try { contextAbsolutePath(root, value.path, `${at}.path`); }
    catch (error) { errors.push(message(error)); }
  }
  if (value.description !== undefined && !nonEmpty(value.description)) errors.push(`${at}.description must be a non-empty string.`);
  if (value.strength !== undefined && !strength.has(String(value.strength))) errors.push(`${at}.strength must be required, preferred, or reference.`);
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isFinite(value.priority))) errors.push(`${at}.priority must be a finite number.`);
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.some((tag) => !nonEmpty(tag))) errors.push(`${at}.tags must be an array of non-empty strings.`);
    else if (new Set(value.tags).size !== value.tags.length) errors.push(`${at}.tags must not contain duplicates.`);
  }
  return true;
}

function invalid(descriptorPath: string, error: string) { return { path: descriptorPath, status: "invalid" as const, errors: [error] }; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function rejectUnknown(value: Record<string, unknown>, allowed: string[], at: string, errors: string[]) { for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${at}.${key} is not supported.`); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
