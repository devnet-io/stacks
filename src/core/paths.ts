import path from "node:path";
import type { LoadedStack, StackComponent } from "./types.ts";

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function resolveWithin(parent: string, relativePath: string, label: string): string {
  if (path.isAbsolute(relativePath)) throw new Error(`${label} must be relative: ${relativePath}`);
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, relativePath);
  if (!isWithin(resolvedParent, resolved)) throw new Error(`${label} escapes its allowed root: ${relativePath}`);
  return resolved;
}

export function workspaceDirectory(stack: LoadedStack): string {
  return resolveWithin(stack.root, stack.manifest.workspace?.directory ?? ".stack-workspace", "workspace.directory");
}

export function stateDirectory(stack: LoadedStack): string {
  return resolveWithin(stack.root, stack.manifest.workspace?.stateDirectory ?? ".stacks", "workspace.stateDirectory");
}

export function componentRoot(stack: LoadedStack, component: StackComponent): string {
  if (component.source.type === "path") {
    return resolveWithin(stack.root, component.source.path, `component ${component.id} source.path`);
  }
  return resolveWithin(
    workspaceDirectory(stack),
    component.source.checkout ?? component.id,
    `component ${component.id} source.checkout`,
  );
}

export function contextAbsolutePath(ownerRoot: string, contextPath: string, label: string): string {
  return resolveWithin(ownerRoot, contextPath, label);
}

export function containsGlob(value: string): boolean {
  return /[*?\[\]{}]/u.test(value);
}
