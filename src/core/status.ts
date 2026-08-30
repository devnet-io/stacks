import { existsSync } from "node:fs";
import type { ComponentStatus, LoadedStack } from "./types.ts";
import { componentRoot } from "./paths.ts";
import { gitStatus } from "./git.ts";

export function getComponentStatuses(stack: LoadedStack): ComponentStatus[] {
  return stack.manifest.components.map((component) => {
    const root = componentRoot(stack, component);
    const exists = existsSync(root);
    const issues: string[] = [];
    if (!exists) issues.push("Component root does not exist.");
    const git = exists ? gitStatus(root) : undefined;
    if (component.source.type === "git" && git && !git.isRepository) issues.push(git.error ?? "Expected a Git repository.");
    if (
      component.source.type === "git" &&
      git?.remoteUrl &&
      git.remoteUrl !== component.source.url
    ) {
      issues.push(`Origin mismatch: expected ${component.source.url}, found ${git.remoteUrl}.`);
    }
    return {
      id: component.id,
      ...(component.kind === undefined ? {} : { kind: component.kind }),
      sourceType: component.source.type,
      root,
      exists,
      access: component.access ?? "read-write",
      ...(git === undefined ? {} : { git }),
      issues,
    };
  });
}
