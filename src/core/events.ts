import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { CapabilityRequestStatus, EventActor, LoadedStack, StackEvent, UsageData } from "./types.ts";
import { stateDirectory } from "./paths.ts";
import { componentById } from "./manifest.ts";

export interface ReadEventsResult {
  events: StackEvent[];
  warnings: string[];
}

export function eventsPath(stack: LoadedStack): string {
  return path.join(stateDirectory(stack), "events.jsonl");
}

export function eventsLockPath(stack: LoadedStack): string {
  return path.join(stateDirectory(stack), "events.lock");
}

type PendingEvent<TData extends Record<string, unknown> = Record<string, unknown>> =
  Omit<StackEvent<TData>, "schemaVersion" | "id" | "timestamp" | "stackId"> & {
    id?: string;
    timestamp?: string;
  };

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withEventAppendLock<T>(stack: LoadedStack, operation: () => Promise<T>): Promise<T> {
  const lock = eventsLockPath(stack);
  await mkdir(path.dirname(lock), { recursive: true });
  let handle;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      handle = await open(lock, "wx");
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const windowsReleaseRace = process.platform === "win32" && (code === "EPERM" || code === "EACCES");
      if (code !== "EEXIST" && !windowsReleaseRace) throw error;
      await wait(25);
    }
  }
  if (!handle) throw new Error(`Timed out waiting for the Stack event writer lock at ${lock}.`);
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, "utf8");
    await handle.sync();
    return await operation();
  } finally {
    await handle.close();
    await unlink(lock).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function completeEvent<TData extends Record<string, unknown>>(stack: LoadedStack, event: PendingEvent<TData>): StackEvent<TData> {
  return {
    schemaVersion: "0.1",
    id: event.id ?? randomUUID(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    type: event.type,
    stackId: stack.manifest.metadata.id,
    ...(event.componentId === undefined ? {} : { componentId: event.componentId }),
    ...(event.sessionId === undefined ? {} : { sessionId: event.sessionId }),
    ...(event.turnId === undefined ? {} : { turnId: event.turnId }),
    ...(event.workId === undefined ? {} : { workId: event.workId }),
    ...(event.requestId === undefined ? {} : { requestId: event.requestId }),
    ...(event.actor === undefined ? {} : { actor: event.actor }),
    data: event.data,
  };
}

async function writeEvents(stack: LoadedStack, events: StackEvent[]): Promise<void> {
  const file = eventsPath(stack);
  const handle = await open(file, "a");
  try {
    await handle.appendFile(events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function appendEvent<TData extends Record<string, unknown>>(
  stack: LoadedStack,
  event: PendingEvent<TData>,
): Promise<StackEvent<TData>> {
  const full = completeEvent(stack, event);
  await withEventAppendLock(stack, () => writeEvents(stack, [full]));
  return full;
}

export async function readEvents(stack: LoadedStack): Promise<ReadEventsResult> {
  const file = eventsPath(stack);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { events: [], warnings: [] };
    throw error;
  }
  const warnings: string[] = [];
  const events: StackEvent[] = [];
  const lines = raw.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as StackEvent);
    } catch {
      warnings.push(`Ignored invalid JSONL event at line ${index + 1}.`);
    }
  }
  return { events, warnings };
}

export async function recordStackCreated(stack: LoadedStack, actor?: EventActor): Promise<StackEvent> {
  const selector = `${stack.manifest.metadata.namespace}/${stack.manifest.metadata.name}`;
  return appendEvent(stack, {
    type: "stack.created",
    ...(actor === undefined ? {} : { actor }),
    data: { summary: `Created Stack ${selector}.` },
  });
}

export async function recordComponentAdded(
  stack: LoadedStack,
  input: { componentId: string; path: string; kind: string; sourceType: "local" | "git"; actor?: EventActor },
): Promise<StackEvent> {
  return appendEvent(stack, {
    type: "component.added",
    componentId: input.componentId,
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    data: {
      summary: `Added component ${input.componentId}.`,
      path: input.path,
      kind: input.kind,
      sourceType: input.sourceType,
    },
  });
}

export async function recordComponentBindingChanged(
  stack: LoadedStack,
  input: { componentId: string; path: string; previousPath?: string; actor?: EventActor },
): Promise<StackEvent> {
  return appendEvent(stack, {
    type: "component.binding.changed",
    componentId: input.componentId,
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    data: {
      summary: `Changed the binding for ${input.componentId}.`,
      path: input.path,
      ...(input.previousPath === undefined ? {} : { previousPath: input.previousPath }),
    },
  });
}

export async function recordComponentConfigurationChanged(
  stack: LoadedStack,
  input: { componentId: string; configuration: "metadata" | "capability-export" | "capability-requirement" | "capability-rename" | "guidance"; subject: string; action?: "configured" | "removed" | "renamed"; actor?: EventActor },
): Promise<StackEvent> {
  return appendEvent(stack, {
    type: "component.configuration.changed",
    componentId: input.componentId,
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    data: {
      summary: `${input.action === "removed" ? "Removed" : input.action === "renamed" ? "Renamed" : "Configured"} ${input.configuration} ${input.subject} for ${input.componentId}.`,
      configuration: input.configuration,
      subject: input.subject,
    },
  });
}

function requireComponent(stack: LoadedStack, componentId: string): void {
  if (!componentById(stack.manifest, componentId)) throw new Error(`Unknown component: ${componentId}.`);
}

const requestTransitions: Record<CapabilityRequestStatus, CapabilityRequestStatus[]> = {
  requested: ["in-progress", "provider-complete", "rejected", "superseded"],
  "in-progress": ["provider-complete", "rejected", "superseded"],
  "provider-complete": ["in-progress", "consumer-verified", "rejected", "superseded"],
  "consumer-verified": [],
  rejected: [],
  superseded: [],
};

function text(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export async function createCapabilityRequest(
  stack: LoadedStack,
  input: {
    requesterComponentId: string;
    providerComponentId: string;
    sessionId: string;
    capability: string;
    reason: string;
    acceptance?: string;
    actor?: EventActor;
  },
): Promise<StackEvent> {
  requireComponent(stack, input.requesterComponentId);
  requireComponent(stack, input.providerComponentId);
  if (input.requesterComponentId === input.providerComponentId) throw new Error("A capability request must cross component boundaries.");
  return withEventAppendLock(stack, async () => {
    const read = await readEvents(stack);
    const work = requireActiveSession(read.events, input.sessionId);
    if (work.componentId !== input.requesterComponentId) throw new Error(`Work session ${input.sessionId} belongs to ${work.componentId ?? "an unknown component"}, not ${input.requesterComponentId}.`);
    const event = completeEvent(stack, {
      type: "capability-request.created",
      componentId: input.requesterComponentId,
      sessionId: input.sessionId,
      requestId: randomUUID(),
      ...(input.actor === undefined ? {} : { actor: input.actor }),
      data: {
        requesterComponentId: input.requesterComponentId,
        providerComponentId: input.providerComponentId,
        capability: text(input.capability, "Capability"),
        reason: text(input.reason, "Request reason"),
        ...(input.acceptance?.trim() ? { acceptance: input.acceptance.trim() } : {}),
        status: "requested",
      },
    });
    await writeEvents(stack, [event]);
    return event;
  });
}

export async function transitionCapabilityRequest(
  stack: LoadedStack,
  input: {
    requestId: string;
    componentId: string;
    status: Exclude<CapabilityRequestStatus, "requested">;
    summary: string;
    evidence?: string;
    actor?: EventActor;
  },
): Promise<StackEvent> {
  requireComponent(stack, input.componentId);
  return withEventAppendLock(stack, async () => {
    const read = await readEvents(stack);
    const created = read.events.find((event) => event.type === "capability-request.created" && event.requestId === input.requestId);
    if (!created) throw new Error(`Unknown capability request ${input.requestId}.`);
    const requester = String(created.data.requesterComponentId ?? "");
    const provider = String(created.data.providerComponentId ?? "");
    const transitions = read.events.filter((event) => event.type === "capability-request.transitioned" && event.requestId === input.requestId);
    const current = (transitions.at(-1)?.data.toStatus ?? created.data.status ?? "requested") as CapabilityRequestStatus;
    if (!requestTransitions[current].includes(input.status)) throw new Error(`Capability request ${input.requestId} cannot transition from ${current} to ${input.status}.`);
    const allowedActors = input.status === "consumer-verified" || input.status === "superseded"
      ? [requester]
      : input.status === "in-progress" && current === "provider-complete"
        ? [requester, provider]
        : input.status === "rejected"
          ? [requester, provider]
          : [provider];
    if (!allowedActors.includes(input.componentId)) throw new Error(`Component ${input.componentId} cannot transition capability request ${input.requestId} to ${input.status}.`);
    const event = completeEvent(stack, {
      type: "capability-request.transitioned",
      componentId: input.componentId,
      ...(created.sessionId === undefined ? {} : { sessionId: created.sessionId }),
      requestId: input.requestId,
      ...(input.actor === undefined ? {} : { actor: input.actor }),
      data: {
        fromStatus: current,
        toStatus: input.status,
        summary: text(input.summary, "Transition summary"),
        ...(input.evidence?.trim() ? { evidence: input.evidence.trim() } : {}),
      },
    });
    await writeEvents(stack, [event]);
    return event;
  });
}

export async function startWork(
  stack: LoadedStack,
  input: {
    componentId: string;
    summary: string;
    workId?: string;
    actor?: EventActor;
  },
) {
  requireComponent(stack, input.componentId);
  const sessionId = randomUUID();
  return appendEvent(stack, {
    type: "work.started",
    componentId: input.componentId,
    sessionId,
    ...(input.workId === undefined ? {} : { workId: input.workId }),
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    data: { summary: input.summary },
  });
}

function sessionStartFrom(events: StackEvent[], sessionId: string): StackEvent {
  const start = events.find((event) => event.type === "work.started" && event.sessionId === sessionId);
  if (!start) throw new Error(`No work.started event found for session ${sessionId}.`);
  return start;
}

function requireActiveSession(events: StackEvent[], sessionId: string): StackEvent {
  const start = sessionStartFrom(events, sessionId);
  if (events.some((event) => event.type === "work.completed" && event.sessionId === sessionId)) {
    throw new Error(`Work session ${sessionId} is already complete.`);
  }
  return start;
}

function openTurn(events: StackEvent[], sessionId: string): StackEvent | undefined {
  return events.find((event) => event.type === "turn.started" && event.sessionId === sessionId && event.turnId
    && !events.some((candidate) => candidate.type === "turn.completed" && candidate.sessionId === sessionId && candidate.turnId === event.turnId));
}

function validateUsage(usage: UsageData): void {
  if (!usage.provider.trim()) throw new Error("Usage provider is required.");
  if (!usage.model.trim()) throw new Error("Usage model is required.");
  for (const [name, value] of Object.entries({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    reasoningTokens: usage.reasoningTokens,
    toolCalls: usage.toolCalls,
    durationMs: usage.durationMs,
    amount: usage.amount,
  })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(`Usage ${name} must be a non-negative finite number.`);
  }
  if (usage.amount !== undefined && usage.costKind === undefined) throw new Error("costKind is required whenever amount is supplied.");
}

export async function startTurn(
  stack: LoadedStack,
  input: {
    sessionId: string;
    context: {
      generatedAt: string;
      items: number;
      warnings: number;
      errors: number;
      briefingDigest?: string;
      briefingMode?: "orientation" | "refresh";
      briefingItems?: number;
      briefingOmissions?: number;
      briefingBytes?: number;
      briefingBudgetBytes?: number;
    };
  },
): Promise<StackEvent> {
  return withEventAppendLock(stack, async () => {
    const read = await readEvents(stack);
    const start = requireActiveSession(read.events, input.sessionId);
    const existing = openTurn(read.events, input.sessionId);
    if (existing?.turnId) throw new Error(`Work session ${input.sessionId} already has open turn ${existing.turnId}.`);
    const turn = completeEvent(stack, {
      type: "turn.started",
      ...(start.componentId === undefined ? {} : { componentId: start.componentId }),
      sessionId: input.sessionId,
      turnId: randomUUID(),
      ...(start.workId === undefined ? {} : { workId: start.workId }),
      ...(start.actor === undefined ? {} : { actor: start.actor }),
      data: {
        contextGeneratedAt: input.context.generatedAt,
        contextItems: input.context.items,
        contextWarnings: input.context.warnings,
        contextErrors: input.context.errors,
        ...(input.context.briefingDigest === undefined ? {} : { briefingDigest: input.context.briefingDigest }),
        ...(input.context.briefingMode === undefined ? {} : { briefingMode: input.context.briefingMode }),
        ...(input.context.briefingItems === undefined ? {} : { briefingItems: input.context.briefingItems }),
        ...(input.context.briefingOmissions === undefined ? {} : { briefingOmissions: input.context.briefingOmissions }),
        ...(input.context.briefingBytes === undefined ? {} : { briefingBytes: input.context.briefingBytes }),
        ...(input.context.briefingBudgetBytes === undefined ? {} : { briefingBudgetBytes: input.context.briefingBudgetBytes }),
      },
    });
    await writeEvents(stack, [turn]);
    return turn;
  });
}

export async function completeTurn(
  stack: LoadedStack,
  input: {
    sessionId: string;
    turnId: string;
    summary: string;
    status?: "progress" | "blocked" | "failed" | "complete";
    changedPaths?: string[];
    nextStep?: string;
    usage?: UsageData;
  },
) {
  if (input.usage) validateUsage(input.usage);
  return withEventAppendLock(stack, async () => {
    const read = await readEvents(stack);
    const start = requireActiveSession(read.events, input.sessionId);
    const turnStart = read.events.find((event) => event.type === "turn.started" && event.sessionId === input.sessionId && event.turnId === input.turnId);
    if (!turnStart) throw new Error(`No turn.started event found for turn ${input.turnId} in session ${input.sessionId}.`);
    if (read.events.some((event) => event.type === "turn.completed" && event.sessionId === input.sessionId && event.turnId === input.turnId)) {
      throw new Error(`Turn ${input.turnId} is already complete.`);
    }
    const turn = completeEvent(stack, {
      type: "turn.completed",
      ...(start.componentId === undefined ? {} : { componentId: start.componentId }),
      sessionId: input.sessionId,
      turnId: input.turnId,
      ...(start.workId === undefined ? {} : { workId: start.workId }),
      ...(start.actor === undefined ? {} : { actor: start.actor }),
      data: {
        summary: input.summary,
        status: input.status ?? "progress",
        changedPaths: input.changedPaths ?? [],
        ...(input.nextStep === undefined ? {} : { nextStep: input.nextStep }),
      },
    });
    const usage = input.usage === undefined ? undefined : completeEvent(stack, {
      type: "usage.recorded",
      ...(start.componentId === undefined ? {} : { componentId: start.componentId }),
      sessionId: input.sessionId,
      turnId: input.turnId,
      ...(start.workId === undefined ? {} : { workId: start.workId }),
      ...(start.actor === undefined ? {} : { actor: start.actor }),
      data: { ...input.usage, recording: "turn" },
    });
    await writeEvents(stack, usage ? [turn, usage] : [turn]);
    return { schemaVersion: "0.1" as const, turn, ...(usage === undefined ? {} : { usage }) };
  });
}

export async function completeWork(
  stack: LoadedStack,
  input: {
    sessionId: string;
    summary: string;
    outcome?: "success" | "partial" | "failed" | "cancelled";
    remaining?: string[];
  },
) {
  return withEventAppendLock(stack, async () => {
    const read = await readEvents(stack);
    const start = requireActiveSession(read.events, input.sessionId);
    const activeTurn = openTurn(read.events, input.sessionId);
    if (activeTurn?.turnId) throw new Error(`Cannot complete work session ${input.sessionId} while turn ${activeTurn.turnId} is open.`);
    const event = completeEvent(stack, {
      type: "work.completed",
      ...(start.componentId === undefined ? {} : { componentId: start.componentId }),
      sessionId: input.sessionId,
      ...(start.workId === undefined ? {} : { workId: start.workId }),
      ...(start.actor === undefined ? {} : { actor: start.actor }),
      data: {
        summary: input.summary,
        outcome: input.outcome ?? "success",
        remaining: input.remaining ?? [],
      },
    });
    await writeEvents(stack, [event]);
    return event;
  });
}

export async function importUsage(
  stack: LoadedStack,
  input: { sessionId?: string; turnId?: string; componentId?: string; workId?: string; actor?: EventActor; usage: UsageData },
) {
  validateUsage(input.usage);
  let componentId = input.componentId;
  let workId = input.workId;
  let actor = input.actor;
  let sessionId = input.sessionId;
  const read = await readEvents(stack);
  if (input.turnId) {
    const turn = read.events.find((event) => event.type === "turn.started" && event.turnId === input.turnId);
    if (!turn) throw new Error(`No turn.started event found for turn ${input.turnId}.`);
    if (sessionId && turn.sessionId !== sessionId) throw new Error(`Turn ${input.turnId} does not belong to session ${sessionId}.`);
    sessionId = turn.sessionId;
  }
  if (sessionId) {
    try {
      const start = sessionStartFrom(read.events, sessionId);
      componentId ??= start.componentId;
      workId ??= start.workId;
      actor ??= start.actor;
    } catch {
      // Imported telemetry may refer to an external session that did not participate live.
    }
  }
  return appendEvent(stack, {
    type: "usage.recorded",
    ...(componentId === undefined ? {} : { componentId }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(input.turnId === undefined ? {} : { turnId: input.turnId }),
    ...(workId === undefined ? {} : { workId }),
    ...(actor === undefined ? {} : { actor }),
    data: { ...input.usage, recording: "imported" },
  });
}
