import type { CapabilityRequestStatus, LoadedStack, StackEvent } from "../core/types.ts";
import { readEvents } from "../core/events.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

export const CAPABILITY_REQUEST_LIMIT = 50;

export interface CapabilityRequestSummary {
  requestId: string;
  status: CapabilityRequestStatus;
  capability: string;
  requesterComponentId: string;
  providerComponentId: string;
  sessionId: string;
  reason: string;
  acceptance?: string;
  createdAt: string;
  updatedAt: string;
  latestSummary?: string;
  latestEvidence?: string;
}

export interface CapabilityRequestTransition {
  eventId: string;
  timestamp: string;
  componentId: string;
  fromStatus: CapabilityRequestStatus;
  toStatus: CapabilityRequestStatus;
  summary: string;
  evidence?: string;
}

export interface CapabilityRequestList {
  schemaVersion: "0.1";
  stack: StackIdentity;
  requests: CapabilityRequestSummary[];
  limit: number;
  warnings: string[];
}

export interface CapabilityRequestDetail {
  schemaVersion: "0.1";
  stack: StackIdentity;
  request: CapabilityRequestSummary;
  transitions: CapabilityRequestTransition[];
  events: Array<Pick<StackEvent, "id" | "timestamp" | "type" | "componentId" | "sessionId" | "requestId" | "actor" | "data">>;
  warnings: string[];
}

function stringData(event: StackEvent, key: string): string | undefined {
  const value = event.data[key];
  return typeof value === "string" && value.length ? value : undefined;
}

function transitions(events: StackEvent[], requestId: string): CapabilityRequestTransition[] {
  return events.filter((event) => event.type === "capability-request.transitioned" && event.requestId === requestId).flatMap((event) => {
    const fromStatus = stringData(event, "fromStatus") as CapabilityRequestStatus | undefined;
    const toStatus = stringData(event, "toStatus") as CapabilityRequestStatus | undefined;
    const summary = stringData(event, "summary");
    if (!event.componentId || !fromStatus || !toStatus || !summary) return [];
    const evidence = stringData(event, "evidence");
    return [{ eventId: event.id, timestamp: event.timestamp, componentId: event.componentId, fromStatus, toStatus, summary, ...(evidence ? { evidence } : {}) }];
  });
}

function summary(events: StackEvent[], created: StackEvent): CapabilityRequestSummary | undefined {
  if (!created.requestId || !created.sessionId) return undefined;
  const capability = stringData(created, "capability");
  const requesterComponentId = stringData(created, "requesterComponentId");
  const providerComponentId = stringData(created, "providerComponentId");
  const reason = stringData(created, "reason");
  if (!capability || !requesterComponentId || !providerComponentId || !reason) return undefined;
  const history = transitions(events, created.requestId);
  const latest = history.at(-1);
  const acceptance = stringData(created, "acceptance");
  return {
    requestId: created.requestId,
    status: latest?.toStatus ?? "requested",
    capability,
    requesterComponentId,
    providerComponentId,
    sessionId: created.sessionId,
    reason,
    ...(acceptance ? { acceptance } : {}),
    createdAt: created.timestamp,
    updatedAt: latest?.timestamp ?? created.timestamp,
    ...(latest?.summary ? { latestSummary: latest.summary } : {}),
    ...(latest?.evidence ? { latestEvidence: latest.evidence } : {}),
  };
}

export async function buildCapabilityRequestList(stack: LoadedStack): Promise<CapabilityRequestList> {
  const read = await readEvents(stack);
  const requests = read.events
    .filter((event) => event.type === "capability-request.created")
    .flatMap((event) => {
      const value = summary(read.events, event);
      return value ? [value] : [];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, CAPABILITY_REQUEST_LIMIT);
  return { schemaVersion: "0.1", stack: stackIdentity(stack.manifest), requests, limit: CAPABILITY_REQUEST_LIMIT, warnings: read.warnings };
}

export async function buildCapabilityRequestDetail(stack: LoadedStack, requestId: string): Promise<CapabilityRequestDetail> {
  const read = await readEvents(stack);
  const created = read.events.find((event) => event.type === "capability-request.created" && event.requestId === requestId);
  const request = created ? summary(read.events, created) : undefined;
  if (!request) throw new Error(`Unknown capability request ${requestId}.`);
  const linked = read.events.filter((event) => event.requestId === requestId);
  return {
    schemaVersion: "0.1",
    stack: stackIdentity(stack.manifest),
    request,
    transitions: transitions(read.events, requestId).reverse(),
    events: linked.map(({ id, timestamp, type, componentId, sessionId, requestId: linkedRequestId, actor, data }) => ({
      id, timestamp, type,
      ...(componentId ? { componentId } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(linkedRequestId ? { requestId: linkedRequestId } : {}),
      ...(actor ? { actor } : {}),
      data,
    })).reverse(),
    warnings: read.warnings,
  };
}

export function relevantCapabilityRequests(requests: CapabilityRequestSummary[], componentId: string): CapabilityRequestSummary[] {
  return requests.filter((request) => request.status !== "consumer-verified" && request.status !== "rejected" && request.status !== "superseded"
    && (request.requesterComponentId === componentId || request.providerComponentId === componentId)).slice(0, 20);
}
