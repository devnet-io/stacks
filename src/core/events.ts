import { randomUUID } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import type { EventActor, LoadedStack, StackEvent, UsageData } from "./types.ts";
import { stateDirectory } from "./paths.ts";
import { componentById } from "./manifest.ts";

export interface ReadEventsResult {
  events: StackEvent[];
  warnings: string[];
}

export function eventsPath(stack: LoadedStack): string {
  return path.join(stateDirectory(stack), "events.jsonl");
}

export async function appendEvent<TData extends Record<string, unknown>>(
  stack: LoadedStack,
  event: Omit<StackEvent<TData>, "schemaVersion" | "id" | "timestamp" | "stackId"> & {
    id?: string;
    timestamp?: string;
  },
): Promise<StackEvent<TData>> {
  const full: StackEvent<TData> = {
    schemaVersion: "0.1",
    id: event.id ?? randomUUID(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    type: event.type,
    stackId: stack.manifest.metadata.id,
    ...(event.componentId === undefined ? {} : { componentId: event.componentId }),
    ...(event.sessionId === undefined ? {} : { sessionId: event.sessionId }),
    ...(event.workId === undefined ? {} : { workId: event.workId }),
    ...(event.actor === undefined ? {} : { actor: event.actor }),
    data: event.data,
  };
  const file = eventsPath(stack);
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(file, "a");
  try {
    await handle.appendFile(`${JSON.stringify(full)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
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

function requireComponent(stack: LoadedStack, componentId: string): void {
  if (!componentById(stack.manifest, componentId)) throw new Error(`Unknown component: ${componentId}.`);
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

async function sessionStart(stack: LoadedStack, sessionId: string): Promise<StackEvent> {
  const read = await readEvents(stack);
  const start = read.events.find((event) => event.type === "work.started" && event.sessionId === sessionId);
  if (!start) throw new Error(`No work.started event found for session ${sessionId}.`);
  return start;
}

export async function completeTurn(
  stack: LoadedStack,
  input: {
    sessionId: string;
    summary: string;
    status?: "progress" | "blocked" | "failed" | "complete";
    changedPaths?: string[];
    nextStep?: string;
  },
) {
  const start = await sessionStart(stack, input.sessionId);
  return appendEvent(stack, {
    type: "turn.completed",
    ...(start.componentId === undefined ? {} : { componentId: start.componentId }),
    sessionId: input.sessionId,
    ...(start.workId === undefined ? {} : { workId: start.workId }),
    ...(start.actor === undefined ? {} : { actor: start.actor }),
    data: {
      summary: input.summary,
      status: input.status ?? "progress",
      changedPaths: input.changedPaths ?? [],
      ...(input.nextStep === undefined ? {} : { nextStep: input.nextStep }),
    },
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
  const start = await sessionStart(stack, input.sessionId);
  return appendEvent(stack, {
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
}

export async function recordUsage(
  stack: LoadedStack,
  input: { sessionId: string; componentId?: string; workId?: string; actor?: EventActor; usage: UsageData },
) {
  let componentId = input.componentId;
  let workId = input.workId;
  let actor = input.actor;
  try {
    const start = await sessionStart(stack, input.sessionId);
    componentId ??= start.componentId;
    workId ??= start.workId;
    actor ??= start.actor;
  } catch {
    // Usage may be imported from a client that did not emit a start event.
  }
  return appendEvent(stack, {
    type: "usage.recorded",
    ...(componentId === undefined ? {} : { componentId }),
    sessionId: input.sessionId,
    ...(workId === undefined ? {} : { workId }),
    ...(actor === undefined ? {} : { actor }),
    data: input.usage as UsageData & Record<string, unknown>,
  });
}
