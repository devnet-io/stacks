import path from "node:path";
import type { EventActor, LoadedStack, StackEvent, StackManifest, UsageData, UsageReport } from "../core/types.ts";
import { addRegisteredComponent, bindRegisteredComponent, createRegisteredStack, findRegisteredComponentMemberships, listRegisteredStacks, loadRegisteredStack, type ComponentMembership, type PlatformDirectories } from "../core/catalog.ts";
import { resolveContext } from "../core/context.ts";
import { completeTurn, completeWork, importUsage, readEvents, recordComponentAdded, recordComponentBindingChanged, recordStackCreated, startTurn as startCoreTurn, startWork } from "../core/events.ts";
import { syncComponent } from "../core/git.ts";
import { initializeStack } from "../core/init.ts";
import { writeLockSnapshot } from "../core/lock.ts";
import { inspectManifest, loadStack } from "../core/manifest.ts";
import { getComponentStatuses } from "../core/status.ts";
import { buildUsageReport } from "../core/usage.ts";
import { buildStackGraph, type StackGraph } from "./graph.ts";
import { buildStackIntegrations, type HostedMcpConfiguration, type StackIntegrations } from "./integrations.ts";
import { buildStackOverview, type StackOverview } from "./overview.ts";
import { buildStackActivity, type StackActivity } from "./activity.ts";
import { initOutput, lockOutput, stackIdentity, statusOutput, syncOutput, validateOutput, type InitOutput, type LockOutput, type StackIdentity, type StatusOutput, type SyncOutput, type ValidateOutput } from "./contracts.ts";

export type StackReference = { stack: string; root?: never } | { root: string; stack?: never };

export interface StackDefinitionOutput {
  schemaVersion: "0.1";
  definitionPath: string;
  manifest: StackManifest;
  bindings: Record<string, string>;
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
}

export interface ComponentListOutput {
  schemaVersion: "0.1";
  stack: StackIdentity;
  components: Array<{ component: StackManifest["components"][number]; binding?: string }>;
}

export interface MembershipOutput {
  schemaVersion: "0.1";
  path: string;
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
  turn: StackEvent;
  context: ReturnType<typeof resolveContext>;
}

export interface StacksApplication {
  listStacks(): Promise<StackIdentity[]>;
  createStack(selector: string, options?: MutationOptions): Promise<StackIdentity>;
  findMemberships(directory: string): Promise<MembershipOutput>;
  listComponents(stack: string): Promise<ComponentListOutput>;
  getComponent(stack: string, componentId: string): Promise<ComponentOutput>;
  addComponent(input: AddComponentInput): Promise<ComponentMutationOutput>;
  bindComponent(stack: string, componentId: string, localPath: string, options?: BindComponentOptions): Promise<ComponentMutationOutput>;
  getStack(reference: StackReference): Promise<StackDefinitionOutput>;
  initializeLegacyStack(root: string, namespace: string, name: string): Promise<InitOutput>;
  validateStack(reference: StackReference): Promise<ValidateOutput>;
  getStatus(reference: StackReference): Promise<StatusOutput>;
  getCatalogStatus(): Promise<CatalogStatusOutput>;
  sync(reference: StackReference, options: { dryRun: boolean; update: boolean }): Promise<SyncOutput>;
  lock(reference: StackReference): Promise<LockOutput>;
  resolveContext(reference: StackReference, target: string, task?: string): Promise<ReturnType<typeof resolveContext>>;
  startWork(reference: StackReference, input: { componentId: string; summary: string; workId?: string; actor?: EventActor }): Promise<StackEvent>;
  startTurn(reference: StackReference, input: { sessionId: string; task: string }): Promise<TurnStartOutput>;
  completeTurn(reference: StackReference, input: { sessionId: string; turnId: string; summary: string; status?: "progress" | "blocked" | "failed" | "complete"; changedPaths?: string[]; nextStep?: string; usage?: UsageData }): ReturnType<typeof completeTurn>;
  completeWork(reference: StackReference, input: { sessionId: string; summary: string; outcome?: "success" | "partial" | "failed" | "cancelled"; remaining?: string[] }): Promise<StackEvent>;
  importUsage(reference: StackReference, input: { sessionId?: string; turnId?: string; componentId?: string; workId?: string; actor?: EventActor; usage: UsageData }): Promise<StackEvent>;
  getUsageReport(reference: StackReference): Promise<UsageReport>;
  getOverview(reference: StackReference): Promise<StackOverview>;
  getActivity(reference: StackReference): Promise<StackActivity>;
  getGraph(reference: StackReference): Promise<StackGraph>;
  getIntegrations(reference: StackReference): Promise<StackIntegrations>;
}

export interface LocalStacksApplicationOptions {
  catalogDirectories?: PlatformDirectories;
  hostedMcp?: HostedMcpConfiguration;
}

function definition(stack: LoadedStack): StackDefinitionOutput {
  return { schemaVersion: "0.1", definitionPath: stack.manifestPath, manifest: stack.manifest, bindings: stack.bindings ?? {} };
}

export class LocalStacksApplication implements StacksApplication {
  private readonly options: LocalStacksApplicationOptions;

  constructor(options: LocalStacksApplicationOptions = {}) {
    this.options = options;
  }

  private load(reference: StackReference): Promise<LoadedStack> {
    return "stack" in reference
      ? loadRegisteredStack(reference.stack, this.options.catalogDirectories)
      : loadStack(reference.root);
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
    return { schemaVersion: "0.1", path: path.resolve(directory), memberships: await findRegisteredComponentMemberships(directory, this.options.catalogDirectories) };
  }

  async listComponents(stack: string): Promise<ComponentListOutput> {
    const loaded = await loadRegisteredStack(stack, this.options.catalogDirectories);
    return {
      schemaVersion: "0.1",
      stack: stackIdentity(loaded.manifest),
      components: loaded.manifest.components.map((component) => ({ component, ...(loaded.bindings?.[component.id] ? { binding: loaded.bindings[component.id] } : {}) })),
    };
  }

  async getComponent(stack: string, componentId: string): Promise<ComponentOutput> {
    const loaded = await loadRegisteredStack(stack, this.options.catalogDirectories);
    const component = loaded.manifest.components.find((candidate) => candidate.id === componentId);
    if (!component) throw new Error(`Unknown component ${componentId} in ${loaded.manifest.metadata.namespace}/${loaded.manifest.metadata.name}.`);
    return { schemaVersion: "0.1", stack: stackIdentity(loaded.manifest), component, ...(loaded.bindings?.[componentId] ? { binding: loaded.bindings[componentId] } : {}) };
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
    return { ...definition(loaded), sync: await syncComponent(loaded, added) };
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
    return { ...definition(loaded), sync: await syncComponent(loaded, component, options.materialize === false ? { dryRun: true } : {}) };
  }

  async getStack(reference: StackReference): Promise<StackDefinitionOutput> {
    return definition(await this.load(reference));
  }

  async initializeLegacyStack(root: string, namespace: string, name: string): Promise<InitOutput> {
    const manifestPath = await initializeStack(root, namespace, name);
    return initOutput(await loadStack(manifestPath));
  }

  async validateStack(reference: StackReference): Promise<ValidateOutput> {
    if ("stack" in reference) {
      const stack = await this.load(reference);
      return validateOutput({ manifestPath: stack.manifestPath, parsed: stack.manifest, valid: true, errors: [] });
    }
    return validateOutput(await inspectManifest(reference.root));
  }

  async getStatus(reference: StackReference): Promise<StatusOutput> {
    const stack = await this.load(reference);
    return statusOutput(stack, getComponentStatuses(stack));
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

  async resolveContext(reference: StackReference, target: string, task?: string): Promise<ReturnType<typeof resolveContext>> {
    return resolveContext(await this.load(reference), target, task);
  }

  async startWork(reference: StackReference, input: Parameters<typeof startWork>[1]): Promise<StackEvent> {
    return startWork(await this.load(reference), input);
  }

  async startTurn(reference: StackReference, input: { sessionId: string; task: string }): Promise<TurnStartOutput> {
    const stack = await this.load(reference);
    const history = await readEvents(stack);
    const session = history.events.find((event) => event.type === "work.started" && event.sessionId === input.sessionId);
    if (!session?.componentId) throw new Error(`No component-scoped work.started event found for session ${input.sessionId}.`);
    const context = resolveContext(stack, session.componentId, input.task);
    const turn = await startCoreTurn(stack, {
      sessionId: input.sessionId,
      context: { generatedAt: context.generatedAt, items: context.items.length, warnings: context.warnings.length, errors: context.errors.length },
    });
    return { schemaVersion: "0.1", turn, context };
  }

  async completeTurn(reference: StackReference, input: Parameters<typeof completeTurn>[1]): ReturnType<typeof completeTurn> {
    return completeTurn(await this.load(reference), input);
  }

  async completeWork(reference: StackReference, input: Parameters<typeof completeWork>[1]): Promise<StackEvent> {
    return completeWork(await this.load(reference), input);
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
