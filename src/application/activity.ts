import type { CostKind, EventActor, LoadedStack, StackEvent } from "../core/types.ts";
import { readEvents } from "../core/events.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

const RECENT_EVENT_LIMIT = 100;
const SESSION_LIMIT = 100;

export interface ActivityCost {
  amount: number;
  currency: string;
  costKind: CostKind;
}

export interface ActivitySession {
  sessionId: string;
  componentId?: string;
  workId?: string;
  actor?: EventActor;
  startedAt?: string;
  completedAt?: string;
  status: "active" | "success" | "partial" | "failed" | "cancelled";
  summary?: string;
  turns: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: string;
  componentId?: string;
  sessionId?: string;
  turnId?: string;
  actor?: EventActor;
  summary?: string;
  status?: string;
  outcome?: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  amount?: number;
  currency?: string;
  costKind?: CostKind;
}

export interface StackActivity {
  schemaVersion: "0.1";
  generatedAt: string;
  stack: StackIdentity;
  summary: {
    events: number;
    activeSessions: number;
    completedSessions: number;
    usageEvents: number;
    inputTokens: number;
    outputTokens: number;
    costs: ActivityCost[];
  };
  sessions: ActivitySession[];
  sessionLimit: number;
  recentEvents: ActivityEvent[];
  recentEventLimit: number;
  warnings: string[];
}

function stringValue(data: Record<string, unknown>, key: string): string | undefined {
  return typeof data[key] === "string" ? data[key] : undefined;
}

function numberValue(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function activityEvent(event: StackEvent): ActivityEvent {
  const data = event.data;
  return {
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    ...(event.componentId === undefined ? {} : { componentId: event.componentId }),
    ...(event.sessionId === undefined ? {} : { sessionId: event.sessionId }),
    ...(event.turnId === undefined ? {} : { turnId: event.turnId }),
    ...(event.actor === undefined ? {} : { actor: event.actor }),
    ...(stringValue(data, "summary") === undefined ? {} : { summary: stringValue(data, "summary")! }),
    ...(stringValue(data, "status") === undefined ? {} : { status: stringValue(data, "status")! }),
    ...(stringValue(data, "outcome") === undefined ? {} : { outcome: stringValue(data, "outcome")! }),
    ...(stringValue(data, "provider") === undefined ? {} : { provider: stringValue(data, "provider")! }),
    ...(stringValue(data, "model") === undefined ? {} : { model: stringValue(data, "model")! }),
    ...(numberValue(data, "inputTokens") === undefined ? {} : { inputTokens: numberValue(data, "inputTokens")! }),
    ...(numberValue(data, "outputTokens") === undefined ? {} : { outputTokens: numberValue(data, "outputTokens")! }),
    ...(numberValue(data, "amount") === undefined ? {} : { amount: numberValue(data, "amount")! }),
    ...(stringValue(data, "currency") === undefined ? {} : { currency: stringValue(data, "currency")! }),
    ...(["reported", "estimated", "allocated"].includes(stringValue(data, "costKind") ?? "")
      ? { costKind: stringValue(data, "costKind") as CostKind }
      : {}),
  };
}

export async function buildStackActivity(stack: LoadedStack): Promise<StackActivity> {
  const read = await readEvents(stack);
  const sessions = new Map<string, ActivitySession>();
  const costs = new Map<string, ActivityCost>();
  let usageEvents = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const event of read.events) {
    if (event.sessionId) {
      const current = sessions.get(event.sessionId) ?? { sessionId: event.sessionId, status: "active" as const, turns: 0 };
      if (current.componentId === undefined && event.componentId !== undefined) current.componentId = event.componentId;
      if (current.workId === undefined && event.workId !== undefined) current.workId = event.workId;
      if (current.actor === undefined && event.actor !== undefined) current.actor = event.actor;
      if (event.type === "work.started") {
        current.startedAt = event.timestamp;
        const summary = stringValue(event.data, "summary");
        if (summary !== undefined) current.summary = summary;
      } else if (event.type === "turn.completed") {
        current.turns += 1;
        const summary = stringValue(event.data, "summary");
        if (summary !== undefined) current.summary = summary;
      } else if (event.type === "work.completed") {
        current.completedAt = event.timestamp;
        const outcome = stringValue(event.data, "outcome");
        current.status = outcome === "partial" || outcome === "failed" || outcome === "cancelled" ? outcome : "success";
        const summary = stringValue(event.data, "summary");
        if (summary !== undefined) current.summary = summary;
      }
      sessions.set(event.sessionId, current);
    }
    if (event.type !== "usage.recorded") continue;
    usageEvents += 1;
    inputTokens += numberValue(event.data, "inputTokens") ?? 0;
    outputTokens += numberValue(event.data, "outputTokens") ?? 0;
    const amount = numberValue(event.data, "amount");
    const currency = stringValue(event.data, "currency");
    const kind = stringValue(event.data, "costKind");
    if (amount !== undefined && currency && (kind === "reported" || kind === "estimated" || kind === "allocated")) {
      const key = `${currency}\u0000${kind}`;
      const current = costs.get(key);
      costs.set(key, { amount: (current?.amount ?? 0) + amount, currency, costKind: kind });
    }
  }

  const orderedSessions = [...sessions.values()].sort((left, right) => {
    if (left.status === "active" && right.status !== "active") return -1;
    if (left.status !== "active" && right.status === "active") return 1;
    return (right.completedAt ?? right.startedAt ?? "").localeCompare(left.completedAt ?? left.startedAt ?? "");
  });
  return {
    schemaVersion: "0.1",
    generatedAt: new Date().toISOString(),
    stack: stackIdentity(stack.manifest),
    summary: {
      events: read.events.length,
      activeSessions: orderedSessions.filter((session) => session.status === "active").length,
      completedSessions: orderedSessions.filter((session) => session.status !== "active").length,
      usageEvents,
      inputTokens,
      outputTokens,
      costs: [...costs.values()].sort((left, right) => `${left.currency}/${left.costKind}`.localeCompare(`${right.currency}/${right.costKind}`)),
    },
    sessions: orderedSessions.slice(0, SESSION_LIMIT),
    sessionLimit: SESSION_LIMIT,
    recentEvents: read.events.slice(-RECENT_EVENT_LIMIT).reverse().map(activityEvent),
    recentEventLimit: RECENT_EVENT_LIMIT,
    warnings: read.warnings,
  };
}
