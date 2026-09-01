import type { CapabilityRequirement, LoadedStack, StackComponent } from "../core/types.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

export type GraphRelation = "capability" | "dependency";

export interface StackGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  sourceType: "local" | "path" | "git";
  access: "read-only" | "read-write";
  provides: string[];
  consumes: string[];
  artifacts: Array<{ capability: string; ecosystem: string; name: string }>;
}

export interface StackGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: GraphRelation;
  label: string;
  optional: boolean;
}

export interface UnresolvedGraphRequirement {
  componentId: string;
  capability: string;
  optional: boolean;
  reason: "missing-provider" | "unknown-provider" | "provider-mismatch" | "ambiguous-provider";
  candidates: string[];
}

export interface StackGraph {
  schemaVersion: "0.1";
  stack: StackIdentity;
  summary: { components: number; edges: number; capabilities: number; unresolved: number };
  nodes: StackGraphNode[];
  edges: StackGraphEdge[];
  unresolved: UnresolvedGraphRequirement[];
}

function graphNode(component: StackComponent): StackGraphNode {
  return {
    id: component.id,
    name: component.name ?? component.id,
    kind: component.kind ?? "component",
    ...(component.description === undefined ? {} : { description: component.description }),
    sourceType: component.source.type,
    access: component.access ?? "read-write",
    provides: (component.provides ?? []).map((item) => item.capability).sort(),
    consumes: (component.consumes ?? []).map((item) => item.capability).sort(),
    artifacts: (component.provides ?? []).flatMap((item) => item.artifact ? [{ capability: item.capability, ecosystem: item.artifact.ecosystem, name: item.artifact.name }] : []).sort((left, right) => `${left.ecosystem}:${left.name}:${left.capability}`.localeCompare(`${right.ecosystem}:${right.name}:${right.capability}`)),
  };
}

function resolveProvider(
  component: StackComponent,
  requirement: CapabilityRequirement,
  components: Map<string, StackComponent>,
  providers: Map<string, StackComponent[]>,
): { provider?: StackComponent; unresolved?: UnresolvedGraphRequirement } {
  if (requirement.from) {
    const provider = components.get(requirement.from);
    if (!provider) return { unresolved: { componentId: component.id, capability: requirement.capability, optional: requirement.optional ?? false, reason: "unknown-provider", candidates: [] } };
    if (!(provider.provides ?? []).some((item) => item.capability === requirement.capability)) {
      return { unresolved: { componentId: component.id, capability: requirement.capability, optional: requirement.optional ?? false, reason: "provider-mismatch", candidates: [provider.id] } };
    }
    return { provider };
  }
  const candidates = providers.get(requirement.capability) ?? [];
  const onlyProvider = candidates.length === 1 ? candidates[0] : undefined;
  if (onlyProvider) return { provider: onlyProvider };
  return {
    unresolved: {
      componentId: component.id,
      capability: requirement.capability,
      optional: requirement.optional ?? false,
      reason: candidates.length === 0 ? "missing-provider" : "ambiguous-provider",
      candidates: candidates.map((candidate) => candidate.id).sort(),
    },
  };
}

export function buildStackGraph(stack: LoadedStack): StackGraph {
  const components = new Map(stack.manifest.components.map((component) => [component.id, component]));
  const providers = new Map<string, StackComponent[]>();
  for (const component of stack.manifest.components) {
    for (const item of component.provides ?? []) providers.set(item.capability, [...(providers.get(item.capability) ?? []), component]);
  }
  const edges: StackGraphEdge[] = [];
  const unresolved: UnresolvedGraphRequirement[] = [];
  for (const component of stack.manifest.components) {
    for (const dependency of component.dependsOn ?? []) {
      if (components.has(dependency)) edges.push({ id: `dependency:${dependency}:${component.id}`, from: dependency, to: component.id, relation: "dependency", label: "depends on", optional: false });
    }
    for (const requirement of component.consumes ?? []) {
      const resolution = resolveProvider(component, requirement, components, providers);
      if (resolution.provider) {
        edges.push({
          id: `capability:${resolution.provider.id}:${component.id}:${requirement.capability}`,
          from: resolution.provider.id,
          to: component.id,
          relation: "capability",
          label: requirement.capability,
          optional: requirement.optional ?? false,
        });
      } else if (resolution.unresolved) unresolved.push(resolution.unresolved);
    }
  }
  const nodes = stack.manifest.components.map(graphNode).sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  unresolved.sort((left, right) => `${left.componentId}:${left.capability}`.localeCompare(`${right.componentId}:${right.capability}`));
  return {
    schemaVersion: "0.1",
    stack: stackIdentity(stack.manifest),
    summary: { components: nodes.length, edges: edges.length, capabilities: providers.size, unresolved: unresolved.length },
    nodes,
    edges,
    unresolved,
  };
}
