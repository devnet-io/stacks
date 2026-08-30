import path from "node:path";
import type { ComponentStatus, LoadedStack } from "../core/types.ts";
import { getComponentStatuses } from "../core/status.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

export type ComponentHealth = "ready" | "dirty" | "missing" | "issue";

export interface OverviewComponent extends ComponentStatus {
  name: string;
  health: ComponentHealth;
}

export interface StackOverview {
  schemaVersion: "0.1";
  stack: StackIdentity & {
    description?: string;
    version?: string;
  };
  workspace: {
    mode: "registered" | "legacy-directory";
    definitionPath: string;
    legacyRoot?: string;
    legacyComponentDirectory?: string;
    stateDirectory: string;
  };
  summary: {
    components: number;
    ready: number;
    dirty: number;
    missing: number;
    issues: number;
  };
  components: OverviewComponent[];
}

function health(status: ComponentStatus): ComponentHealth {
  if (!status.exists) return "missing";
  if (status.issues.length > 0) return "issue";
  if (status.git?.dirty) return "dirty";
  return "ready";
}

export function buildStackOverview(stack: LoadedStack): StackOverview {
  const components = getComponentStatuses(stack).map((status) => {
    const definition = stack.manifest.components.find((component) => component.id === status.id)!;
    return {
      ...status,
      name: definition.name ?? definition.id,
      health: health(status),
    };
  });
  const identity = stackIdentity(stack.manifest);
  const componentDirectory = stack.manifest.workspace?.directory ?? ".stack-workspace";
  const stateDirectory = stack.stateRoot ?? path.resolve(stack.root, stack.manifest.workspace?.stateDirectory ?? ".stacks");
  return {
    schemaVersion: "0.1",
    stack: {
      ...identity,
      ...(stack.manifest.metadata.description === undefined ? {} : { description: stack.manifest.metadata.description }),
      ...(stack.manifest.metadata.version === undefined ? {} : { version: stack.manifest.metadata.version }),
    },
    workspace: {
      mode: stack.registered ? "registered" : "legacy-directory",
      definitionPath: stack.manifestPath,
      ...(!stack.registered ? { legacyRoot: stack.root, legacyComponentDirectory: path.resolve(stack.root, componentDirectory) } : {}),
      stateDirectory,
    },
    summary: {
      components: components.length,
      ready: components.filter((component) => component.health === "ready").length,
      dirty: components.filter((component) => component.health === "dirty").length,
      missing: components.filter((component) => component.health === "missing").length,
      issues: components.filter((component) => component.health === "issue").length,
    },
    components,
  };
}
