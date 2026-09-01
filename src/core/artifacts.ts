import path from "node:path";
import { realpathSync } from "node:fs";
import { componentRoot, resolveWithin } from "./paths.ts";
import type { CapabilityArtifact, CapabilityRequirement, LoadedStack, StackComponent } from "./types.ts";

export interface ArtifactGuidance {
  capability: string;
  consumerComponentId: string;
  providerComponentId: string;
  artifact: CapabilityArtifact;
  providerRoot: string;
  artifactRoot: string;
  localFallback?: {
    dependencySpecifier: string;
    packageJson: Record<string, string>;
  };
  strategyOrder: ["existing-project-configuration", "workspace", "registry", "local-file"];
  instruction: string;
}

export interface ArtifactGuidanceOutput {
  schemaVersion: "0.1";
  guidance: ArtifactGuidance[];
  warnings: string[];
}

function providerFor(
  requirement: CapabilityRequirement,
  components: Map<string, StackComponent>,
  providers: Map<string, StackComponent[]>,
): StackComponent | undefined {
  if (requirement.from) return components.get(requirement.from);
  const candidates = providers.get(requirement.capability) ?? [];
  return candidates.length === 1 ? candidates[0] : undefined;
}

function fileSpecifier(consumerRoot: string, artifactRoot: string): string {
  let relative = path.relative(consumerRoot, artifactRoot).replaceAll(path.sep, "/");
  if (relative === "") relative = ".";
  if (!relative.startsWith(".") && !path.isAbsolute(relative)) relative = `./${relative}`;
  return `file:${relative}`;
}

function canonicalArtifactRoot(providerRoot: string, configuredRoot: string): string {
  const canonicalProvider = realpathSync(providerRoot);
  const canonicalArtifact = realpathSync(configuredRoot);
  const relative = path.relative(canonicalProvider, canonicalArtifact);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("artifact path resolves outside the provider component root");
  return canonicalArtifact;
}

export function buildArtifactGuidance(stack: LoadedStack, targetComponentId: string): ArtifactGuidanceOutput {
  const components = new Map(stack.manifest.components.map((component) => [component.id, component]));
  const providers = new Map<string, StackComponent[]>();
  for (const component of stack.manifest.components) {
    for (const provided of component.provides ?? []) providers.set(provided.capability, [...(providers.get(provided.capability) ?? []), component]);
  }
  const target = components.get(targetComponentId);
  if (!target) return { schemaVersion: "0.1", guidance: [], warnings: [`Unknown artifact-guidance target: ${targetComponentId}.`] };
  const warnings: string[] = [];
  const guidance: ArtifactGuidance[] = [];
  let consumerRoot: string;
  try { consumerRoot = componentRoot(stack, target); }
  catch (error) { return { schemaVersion: "0.1", guidance: [], warnings: [message(error)] }; }
  for (const requirement of target.consumes ?? []) {
    const provider = providerFor(requirement, components, providers);
    if (!provider) continue;
    const provided = (provider.provides ?? []).find((item) => item.capability === requirement.capability);
    if (!provided?.artifact) continue;
    try {
      const providerRoot = componentRoot(stack, provider);
      const configuredRoot = resolveWithin(providerRoot, provided.artifact.path ?? ".", `${provider.id} artifact path`);
      const artifactRoot = canonicalArtifactRoot(providerRoot, configuredRoot);
      const local = provided.artifact.ecosystem === "npm" ? fileSpecifier(consumerRoot, artifactRoot) : undefined;
      guidance.push({
        capability: requirement.capability,
        consumerComponentId: target.id,
        providerComponentId: provider.id,
        artifact: provided.artifact,
        providerRoot,
        artifactRoot,
        ...(local === undefined ? {} : { localFallback: { dependencySpecifier: local, packageJson: { [provided.artifact.name]: local } } }),
        strategyOrder: ["existing-project-configuration", "workspace", "registry", "local-file"],
        instruction: "Inspect the consumer and provider package configuration first. Preserve an existing dependency, workspace convention, or registry setup. Use the local file dependency only when no established project strategy applies; do not run package-manager commands or lifecycle scripts without the normal authorization for repository changes.",
      });
    } catch (error) {
      warnings.push(`Artifact guidance for ${requirement.capability} from ${provider.id} is unavailable: ${message(error)}`);
    }
  }
  return { schemaVersion: "0.1", guidance, warnings };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
