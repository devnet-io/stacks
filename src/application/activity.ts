import type { CostKind, EventActor, LoadedStack, StackEvent } from "../core/types.ts";
import { readEvents } from "../core/events.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

const WORK_LIMIT = 50;
const CHANGE_LIMIT = 30;
const DETAIL_EVENT_LIMIT = 100;

export interface ActivityCost { amount: number; currency: string; costKind: CostKind }
export interface ActivityUsage { events: number; inputTokens: number; outputTokens: number; costs: ActivityCost[] }
export interface ActivityBriefingSummary { digest?: string; mode?: "orientation" | "refresh"; items?: number; omissions?: number; bytes?: number; budgetBytes?: number }
export interface ActivityTurnSummary {
  turnId: string; startedAt?: string; completedAt?: string;
  status: "active" | "progress" | "blocked" | "failed" | "complete";
  summary?: string; nextStep?: string; changedPaths: string[];
  briefing?: ActivityBriefingSummary; usage: ActivityUsage;
}
export interface ActivityWorkSummary {
  sessionId: string; componentId?: string; workId?: string; actor?: EventActor;
  startedAt?: string; completedAt?: string;
  status: "active" | "success" | "partial" | "failed" | "cancelled";
  title?: string; resultSummary?: string; turnCount: number; openTurnId?: string; usage: ActivityUsage;
}
export interface ActivityEvent {
  id: string; timestamp: string; type: string; componentId?: string; sessionId?: string; turnId?: string; actor?: EventActor;
  summary?: string; status?: string; outcome?: string; provider?: string; model?: string;
  inputTokens?: number; outputTokens?: number; amount?: number; currency?: string; costKind?: CostKind;
}
export interface StackActivity {
  schemaVersion: "0.1"; generatedAt: string; stack: StackIdentity;
  summary: { events: number; activeWork: number; completedWork: number; turns: number; usage: ActivityUsage };
  work: ActivityWorkSummary[]; workLimit: number;
  recentChanges: ActivityEvent[]; recentChangeLimit: number; warnings: string[];
}
export interface ActivityWorkDetail {
  schemaVersion: "0.1"; generatedAt: string; stack: StackIdentity; work: ActivityWorkSummary;
  turns: ActivityTurnSummary[]; events: ActivityEvent[]; eventLimit: number; warnings: string[];
}
export interface ActivityTurnDetail {
  schemaVersion: "0.1"; generatedAt: string; stack: StackIdentity; work: ActivityWorkSummary;
  turn: ActivityTurnSummary; events: ActivityEvent[]; warnings: string[];
}

function stringValue(data: Record<string, unknown>, key: string): string | undefined {
  return typeof data[key] === "string" ? data[key] : undefined;
}
function numberValue(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function stringArray(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function usageFor(events: StackEvent[]): ActivityUsage {
  const costs = new Map<string, ActivityCost>();
  let usageEvents = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const event of events) {
    if (event.type !== "usage.recorded") continue;
    usageEvents += 1;
    inputTokens += numberValue(event.data, "inputTokens") ?? 0;
    outputTokens += numberValue(event.data, "outputTokens") ?? 0;
    const amount = numberValue(event.data, "amount");
    const currency = stringValue(event.data, "currency");
    const kind = stringValue(event.data, "costKind");
    if (amount === undefined || !currency || (kind !== "reported" && kind !== "estimated" && kind !== "allocated")) continue;
    const key = `${currency}\u0000${kind}`;
    const current = costs.get(key);
    costs.set(key, { amount: (current?.amount ?? 0) + amount, currency, costKind: kind });
  }
  return { events: usageEvents, inputTokens, outputTokens, costs: [...costs.values()].sort((a, b) => `${a.currency}/${a.costKind}`.localeCompare(`${b.currency}/${b.costKind}`)) };
}
function activityEvent(event: StackEvent): ActivityEvent {
  const data = event.data;
  return {
    id: event.id, timestamp: event.timestamp, type: event.type,
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
    ...(["reported", "estimated", "allocated"].includes(stringValue(data, "costKind") ?? "") ? { costKind: stringValue(data, "costKind") as CostKind } : {}),
  };
}
function turnSummary(turnId: string, events: StackEvent[]): ActivityTurnSummary {
  const started = events.find((event) => event.type === "turn.started" && event.turnId === turnId);
  const completed = events.find((event) => event.type === "turn.completed" && event.turnId === turnId);
  const status = stringValue(completed?.data ?? {}, "status");
  const mode = stringValue(started?.data ?? {}, "briefingMode");
  const briefing: ActivityBriefingSummary | undefined = started && (stringValue(started.data, "briefingDigest") !== undefined || mode === "orientation" || mode === "refresh") ? {
    ...(stringValue(started.data, "briefingDigest") === undefined ? {} : { digest: stringValue(started.data, "briefingDigest")! }),
    ...(mode === "orientation" || mode === "refresh" ? { mode } : {}),
    ...(numberValue(started.data, "briefingItems") === undefined ? {} : { items: numberValue(started.data, "briefingItems")! }),
    ...(numberValue(started.data, "briefingOmissions") === undefined ? {} : { omissions: numberValue(started.data, "briefingOmissions")! }),
    ...(numberValue(started.data, "briefingBytes") === undefined ? {} : { bytes: numberValue(started.data, "briefingBytes")! }),
    ...(numberValue(started.data, "briefingBudgetBytes") === undefined ? {} : { budgetBytes: numberValue(started.data, "briefingBudgetBytes")! }),
  } : undefined;
  return {
    turnId,
    ...(started === undefined ? {} : { startedAt: started.timestamp }),
    ...(completed === undefined ? {} : { completedAt: completed.timestamp }),
    status: completed === undefined ? "active" : status === "blocked" || status === "failed" || status === "complete" ? status : "progress",
    ...(stringValue(completed?.data ?? {}, "summary") === undefined ? {} : { summary: stringValue(completed!.data, "summary")! }),
    ...(stringValue(completed?.data ?? {}, "nextStep") === undefined ? {} : { nextStep: stringValue(completed!.data, "nextStep")! }),
    changedPaths: stringArray(completed?.data ?? {}, "changedPaths"),
    ...(briefing === undefined ? {} : { briefing }),
    usage: usageFor(events.filter((event) => event.turnId === turnId)),
  };
}
function workSummary(sessionId: string, events: StackEvent[]): ActivityWorkSummary {
  const sessionEvents = events.filter((event) => event.sessionId === sessionId);
  const started = sessionEvents.find((event) => event.type === "work.started");
  const completed = sessionEvents.find((event) => event.type === "work.completed");
  const startedTurns = sessionEvents.filter((event) => event.type === "turn.started" && event.turnId);
  const completedTurnIds = new Set(sessionEvents.filter((event) => event.type === "turn.completed").map((event) => event.turnId));
  const open = startedTurns.find((event) => !completedTurnIds.has(event.turnId));
  const outcome = stringValue(completed?.data ?? {}, "outcome");
  return {
    sessionId,
    ...(started?.componentId === undefined ? {} : { componentId: started.componentId }),
    ...(started?.workId === undefined ? {} : { workId: started.workId }),
    ...(started?.actor === undefined ? {} : { actor: started.actor }),
    ...(started === undefined ? {} : { startedAt: started.timestamp }),
    ...(completed === undefined ? {} : { completedAt: completed.timestamp }),
    status: completed === undefined ? "active" : outcome === "partial" || outcome === "failed" || outcome === "cancelled" ? outcome : "success",
    ...(stringValue(started?.data ?? {}, "summary") === undefined ? {} : { title: stringValue(started!.data, "summary")! }),
    ...(stringValue(completed?.data ?? {}, "summary") === undefined ? {} : { resultSummary: stringValue(completed!.data, "summary")! }),
    turnCount: startedTurns.length,
    ...(open?.turnId === undefined ? {} : { openTurnId: open.turnId }),
    usage: usageFor(sessionEvents),
  };
}
async function projection(stack: LoadedStack) {
  const read = await readEvents(stack);
  const sessionIds = [...new Set(read.events.flatMap((event) => event.type === "work.started" && event.sessionId ? [event.sessionId] : []))];
  const work = sessionIds.map((sessionId) => workSummary(sessionId, read.events)).sort((left, right) => {
    if (left.status === "active" && right.status !== "active") return -1;
    if (left.status !== "active" && right.status === "active") return 1;
    return (right.completedAt ?? right.startedAt ?? "").localeCompare(left.completedAt ?? left.startedAt ?? "");
  });
  return { read, work };
}

export async function buildStackActivity(stack: LoadedStack): Promise<StackActivity> {
  const { read, work } = await projection(stack);
  return {
    schemaVersion: "0.1", generatedAt: new Date().toISOString(), stack: stackIdentity(stack.manifest),
    summary: {
      events: read.events.length,
      activeWork: work.filter((item) => item.status === "active").length,
      completedWork: work.filter((item) => item.status !== "active").length,
      turns: read.events.filter((event) => event.type === "turn.started").length,
      usage: usageFor(read.events),
    },
    work: work.slice(0, WORK_LIMIT), workLimit: WORK_LIMIT,
    recentChanges: read.events.filter((event) => !event.sessionId).slice(-CHANGE_LIMIT).reverse().map(activityEvent),
    recentChangeLimit: CHANGE_LIMIT, warnings: read.warnings,
  };
}
export async function buildActivityWorkDetail(stack: LoadedStack, sessionId: string): Promise<ActivityWorkDetail> {
  const { read, work } = await projection(stack);
  const selected = work.find((item) => item.sessionId === sessionId);
  if (!selected) throw new Error(`Unknown work session: ${sessionId}.`);
  const sessionEvents = read.events.filter((event) => event.sessionId === sessionId);
  const turnIds = sessionEvents.filter((event) => event.type === "turn.started" && event.turnId).map((event) => event.turnId!);
  return {
    schemaVersion: "0.1", generatedAt: new Date().toISOString(), stack: stackIdentity(stack.manifest), work: selected,
    turns: turnIds.map((turnId) => turnSummary(turnId, sessionEvents)).reverse(),
    events: sessionEvents.slice(-DETAIL_EVENT_LIMIT).reverse().map(activityEvent), eventLimit: DETAIL_EVENT_LIMIT, warnings: read.warnings,
  };
}
export async function buildActivityTurnDetail(stack: LoadedStack, sessionId: string, turnId: string): Promise<ActivityTurnDetail> {
  const detail = await buildActivityWorkDetail(stack, sessionId);
  const turn = detail.turns.find((item) => item.turnId === turnId);
  if (!turn) throw new Error(`Unknown turn ${turnId} in work session ${sessionId}.`);
  return {
    schemaVersion: "0.1", generatedAt: new Date().toISOString(), stack: detail.stack, work: detail.work, turn,
    events: detail.events.filter((event) => event.turnId === turnId), warnings: detail.warnings,
  };
}
