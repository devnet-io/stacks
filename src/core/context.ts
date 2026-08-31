import { statSync } from "node:fs";
import type {
  ContextPath,
  ContextPlan,
  ContextPlanItem,
  Guidance,
  GuidanceStrength,
  LoadedStack,
  StackComponent,
} from "./types.ts";
import { componentRoot, containsGlob, contextAbsolutePath } from "./paths.ts";

const STRENGTH_PRIORITY: Record<GuidanceStrength, number> = {
  required: 1000,
  preferred: 500,
  reference: 100,
};

function normalizeStrength(value: GuidanceStrength | undefined): GuidanceStrength {
  return value ?? "reference";
}

function itemPriority(item: ContextPath): number {
  return item.priority ?? STRENGTH_PRIORITY[normalizeStrength(item.strength)];
}

function evidence(absolutePath: string): { exists: boolean; estimatedBytes?: number } {
  if (containsGlob(absolutePath)) return { exists: false };
  try {
    const stats = statSync(absolutePath);
    if (stats.isFile()) return { exists: true, estimatedBytes: stats.size };
    return { exists: true };
  } catch {
    return { exists: false };
  }
}

function guidanceApplies(guidance: Guidance, capability?: string): boolean {
  if (!guidance.appliesTo || guidance.appliesTo.length === 0) return true;
  return capability !== undefined && guidance.appliesTo.includes(capability);
}

function taskTokens(task: string | undefined): Set<string> {
  return new Set((task?.toLowerCase().match(/[a-z0-9][a-z0-9._-]{2,}/gu) ?? []).filter((token) => !["and", "the", "for", "with", "from", "this", "that"].includes(token)));
}

function taskScore(descriptor: ContextPath, reason: string, capability: string | undefined, tokens: Set<string>): number {
  if (tokens.size === 0) return 0;
  const searchable = [descriptor.path, descriptor.description ?? "", ...(descriptor.tags ?? []), reason, capability ?? ""].join(" ").toLowerCase();
  return [...tokens].filter((token) => searchable.includes(token)).length;
}

export function resolveContext(stack: LoadedStack, targetComponentId: string, task?: string): ContextPlan {
  const components = new Map(stack.manifest.components.map((component) => [component.id, component]));
  const providers = new Map<string, StackComponent[]>();
  for (const component of stack.manifest.components) {
    for (const provided of component.provides ?? []) {
      const list = providers.get(provided.capability) ?? [];
      list.push(component);
      providers.set(provided.capability, list);
    }
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const merged = new Map<string, ContextPlanItem>();
  const tokens = taskTokens(task);

  const addItem = (
    ownerId: string,
    ownerRoot: string,
    descriptor: ContextPath,
    reason: string,
    chain: string[],
    capability?: string,
  ) => {
    let absolutePath: string;
    try {
      absolutePath = contextAbsolutePath(ownerRoot, descriptor.path, `${ownerId} context path`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return;
    }
    const strength = normalizeStrength(descriptor.strength);
    const observed = evidence(absolutePath);
    const relevance = taskScore(descriptor, reason, capability, tokens);
    const key = `${ownerId}\u0000${absolutePath}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      if (capability && !existing.capabilities.includes(capability)) existing.capabilities.push(capability);
      if (!existing.chains.some((candidate) => candidate.join("\u0000") === chain.join("\u0000"))) existing.chains.push(chain);
      existing.priority = Math.max(existing.priority, itemPriority(descriptor));
      if (STRENGTH_PRIORITY[strength] > STRENGTH_PRIORITY[existing.strength]) existing.strength = strength;
      existing.exists = existing.exists || observed.exists;
      if (observed.estimatedBytes !== undefined) {
        existing.estimatedBytes = Math.max(existing.estimatedBytes ?? 0, observed.estimatedBytes);
      }
      for (const tag of descriptor.tags ?? []) if (!existing.tags.includes(tag)) existing.tags.push(tag);
      existing.taskScore = Math.max(existing.taskScore, relevance);
      if (existing.description === undefined && descriptor.description !== undefined) existing.description = descriptor.description;
      return;
    }
    merged.set(key, {
      componentId: ownerId,
      path: descriptor.path,
      absolutePath,
      strength,
      priority: itemPriority(descriptor),
      reasons: [reason],
      capabilities: capability ? [capability] : [],
      chains: [chain],
      exists: observed.exists,
      ...(descriptor.description === undefined ? {} : { description: descriptor.description }),
      tags: [...(descriptor.tags ?? [])],
      taskScore: relevance,
      ...(observed.estimatedBytes === undefined ? {} : { estimatedBytes: observed.estimatedBytes }),
    });
  };

  for (const always of stack.manifest.context?.always ?? []) {
    addItem("$stack", stack.root, always, "stack-wide context", ["$stack", targetComponentId]);
  }

  const target = components.get(targetComponentId);
  if (!target) {
    errors.push(`Unknown target component: ${targetComponentId}.`);
    return {
      schemaVersion: "0.1",
      stackId: stack.manifest.metadata.id,
      targetComponentId,
      ...(task === undefined ? {} : { task }),
      generatedAt: new Date().toISOString(),
      items: [],
      warnings,
      errors,
    };
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (component: StackComponent, chain: string[], reason: string, activeCapability?: string) => {
    if (visiting.has(component.id)) {
      warnings.push(`Context dependency cycle encountered: ${[...chain, component.id].join(" -> ")}.`);
      return;
    }
    const visitKey = `${component.id}\u0000${activeCapability ?? ""}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);
    visiting.add(component.id);

    const root = componentRoot(stack, component);
    for (const guidance of component.guidance ?? []) {
      if (guidanceApplies(guidance, activeCapability)) {
        addItem(component.id, root, guidance, reason, chain, activeCapability);
      }
    }

    for (const dependencyId of component.dependsOn ?? []) {
      const dependency = components.get(dependencyId);
      if (!dependency) {
        errors.push(`Component ${component.id} depends on missing component ${dependencyId}.`);
        continue;
      }
      visit(dependency, [...chain, dependency.id], `explicit dependency of ${component.id}`);
    }

    for (const requirement of component.consumes ?? []) {
      let provider: StackComponent | undefined;
      if (requirement.from) {
        provider = components.get(requirement.from);
        if (!provider) {
          errors.push(`Component ${component.id} requires ${requirement.capability} from unknown provider ${requirement.from}.`);
          continue;
        }
        if (!(provider.provides ?? []).some((item) => item.capability === requirement.capability)) {
          errors.push(`Component ${component.id} requires ${requirement.capability} from ${provider.id}, but that component does not provide it.`);
          continue;
        }
      } else {
        const candidates = providers.get(requirement.capability) ?? [];
        if (candidates.length === 0) {
          const message = `No provider found for ${component.id} requirement ${requirement.capability}.`;
          if (requirement.optional) warnings.push(message);
          else errors.push(message);
          continue;
        }
        if (candidates.length > 1) {
          errors.push(
            `Ambiguous providers for ${component.id} requirement ${requirement.capability}: ${candidates.map((candidate) => candidate.id).join(", ")}. Set from explicitly.`,
          );
          continue;
        }
        provider = candidates[0];
      }

      if (!provider) continue;
      const providerRoot = componentRoot(stack, provider);
      const exportDefinition = (provider.provides ?? []).find((item) => item.capability === requirement.capability);
      const nextChain = [...chain, `${requirement.capability}@${provider.id}`];
      for (const context of exportDefinition?.context ?? []) {
        addItem(
          provider.id,
          providerRoot,
          context,
          `${component.id} consumes ${requirement.capability} from ${provider.id}`,
          nextChain,
          requirement.capability,
        );
      }
      visit(provider, nextChain, `provider guidance for ${requirement.capability}`, requirement.capability);
    }

    visiting.delete(component.id);
  };

  visit(target, [target.id], `target guidance for ${target.id}`);

  const items = [...merged.values()].sort((left, right) => {
    const strengthDifference = STRENGTH_PRIORITY[right.strength] - STRENGTH_PRIORITY[left.strength];
    if (strengthDifference !== 0) return strengthDifference;
    if (right.taskScore !== left.taskScore) return right.taskScore - left.taskScore;
    if (right.priority !== left.priority) return right.priority - left.priority;
    const targetDifference = Number(right.componentId === targetComponentId) - Number(left.componentId === targetComponentId);
    if (targetDifference !== 0) return targetDifference;
    const componentDifference = left.componentId.localeCompare(right.componentId);
    if (componentDifference !== 0) return componentDifference;
    return left.path.localeCompare(right.path);
  });

  return {
    schemaVersion: "0.1",
    stackId: stack.manifest.metadata.id,
    targetComponentId,
    ...(task === undefined ? {} : { task }),
    generatedAt: new Date().toISOString(),
    items,
    warnings,
    errors,
  };
}
