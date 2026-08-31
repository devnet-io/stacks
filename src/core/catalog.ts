import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertValidManifest } from "./validation.ts";
import type { CapabilityExport, CapabilityRequirement, Guidance, LoadedStack, StackComponent, StackManifest } from "./types.ts";

export interface PlatformDirectories { config: string; state: string }
export interface CatalogEntry { id: string; namespace: string; name: string; definitionPath: string; bindingsPath: string }
export interface StackCatalog { schemaVersion: "0.1"; stacks: CatalogEntry[] }
export interface ComponentBindings { schemaVersion: "0.1"; stackId: string; components: Record<string, { path: string }> }
export interface ComponentMembership {
  stack: { id: string; namespace: string; name: string };
  component: { id: string; name: string; kind: string };
  root: string;
  relationship: "component" | "ancestor";
  relativePath?: string;
  componentPath?: string;
}

export function platformDirectories(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
): PlatformDirectories {
  if (env.STACKS_CONFIG_HOME || env.STACKS_STATE_HOME) {
    return {
      config: path.resolve(env.STACKS_CONFIG_HOME ?? path.join(home, ".config", "stacks")),
      state: path.resolve(env.STACKS_STATE_HOME ?? path.join(home, ".local", "state", "stacks")),
    };
  }
  if (platform === "win32") {
    return {
      config: path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "stacks"),
      state: path.join(env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "stacks"),
    };
  }
  if (platform === "darwin") {
    const base = path.join(home, "Library", "Application Support", "stacks");
    return { config: base, state: path.join(base, "state") };
  }
  return {
    config: path.resolve(env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "stacks"),
    state: path.resolve(env.XDG_STATE_HOME ?? path.join(home, ".local", "state"), "stacks"),
  };
}

function catalogFile(directories: PlatformDirectories): string { return path.join(directories.config, "catalog.json"); }
function catalogLockFile(directories: PlatformDirectories): string { return path.join(directories.config, "catalog.lock"); }
function selector(entry: Pick<CatalogEntry, "namespace" | "name">): string { return `${entry.namespace}/${entry.name}`; }

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isTransientCatalogLockError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EEXIST" || (process.platform === "win32" && (code === "EACCES" || code === "EPERM"));
}

async function withCatalogMutation<T>(directories: PlatformDirectories, mutate: () => Promise<T>): Promise<T> {
  await mkdir(directories.config, { recursive: true });
  const lockPath = catalogLockFile(directories);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, "utf8");
      break;
    } catch (error) {
      if (!isTransientCatalogLockError(error)) throw error;
      if (attempt === 199) throw new Error(`Timed out waiting for the Stacks catalog mutation lock at ${lockPath}.`);
      await wait(25);
    }
  }
  if (!handle) throw new Error(`Unable to acquire the Stacks catalog mutation lock at ${lockPath}.`);
  try {
    return await mutate();
  } finally {
    await handle.close();
    await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function readCatalog(directories = platformDirectories()): Promise<StackCatalog> {
  return readJson(catalogFile(directories), { schemaVersion: "0.1", stacks: [] });
}

export async function listRegisteredStacks(directories = platformDirectories()): Promise<CatalogEntry[]> {
  return (await readCatalog(directories)).stacks.toSorted((a, b) => selector(a).localeCompare(selector(b)));
}

export function parseStackSelector(value: string): { namespace: string; name: string } {
  const [namespace, name, ...rest] = value.split("/");
  if (!namespace || !name || rest.length) throw new Error("Stack selector must be namespace/name.");
  return { namespace, name };
}

export async function createRegisteredStack(value: string, directories = platformDirectories()): Promise<LoadedStack> {
  const identity = parseStackSelector(value);
  await withCatalogMutation(directories, async () => {
    const catalog = await readCatalog(directories);
    if (catalog.stacks.some((entry) => selector(entry) === value)) throw new Error(`Stack ${value} is already registered.`);
    const id = randomUUID();
    const definitionPath = path.join(directories.config, "definitions", `${id}.json`);
    const bindingsPath = path.join(directories.config, "bindings", `${id}.json`);
    const manifest: StackManifest = {
      apiVersion: "stacks.dev/v0alpha1", kind: "Stack",
      metadata: { id, ...identity, description: "Describe the worldview and body of work represented by this Stack." },
      components: [],
    };
    const bindings: ComponentBindings = { schemaVersion: "0.1", stackId: id, components: {} };
    const entry: CatalogEntry = { id, ...identity, definitionPath, bindingsPath };
    await writeJsonAtomic(definitionPath, manifest);
    await writeJsonAtomic(bindingsPath, bindings);
    await writeJsonAtomic(catalogFile(directories), { ...catalog, stacks: [...catalog.stacks, entry] });
  });
  return loadRegisteredStack(value, directories);
}

function assertCatalogDefinition(manifest: StackManifest, name: string): void {
  if (manifest.workspace) throw new Error(`Registered Stack ${name} cannot declare a legacy workspace.`);
  if ((manifest.context?.always?.length ?? 0) > 0) throw new Error(`Registered Stack ${name} must model shared guidance as a knowledge component.`);
  if (manifest.components.some((component) => component.source.type === "path")) throw new Error(`Registered Stack ${name} cannot use legacy relative path components.`);
}

export async function loadRegisteredStack(value: string, directories = platformDirectories()): Promise<LoadedStack> {
  const entry = (await readCatalog(directories)).stacks.find((candidate) => selector(candidate) === value || candidate.id === value);
  if (!entry) throw new Error(`Unknown registered Stack: ${value}. Run stacks stack list.`);
  const manifest = await readJson<unknown>(entry.definitionPath, null);
  assertValidManifest(manifest);
  assertCatalogDefinition(manifest, selector(entry));
  const bindings = await readJson<ComponentBindings>(entry.bindingsPath, { schemaVersion: "0.1", stackId: entry.id, components: {} });
  return {
    root: path.dirname(entry.definitionPath), manifestPath: entry.definitionPath, manifest,
    bindings: Object.fromEntries(Object.entries(bindings.components).map(([id, binding]) => [id, binding.path])),
    stateRoot: path.join(directories.state, "stacks", entry.id), registered: true,
  };
}

async function canonicalDirectory(value: string): Promise<string> {
  const resolved = path.resolve(value);
  try { return await realpath(resolved); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved;
    throw error;
  }
}

function containsPath(root: string, candidate: string): string | undefined {
  const relative = path.relative(root, candidate);
  if (relative === "") return ".";
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined;
  return relative;
}

export async function findRegisteredComponentMemberships(
  directory: string,
  directories = platformDirectories(),
): Promise<ComponentMembership[]> {
  const target = await canonicalDirectory(directory);
  const catalog = await listRegisteredStacks(directories);
  const componentMatches: ComponentMembership[] = [];
  const ancestorMatches: ComponentMembership[] = [];
  for (const entry of catalog) {
    const stack = await loadRegisteredStack(entry.id, directories);
    for (const component of stack.manifest.components) {
      const binding = stack.bindings?.[component.id];
      if (!binding) continue;
      const root = await canonicalDirectory(binding);
      const relativePath = containsPath(root, target);
      const componentPath = containsPath(target, root);
      if (relativePath === undefined && componentPath === undefined) continue;
      const membership = {
        stack: { id: entry.id, namespace: entry.namespace, name: entry.name },
        component: { id: component.id, name: component.name ?? component.id, kind: component.kind ?? "component" },
        root,
      };
      if (relativePath !== undefined) componentMatches.push({ ...membership, relationship: "component", relativePath });
      else ancestorMatches.push({ ...membership, relationship: "ancestor", componentPath: componentPath! });
    }
  }
  const matches = componentMatches.length > 0 ? componentMatches : ancestorMatches;
  return matches.toSorted((left, right) =>
    `${left.stack.namespace}/${left.stack.name}:${left.component.id}`.localeCompare(`${right.stack.namespace}/${right.stack.name}:${right.component.id}`),
  );
}

export async function addRegisteredComponent(
  stackSelector: string,
  input: { id: string; path: string; kind?: string; git?: string; name?: string },
  directories = platformDirectories(),
): Promise<LoadedStack> {
  const localPath = path.resolve(input.path);
  if (!input.git) {
    try { await access(localPath); }
    catch { throw new Error(`Local component directory does not exist: ${localPath}.`); }
  }
  await withCatalogMutation(directories, async () => {
    const catalog = await readCatalog(directories);
    const entry = catalog.stacks.find((candidate) => selector(candidate) === stackSelector || candidate.id === stackSelector);
    if (!entry) throw new Error(`Unknown registered Stack: ${stackSelector}.`);
    const stack = await loadRegisteredStack(stackSelector, directories);
    if (stack.manifest.components.some((component) => component.id === input.id)) throw new Error(`Component ${input.id} already exists in ${selector(entry)}.`);
    const component: StackComponent = {
      id: input.id,
      ...(input.name === undefined ? {} : { name: input.name }),
      kind: input.kind ?? "component",
      source: input.git ? { type: "git", url: input.git } : { type: "local" },
    };
    const manifest = { ...stack.manifest, components: [...stack.manifest.components, component] };
    assertValidManifest(manifest);
    const bindings = await readJson<ComponentBindings>(entry.bindingsPath, { schemaVersion: "0.1", stackId: entry.id, components: {} });
    await writeJsonAtomic(entry.bindingsPath, { ...bindings, components: { ...bindings.components, [input.id]: { path: localPath } } });
    await writeJsonAtomic(entry.definitionPath, manifest);
  });
  return loadRegisteredStack(stackSelector, directories);
}

export async function bindRegisteredComponent(stackSelector: string, componentId: string, localDirectory: string, directories = platformDirectories()): Promise<LoadedStack> {
  const localPath = path.resolve(localDirectory);
  await withCatalogMutation(directories, async () => {
    const catalog = await readCatalog(directories);
    const entry = catalog.stacks.find((candidate) => selector(candidate) === stackSelector || candidate.id === stackSelector);
    if (!entry) throw new Error(`Unknown registered Stack: ${stackSelector}.`);
    const stack = await loadRegisteredStack(stackSelector, directories);
    const component = stack.manifest.components.find((candidate) => candidate.id === componentId);
    if (!component) throw new Error(`Unknown component ${componentId} in ${selector(entry)}.`);
    if (component.source.type !== "git") {
      try { await access(localPath); }
      catch { throw new Error(`Local component directory does not exist: ${localPath}.`); }
    }
    const bindings = await readJson<ComponentBindings>(entry.bindingsPath, { schemaVersion: "0.1", stackId: entry.id, components: {} });
    await writeJsonAtomic(entry.bindingsPath, { ...bindings, components: { ...bindings.components, [componentId]: { path: localPath } } });
  });
  return loadRegisteredStack(stackSelector, directories);
}

async function updateRegisteredComponent(
  stackSelector: string,
  componentId: string,
  update: (component: StackComponent) => StackComponent,
  directories: PlatformDirectories,
): Promise<{ stack: LoadedStack; changed: boolean }> {
  let changed = false;
  await withCatalogMutation(directories, async () => {
    const catalog = await readCatalog(directories);
    const entry = catalog.stacks.find((candidate) => selector(candidate) === stackSelector || candidate.id === stackSelector);
    if (!entry) throw new Error(`Unknown registered Stack: ${stackSelector}.`);
    const stack = await loadRegisteredStack(stackSelector, directories);
    const componentIndex = stack.manifest.components.findIndex((candidate) => candidate.id === componentId);
    if (componentIndex < 0) throw new Error(`Unknown component ${componentId} in ${selector(entry)}.`);
    const component = stack.manifest.components[componentIndex]!;
    const updated = update(component);
    if (JSON.stringify(updated) === JSON.stringify(component)) return;
    changed = true;
    const components = [...stack.manifest.components];
    components[componentIndex] = updated;
    const manifest = { ...stack.manifest, components };
    assertValidManifest(manifest);
    await writeJsonAtomic(entry.definitionPath, manifest);
  });
  return { stack: await loadRegisteredStack(stackSelector, directories), changed };
}

function upsertBy<T>(items: T[] | undefined, matches: (item: T) => boolean, value: T): T[] {
  const current = items ?? [];
  const index = current.findIndex(matches);
  if (index < 0) return [...current, value];
  const updated = [...current];
  updated[index] = value;
  return updated;
}

export function configureRegisteredCapabilityExport(
  stackSelector: string,
  componentId: string,
  value: CapabilityExport,
  directories = platformDirectories(),
): Promise<{ stack: LoadedStack; changed: boolean }> {
  return updateRegisteredComponent(stackSelector, componentId, (component) => ({
    ...component,
    provides: upsertBy(component.provides, (item) => item.capability === value.capability, value),
  }), directories);
}

export function configureRegisteredCapabilityRequirement(
  stackSelector: string,
  componentId: string,
  value: CapabilityRequirement,
  directories = platformDirectories(),
): Promise<{ stack: LoadedStack; changed: boolean }> {
  return updateRegisteredComponent(stackSelector, componentId, (component) => ({
    ...component,
    consumes: upsertBy(component.consumes, (item) => item.capability === value.capability, value),
  }), directories);
}

export function configureRegisteredGuidance(
  stackSelector: string,
  componentId: string,
  value: Guidance,
  directories = platformDirectories(),
): Promise<{ stack: LoadedStack; changed: boolean }> {
  return updateRegisteredComponent(stackSelector, componentId, (component) => ({
    ...component,
    guidance: upsertBy(component.guidance, (item) => item.path === value.path, value),
  }), directories);
}
