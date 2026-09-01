import path from "node:path";
import type { CapabilityExport, CapabilityRequirement, ComponentDescriptorReport, ContextBriefing, ContextPlan, EventActor, Guidance, LoadedStack, StackEvent, StackManifest, UsageData, UsageReport } from "../core/types.ts";
import { addRegisteredComponent, bindRegisteredComponent, configureRegisteredCapabilityExport, configureRegisteredCapabilityRequirement, configureRegisteredGuidance, createRegisteredStack, findRegisteredComponentMemberships, listRegisteredStacks, loadRegisteredStack, updateRegisteredComponentMetadata, type ComponentMembership, type ComponentMetadataPatch, type PlatformDirectories } from "../core/catalog.ts";
import { resolveContext } from "../core/context.ts";
import { materializeContextBriefing, type BriefingOptions } from "../core/briefing.ts";
import { completeTurn, completeWork, createCapabilityRequest, importUsage, readEvents, recordComponentAdded, recordComponentBindingChanged, recordComponentConfigurationChanged, recordStackCreated, startTurn as startCoreTurn, startWork, transitionCapabilityRequest } from "../core/events.ts";
import { syncComponent } from "../core/git.ts";
import { initializeStack } from "../core/init.ts";
import { writeLockSnapshot } from "../core/lock.ts";
import { inspectManifest, loadStack } from "../core/manifest.ts";
import { getComponentStatuses } from "../core/status.ts";
import { buildUsageReport } from "../core/usage.ts";
import { buildStackGraph, type StackGraph } from "./graph.ts";
import { buildStackIntegrations, type HostedMcpConfiguration, type StackIntegrations } from "./integrations.ts";
import { buildStackOverview, type StackOverview } from "./overview.ts";
import { buildActivityTurnDetail, buildActivityWorkDetail, buildStackActivity, type ActivityTurnDetail, type ActivityWorkDetail, type StackActivity } from "./activity.ts";
import { buildCapabilityRequestDetail, buildCapabilityRequestList, relevantCapabilityRequests, type CapabilityRequestDetail, type CapabilityRequestList, type CapabilityRequestSummary } from "./capability-requests.ts";
import { initOutput, lockOutput, stackIdentity, statusOutput, syncOutput, validateOutput, type InitOutput, type LockOutput, type StackIdentity, type StatusOutput, type SyncOutput, type ValidateOutput } from "./contracts.ts";
import { resolveComponentDescriptors, type ComponentDescriptorResolution } from "../core/component-descriptor.ts";
import { buildArtifactGuidance, type ArtifactGuidance } from "../core/artifacts.ts";

export type StackReference = { stack: string; root?: never } | { root: string; stack?: never };

export interface StackDefinitionOutput {
  schemaVersion: "0.1";
  definitionPath: string;
  manifest: StackManifest;
  effectiveManifest: StackManifest;
  bindings: Record<string, string>;
  descriptors: Record<string, ComponentDescriptorReport>;
}

export interface CatalogStatusOutput {
  schemaVersion: "0.1";
  stacks: StatusOutput[];
}

export interface ComponentOutput {
  schemaVersion: "0.1";
  stack: StackIdentity;
  component: StackManifest["components"][number];
  binding?: string;
  descriptor: ComponentDescriptorReport;
}

export interface ComponentListOutput {
  schemaVersion: "0.1";
  stack: StackIdentity;
  components: Array<{ component: StackManifest["components"][number]; binding?: string; descriptor: ComponentDescriptorReport }>;
}

export interface MembershipOutput {
  schemaVersion: "0.1";
  path: string;
  resolution: "component" | "ancestor" | "none";
  memberships: ComponentMembership[];
}

export interface AddComponentInput {
  stack: string;
  id: string;
  path: string;
  kind?: string;
  git?: string;
  name?: string;
  actor?: EventActor;
}

export interface MutationOptions {
  actor?: EventActor;
}

export interface BindComponentOptions extends MutationOptions {
  materialize?: boolean;
}

export interface ComponentMutationOutput extends StackDefinitionOutput {
  sync: Awaited<ReturnType<typeof syncComponent>>;
}

export interface TurnStartOutput {
  schemaVersion: "0.1";
  sessionId: string;
  turnId: string;
  turn: StackEvent;
  context: ResolvedContext;
}

export interface ResolvedContext extends ContextPlan { briefing: ContextBriefing; capabilityRequests: CapabilityRequestSummary[]; artifactGuidance: ArtifactGuidance[] }

export interface StacksApplication {
  listStacks(): Promise<StackIdentity[]>;
  createStack(selector: string, options?: MutationOptions): Promise<StackIdentity>;
  findMemberships(directory: string): Promise<MembershipOutput>;
  listComponents(stack: string): Promise<ComponentListOutput>;
  getComponent(stack: string, componentId: string): Promise<ComponentOutput>;
  addComponent(input: AddComponentInput): Promise<ComponentMutationOutput>;
  bindComponent(stack: string, componentId: string, localPath: string, options?: BindComponentOptions): Promise<ComponentMutationOutput>;
  updateComponent(stack: string, componentId: string, value: ComponentMetadataPatch, options?: MutationOptions): Promise<ComponentOutput>;
  configureCapabilityExport(stack: string, componentId: string, value: CapabilityExport, options?: MutationOptions): Promise<ComponentOutput>;
  configureCapabilityRequirement(stack: string, componentId: string, value: CapabilityRequirement, options?: MutationOptions): Promise<ComponentOutput>;
  configureGuidance(stack: string, componentId: string, value: Guidance, options?: MutationOptions): Promise<ComponentOutput>;
  getStack(reference: StackReference): Promise<StackDefinitionOutput>;
  initializeLegacyStack(root: string, namespace: string, name: string): Promise<InitOutput>;
  validateStack(reference: StackReference): Promise<ValidateOutput>;
  getStatus(reference: StackReference): Promise<StatusOutput>;
  getCatalogStatus(): Promise<CatalogStatusOutput>;
  sync(reference: StackReference, options: { dryRun: boolean; update: boolean }): Promise<SyncOutput>;
  lock(reference: StackReference): Promise<LockOutput>;
  resolveContext(reference: StackReference, target: string, task?: string, options?: BriefingOptions): Promise<ResolvedContext>;
  startWork(reference: StackReference, input: { componentId: string; summary: string; workId?: string; actor?: EventActor }): Promise<StackEvent>;
  startTurn(reference: StackReference, input: { sessionId: string; task: string; maxBytes?: number }): Promise<TurnStartOutput>;
  completeTurn(reference: StackReference, input: { sessionId: string; turnId: string; summary: string; status?: "progress" | "blocked" | "failed" | "complete"; changedPaths?: string[]; nextStep?: string; usage?: UsageData }): ReturnType<typeof completeTurn>;
  completeWork(reference: StackReference, input: { sessionId: string; summary: string; outcome?: "success" | "partial" | "failed" | "cancelled"; remaining?: string[] }): Promise<StackEvent>;
  createCapabilityRequest(reference: StackReference, input: Parameters<typeof createCapabilityRequest>[1]): Promise<CapabilityRequestDetail>;
  transitionCapabilityRequest(reference: StackReference, input: Parameters<typeof transitionCapabilityRequest>[1]): Promise<CapabilityRequestDetail>;
  listCapabilityRequests(reference: StackReference): Promise<CapabilityRequestList>;
  getCapabilityRequest(reference: StackReference, requestId: string): Promise<CapabilityRequestDetail>;
  importUsage(reference: StackReference, input: { sessionId?: string; turnId?: string; componentId?: string; workId?: string; actor?: EventActor; usage: UsageData }): Promise<StackEvent>;
  getUsageReport(reference: StackReference): Promise<UsageReport>;
  getOverview(reference: StackReference): Promise<StackOverview>;
  getActivity(reference: StackReference): Promise<StackActivity>;
  getActivityWork(reference: StackReference, sessionId: string): Promise<ActivityWorkDetail>;
  getActivityTurn(reference: StackReference, sessionId: string, turnId: string): Promise<ActivityTurnDetail>;
  getGraph(reference: StackReference): Promise<StackGraph>;
  getIntegrations(reference: StackReference): Promise<StackIntegrations>;
}

export interface LocalStacksApplicationOptions {
  catalogDirectories?: PlatformDirectories;
  hostedMcp?: HostedMcpConfiguration;
}

function definition(declared: LoadedStack, resolution: ComponentDescriptorResolution): StackDefinitionOutput {
  return { schemaVersion: "0.1", definitionPath: declared.manifestPath, manifest: declared.manifest, effectiveManifest: resolution.stack.manifest, bindings: declared.bindings ?? {}, descriptors: resolution.reports };
}

function descriptorDiagnostics(reports: Record<string, ComponentDescriptorReport>): string[] {
  return Object.values(reports).flatMap((report) => report.status === "invalid" || report.status === "unavailable"
    ? report.errors.map((error) => `Component ${report.componentId} descriptor ${report.status}: ${error}`)
    : []);
}

export class LocalStacksApplication implements StacksApplication {
  private readonly options: LocalStacksApplicationOptions;

  constructor(options: LocalStacksApplicationOptions = {}) {
    this.options = options;
  }

  private rawLoad(reference: StackReference): Promise<LoadedStack> {
    return "stack" in reference
      ? loadRegisteredStack(reference.stack, this.options.catalogDirectories)
      : loadStack(reference.root);
  }

  private async resolved(reference: StackReference): Promise<{ declared: LoadedStack; resolution: ComponentDescriptorResolution }> {
    const declared = await this.rawLoad(reference);
    return { declared, resolution: await resolveComponentDescriptors(declared) };
  }

  private async load(reference: StackReference): Promise<LoadedStack> {
    return (await this.resolved(reference)).resolution.stack;
  }

  async listStacks(): Promise<StackIdentity[]> {
    return (await listRegisteredStacks(this.options.catalogDirectories)).map(({ id, namespace, name }) => ({ id, namespace, name }));
  }

  async createStack(selector: string, options: MutationOptions = {}): Promise<StackIdentity> {
    const stack = await createRegisteredStack(selector, this.options.catalogDirectories);
    await recordStackCreated(stack, options.actor);
    return stackIdentity(stack.manifest);
  }

  async findMemberships(directory: string): Promise<MembershipOutput> {
    const memberships = await findRegisteredComponentMemberships(directory, this.options.catalogDirectories);
    return {
      schemaVersion: "0.1",
      path: path.resolve(directory),
      resolution: memberships[0]?.relationship ?? "none",
      memberships,
    };
  }

  async listComponents(stack: string): Promise<ComponentListOutput> {
    const { resolution } = await this.resolved({ stack });
    const loaded = resolution.stack;
    return {
      schemaVersion: "0.1",
      stack: stackIdentity(loaded.manifest),
      components: loaded.manifest.components.map((component) => ({ component, ...(loaded.bindings?.[component.id] ? { binding: loaded.bindings[component.id] } : {}), descriptor: resolution.reports[component.id]! })),
    };
  }

  async getComponent(stack: string, componentId: string): Promise<ComponentOutput> {
    const { resolution } = await this.resolved({ stack });
    const loaded = resolution.stack;
    const component = loaded.manifest.components.find((candidate) => candidate.id === componentId);
    if (!component) throw new Error(`Unknown component ${componentId} in ${loaded.manifest.metadata.namespace}/${loaded.manifest.metadata.name}.`);
    return { schemaVersion: "0.1", stack: stackIdentity(loaded.manifest), component, ...(loaded.bindings?.[componentId] ? { binding: loaded.bindings[componentId] } : {}), descriptor: resolution.reports[componentId]! };
  }

  async addComponent(input: AddComponentInput): Promise<ComponentMutationOutput> {
    const { stack, actor, ...component } = input;
    const loaded = await addRegisteredComponent(stack, component, this.options.catalogDirectories);
    const added = loaded.manifest.components.find((candidate) => candidate.id === input.id)!;
    await recordComponentAdded(loaded, {
      componentId: added.id,
      path: loaded.bindings![added.id]!,
      kind: added.kind ?? "component",
      sourceType: added.source.type === "git" ? "git" : "local",
      ...(actor === undefined ? {} : { actor }),
    });
    return { ...definition(loaded, await resolveComponentDescriptors(loaded)), sync: await syncComponent(loaded, added) };
  }

  async bindComponent(stack: string, componentId: string, localPath: string, options: BindComponentOptions = {}): Promise<ComponentMutationOutput> {
    const before = await loadRegisteredStack(stack, this.options.catalogDirectories);
    const previousPath = before.bindings?.[componentId];
    const loaded = await bindRegisteredComponent(stack, componentId, localPath, this.options.catalogDirectories);
    const component = loaded.manifest.components.find((candidate) => candidate.id === componentId)!;
    const boundPath = loaded.bindings![componentId]!;
    if (previousPath !== boundPath) {
      await recordComponentBindingChanged(loaded, {
        componentId,
        path: boundPath,
        ...(previousPath === undefined ? {} : { previousPath }),
        ...(options.actor === undefined ? {} : { actor: options.actor }),
      });
    }
    return { ...definition(loaded, await resolveComponentDescriptors(loaded)), sync: await syncComponent(loaded, component, options.materialize === false ? { dryRun: true } : {}) };
  }

  private async configuredComponent(
    loaded: LoadedStack,
    changed: boolean,
    componentId: string,
    configuration: "metadata" | "capability-export" | "capability-requirement" | "guidance",
    subject: string,
    actor?: EventActor,
  ): Promise<ComponentOutput> {
    if (changed) await recordComponentConfigurationChanged(loaded, { componentId, configuration, subject, ...(actor === undefined ? {} : { actor }) });
    const resolution = await resolveComponentDescriptors(loaded);
    const component = resolution.stack.manifest.components.find((candidate) => candidate.id === componentId)!;
    return { schemaVersion: "0.1", stack: stackIdentity(loaded.manifest), component, ...(loaded.bindings?.[componentId] ? { binding: loaded.bindings[componentId] } : {}), descriptor: resolution.reports[componentId]! };
  }

  async configureCapabilityExport(stack: string, componentId: string, value: CapabilityExport, options: MutationOptions = {}): Promise<ComponentOutput> {
    const configured = await configureRegisteredCapabilityExport(stack, componentId, value, this.options.catalogDirectories);
    return this.configuredComponent(configured.stack, configured.changed, componentId, "capability-export", value.capability, options.actor);
  }

  async updateComponent(stack: string, componentId: string, value: ComponentMetadataPatch, options: MutationOptions = {}): Promise<ComponentOutput> {
    if (Object.keys(value).length === 0) throw new Error("Supply at least one editable component field.");
    for (const [field, candidate] of Object.entries(value)) {
      if (candidate !== null && typeof candidate === "string" && !candidate.trim()) throw new Error(`${field} must be non-empty when supplied.`);
    }
    const normalized: ComponentMetadataPatch = {
      ...(value.name === undefined ? {} : { name: value.name === null ? null : value.name.trim() }),
      ...(value.description === undefined ? {} : { description: value.description === null ? null : value.description.trim() }),
      ...(value.kind === undefined ? {} : { kind: value.kind.trim() }),
      ...(value.access === undefined ? {} : { access: value.access }),
    };
    const configured = await updateRegisteredComponentMetadata(stack, componentId, normalized, this.options.catalogDirectories);
    return this.configuredComponent(configured.stack, configured.changed, componentId, "metadata", Object.keys(value).join(", "), options.actor);
  }

  async configureCapabilityRequirement(stack: string, componentId: string, value: CapabilityRequirement, options: MutationOptions = {}): Promise<ComponentOutput> {
    const configured = await configureRegisteredCapabilityRequirement(stack, componentId, value, this.options.catalogDirectories);
    return this.configuredComponent(configured.stack, configured.changed, componentId, "capability-requirement", value.capability, options.actor);
  }

  async configureGuidance(stack: string, componentId: string, value: Guidance, options: MutationOptions = {}): Promise<ComponentOutput> {
    const configured = await configureRegisteredGuidance(stack, componentId, value, this.options.catalogDirectories);
    return this.configuredComponent(configured.stack, configured.changed, componentId, "guidance", value.path, options.actor);
  }

  async getStack(reference: StackReference): Promise<StackDefinitionOutput> {
    const { declared, resolution } = await this.resolved(reference);
    return definition(declared, resolution);
  }

  async initializeLegacyStack(root: string, namespace: string, name: string): Promise<InitOutput> {
    const manifestPath = await initializeStack(root, namespace, name);
    return initOutput(await loadStack(manifestPath));
  }

  async validateStack(reference: StackReference): Promise<ValidateOutput> {
    if ("stack" in reference) {
      const { declared, resolution } = await this.resolved(reference);
      const errors = descriptorDiagnostics(resolution.reports);
      return validateOutput({ manifestPath: declared.manifestPath, parsed: declared.manifest, valid: errors.length === 0, errors });
    }
    return validateOutput(await inspectManifest(reference.root));
  }

  async getStatus(reference: StackReference): Promise<StatusOutput> {
    const { resolution } = await this.resolved(reference);
    const statuses = getComponentStatuses(resolution.stack);
    for (const status of statuses) {
      const report = resolution.reports[status.id]!;
      if (report.status === "invalid" || report.status === "unavailable") status.issues.push(...report.errors.map((error) => `Component descriptor ${report.status}: ${error}`));
    }
    return statusOutput(resolution.stack, statuses);
  }

  async getCatalogStatus(): Promise<CatalogStatusOutput> {
    const identities = await this.listStacks();
    return { schemaVersion: "0.1", stacks: await Promise.all(identities.map(({ namespace, name }) => this.getStatus({ stack: `${namespace}/${name}` }))) };
  }

  async sync(reference: StackReference, options: { dryRun: boolean; update: boolean }): Promise<SyncOutput> {
    const stack = await this.load(reference);
    const results = await Promise.all(stack.manifest.components.map((component) => syncComponent(stack, component, options)));
    return syncOutput(stack, results);
  }

  async lock(reference: StackReference): Promise<LockOutput> {
    const stack = await this.load(reference);
    return lockOutput(stack, await writeLockSnapshot(stack));
  }

  async resolveContext(reference: StackReference, target: string, task?: string, options: BriefingOptions = {}): Promise<ResolvedContext> {
    const { resolution } = await this.resolved(reference);
    const stack = resolution.stack;
    const plan = resolveContext(stack, target, task);
    plan.warnings.push(...descriptorDiagnostics(resolution.reports));
    const artifacts = buildArtifactGuidance(stack, target);
    plan.warnings.push(...artifacts.warnings);
    const requests = await buildCapabilityRequestList(stack);
    return { ...plan, briefing: await materializeContextBriefing(stack, plan, options), capabilityRequests: relevantCapabilityRequests(requests.requests, target), artifactGuidance: artifacts.guidance };
  }

  async startWork(reference: StackReference, input: Parameters<typeof startWork>[1]): Promise<StackEvent> {
    return startWork(await this.load(reference), input);
  }

  async startTurn(reference: StackReference, input: { sessionId: string; task: string; maxBytes?: number }): Promise<TurnStartOutput> {
    const { resolution } = await this.resolved(reference);
    const stack = resolution.stack;
    const history = await readEvents(stack);
    const session = history.events.find((event) => event.type === "work.started" && event.sessionId === input.sessionId);
    if (!session?.componentId) throw new Error(`No component-scoped work.started event found for session ${input.sessionId}.`);
    const previousTurns = history.events.filter((event) => event.type === "turn.started" && event.sessionId === input.sessionId).length;
    const plan = resolveContext(stack, session.componentId, input.task);
    plan.warnings.push(...descriptorDiagnostics(resolution.reports));
    const artifacts = buildArtifactGuidance(stack, session.componentId);
    plan.warnings.push(...artifacts.warnings);
    const briefing = await materializeContextBriefing(stack, plan, {
      mode: previousTurns === 0 ? "orientation" : "refresh",
      ...(input.maxBytes === undefined ? {} : { maxBytes: input.maxBytes }),
    });
    const requests = await buildCapabilityRequestList(stack);
    const context: ResolvedContext = { ...plan, briefing, capabilityRequests: relevantCapabilityRequests(requests.requests, session.componentId), artifactGuidance: artifacts.guidance };
    const turn = await startCoreTurn(stack, {
      sessionId: input.sessionId,
      context: {
        generatedAt: context.generatedAt,
        items: context.items.length,
        warnings: context.warnings.length,
        errors: context.errors.length,
        briefingDigest: briefing.digest,
        briefingMode: briefing.mode,
        briefingItems: briefing.items.length,
        briefingOmissions: briefing.omissions.length,
        briefingBytes: briefing.budget.usedBytes,
        briefingBudgetBytes: briefing.budget.maxBytes,
      },
    });
    return { schemaVersion: "0.1", sessionId: input.sessionId, turnId: turn.turnId!, turn, context };
  }

  async completeTurn(reference: StackReference, input: Parameters<typeof completeTurn>[1]): ReturnType<typeof completeTurn> {
    return completeTurn(await this.load(reference), input);
  }

  async completeWork(reference: StackReference, input: Parameters<typeof completeWork>[1]): Promise<StackEvent> {
    return completeWork(await this.load(reference), input);
  }

  async createCapabilityRequest(reference: StackReference, input: Parameters<typeof createCapabilityRequest>[1]): Promise<CapabilityRequestDetail> {
    const stack = await this.load(reference);
    const event = await createCapabilityRequest(stack, input);
    return buildCapabilityRequestDetail(stack, event.requestId!);
  }

  async transitionCapabilityRequest(reference: StackReference, input: Parameters<typeof transitionCapabilityRequest>[1]): Promise<CapabilityRequestDetail> {
    const stack = await this.load(reference);
    await transitionCapabilityRequest(stack, input);
    return buildCapabilityRequestDetail(stack, input.requestId);
  }

  async listCapabilityRequests(reference: StackReference): Promise<CapabilityRequestList> {
    return buildCapabilityRequestList(await this.load(reference));
  }

  async getCapabilityRequest(reference: StackReference, requestId: string): Promise<CapabilityRequestDetail> {
    return buildCapabilityRequestDetail(await this.load(reference), requestId);
  }

  async importUsage(reference: StackReference, input: Parameters<typeof importUsage>[1]): Promise<StackEvent> {
    return importUsage(await this.load(reference), input);
  }

  async getUsageReport(reference: StackReference): Promise<UsageReport> {
    return buildUsageReport(await this.load(reference));
  }

  async getOverview(reference: StackReference): Promise<StackOverview> {
    return buildStackOverview(await this.load(reference));
  }

  async getActivity(reference: StackReference): Promise<StackActivity> {
    return buildStackActivity(await this.load(reference));
  }

  async getActivityWork(reference: StackReference, sessionId: string): Promise<ActivityWorkDetail> {
    return buildActivityWorkDetail(await this.load(reference), sessionId);
  }

  async getActivityTurn(reference: StackReference, sessionId: string, turnId: string): Promise<ActivityTurnDetail> {
    return buildActivityTurnDetail(await this.load(reference), sessionId, turnId);
  }

  async getGraph(reference: StackReference): Promise<StackGraph> {
    return buildStackGraph(await this.load(reference));
  }

  async getIntegrations(reference: StackReference): Promise<StackIntegrations> {
    return buildStackIntegrations(await this.load(reference), this.options.hostedMcp);
  }
}

export function createLocalStacksApplication(options: LocalStacksApplicationOptions = {}): StacksApplication {
  return new LocalStacksApplication(options);
}
