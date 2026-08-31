import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { createLocalStacksApplication, type StacksApplication } from "../application/stacks-application.ts";
import type { CostKind, UsageData } from "../core/types.ts";
import { STACKS_VERSION } from "../version.ts";
import { readMcpReference, STACKS_MCP_INSTRUCTIONS, STACKS_MCP_RESOURCES } from "./instructions.ts";

function result(value: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

const selector = z.string().min(1).describe("Registered Stack selector in namespace/name form");
const strength = z.enum(["required", "preferred", "reference"]);
const requestTransitionStatus = z.enum(["in-progress", "provider-complete", "consumer-verified", "rejected", "superseded"]);
const usageShape = {
  provider: z.string().min(1), model: z.string().min(1), inputTokens: z.number().nonnegative().optional(), outputTokens: z.number().nonnegative().optional(),
  cachedInputTokens: z.number().nonnegative().optional(), reasoningTokens: z.number().nonnegative().optional(), toolCalls: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(), amount: z.number().nonnegative().optional(), currency: z.string().optional(),
  costKind: z.enum(["reported", "estimated", "allocated"]).optional(), pricingReference: z.string().optional(), note: z.string().optional(),
} as const;
const requireCostProvenance = (value: { amount?: number | undefined; costKind?: CostKind | undefined }) => value.amount === undefined || value.costKind !== undefined;
const usageSchema = z.object(usageShape).refine(requireCostProvenance, { message: "costKind is required whenever amount is supplied" });
const usageImportSchema = z.object({ ...usageShape, stack: selector, sessionId: z.string().min(1).optional(), turnId: z.string().min(1).optional(), componentId: z.string().optional() })
  .refine(requireCostProvenance, { message: "costKind is required whenever amount is supplied" });

export function buildMcpServer(application: StacksApplication = createLocalStacksApplication()): McpServer {
  const server = new McpServer({ name: "stacks", version: STACKS_VERSION }, { instructions: STACKS_MCP_INSTRUCTIONS });

  server.registerResource("stacks-instructions", "stacks://instructions", {
    title: "Stacks agent instructions", description: "Concise operating instructions and canonical reference links.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: STACKS_MCP_INSTRUCTIONS }] }));

  server.registerResource("stacks-mcp-reference", "stacks://reference/mcp", {
    title: "Stacks MCP reference", description: "Complete reference for every Stacks MCP tool and resource.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readMcpReference("mcp") }] }));

  server.registerResource("stacks-cli-reference", "stacks://reference/cli", {
    title: "Stacks CLI reference", description: "Complete reference for every Stacks CLI command, including CLI-only operations.", mimeType: "text/markdown",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readMcpReference("cli") }] }));

  server.registerResource("stacks-catalog", "stacks://catalog", {
    title: "Registered Stacks", description: "Machine-level catalog of registered Stacks.", mimeType: "application/json",
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ schemaVersion: "0.1", stacks: await application.listStacks() }, null, 2) }] }));

  server.registerTool("instructions_get", {
    title: "Get Stacks instructions", description: "Read the Stacks operating protocol and canonical CLI/MCP reference links before using Stack lifecycle tools.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async () => result({ schemaVersion: "0.1", instructions: STACKS_MCP_INSTRUCTIONS, resources: [...STACKS_MCP_RESOURCES] }));

  server.registerTool("stack_list", {
    title: "List Stacks", description: "List registered Stacks available on this machine.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async () => result({ schemaVersion: "0.1", stacks: await application.listStacks() }));

  server.registerTool("stack_memberships", {
    title: "Find Stack memberships", description: "Find direct component memberships, or descendant components when the path is their shared ancestor. Direct matches take precedence and ambiguity is returned rather than guessed.",
    inputSchema: z.object({ path: z.string().min(1).optional().describe("Directory to locate; defaults to the MCP process working directory") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ path }) => result(await application.findMemberships(path ?? process.cwd()) as unknown as Record<string, unknown>));

  server.registerTool("stack_get", {
    title: "Get Stack", description: "Return one declared Stack definition, its effective provider-descriptor composition, descriptor provenance, and component bindings.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.getStack({ stack: stackSelector }) as unknown as Record<string, unknown>));

  server.registerTool("component_list", {
    title: "List components", description: "List effective component definitions, provider-descriptor provenance, and explicit machine bindings for one Stack.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.listComponents(stackSelector) as unknown as Record<string, unknown>));

  server.registerTool("component_get", {
    title: "Get component", description: "Return one effective component definition, provider-descriptor status and precedence, and its explicit machine binding.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId }) => result(await application.getComponent(stackSelector, componentId) as unknown as Record<string, unknown>));

  server.registerTool("component_add", {
    title: "Add local component", description: "Add an existing local directory as a Stack component. This does not clone, move, or modify the component repository.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), path: z.string().min(1), name: z.string().min(1).optional(), kind: z.string().min(1).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, componentId, path, name, kind }) => result(await application.addComponent({ stack: stackSelector, id: componentId, path, ...(name ? { name } : {}), ...(kind ? { kind } : {}), actor: { client: "stacks-mcp" } }) as unknown as Record<string, unknown>));

  server.registerTool("component_bind", {
    title: "Bind component directory", description: "Set the explicit local directory for an existing component. This does not move or modify the repository.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), path: z.string().min(1) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, path }) => result(await application.bindComponent(stackSelector, componentId, path, { materialize: false, actor: { client: "stacks-mcp" } }) as unknown as Record<string, unknown>));

  server.registerTool("capability_provide", {
    title: "Configure capability provider", description: "Upsert one capability exported by a component, optionally with one bounded context path.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), capability: z.string().min(1), description: z.string().min(1).optional(), contextPath: z.string().min(1).optional(), strength: strength.optional(), priority: z.number().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, capability, description, contextPath, strength: contextStrength, priority }) => result(await application.configureCapabilityExport(stackSelector, componentId, {
    capability,
    ...(description ? { description } : {}),
    ...(contextPath ? { context: [{ path: contextPath, ...(contextStrength ? { strength: contextStrength } : {}), ...(priority === undefined ? {} : { priority }) }] } : {}),
  }, { actor: { client: "stacks-mcp" } }) as unknown as Record<string, unknown>));

  server.registerTool("capability_consume", {
    title: "Configure capability requirement", description: "Upsert one capability consumed by a component and optionally select its authoritative provider.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), capability: z.string().min(1), from: z.string().min(1).optional(), optional: z.boolean().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, capability, from, optional }) => result(await application.configureCapabilityRequirement(stackSelector, componentId, {
    capability,
    ...(from ? { from } : {}),
    ...(optional === undefined ? {} : { optional }),
  }, { actor: { client: "stacks-mcp" } }) as unknown as Record<string, unknown>));

  server.registerTool("guidance_configure", {
    title: "Configure component guidance", description: "Upsert one component-relative guidance path with strength, priority, and optional capability scope.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), path: z.string().min(1), description: z.string().min(1).optional(), strength: strength.optional(), priority: z.number().optional(), appliesTo: z.array(z.string().min(1)).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, path, description, strength: guidanceStrength, priority, appliesTo }) => result(await application.configureGuidance(stackSelector, componentId, {
    path,
    ...(description ? { description } : {}),
    ...(guidanceStrength ? { strength: guidanceStrength } : {}),
    ...(priority === undefined ? {} : { priority }),
    ...(appliesTo ? { appliesTo } : {}),
  }, { actor: { client: "stacks-mcp" } }) as unknown as Record<string, unknown>));

  server.registerTool("stack_status", {
    title: "Inspect Stack status", description: "Inspect explicit component paths and Git state without modifying them.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.getStatus({ stack: stackSelector }) as unknown as Record<string, unknown>));

  server.registerTool("context_resolve", {
    title: "Resolve component context", description: "Build an explainable plan and safely materialize a task-sensitive briefing under a hard byte budget.",
    inputSchema: z.object({ stack: selector, target: z.string().min(1), task: z.string().optional(), mode: z.enum(["orientation", "refresh"]).optional(), maxBytes: z.number().int().positive().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, target, task, mode, maxBytes }) => result(await application.resolveContext({ stack: stackSelector }, target, task, {
    ...(mode === undefined ? {} : { mode }),
    ...(maxBytes === undefined ? {} : { maxBytes }),
  }) as unknown as Record<string, unknown>));

  server.registerTool("capability_request_list", {
    title: "List capability requests", description: "List bounded cross-component capability requests and their current append-only lifecycle state.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1).optional(), status: z.enum(["requested", "in-progress", "provider-complete", "consumer-verified", "rejected", "superseded"]).optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, status }) => {
    const output = await application.listCapabilityRequests({ stack: stackSelector });
    return result({ ...output, requests: output.requests.filter((request) => (!componentId || request.requesterComponentId === componentId || request.providerComponentId === componentId) && (!status || request.status === status)) } as unknown as Record<string, unknown>);
  });

  server.registerTool("capability_request_get", {
    title: "Get capability request", description: "Inspect one request, its originating work session, current state, evidence, and append-only transition history.",
    inputSchema: z.object({ stack: selector, requestId: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, requestId }) => result(await application.getCapabilityRequest({ stack: stackSelector }, requestId) as unknown as Record<string, unknown>));

  server.registerTool("capability_request_create", {
    title: "Create capability request", description: "Record a missing capability from active consumer work for an expected provider. This does not assign or schedule provider work.",
    inputSchema: z.object({ stack: selector, requesterComponentId: z.string().min(1), providerComponentId: z.string().min(1), sessionId: z.string().min(1), capability: z.string().min(1), reason: z.string().min(1), acceptance: z.string().min(1).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, requesterComponentId, providerComponentId, sessionId, capability, reason, acceptance }) => result(await application.createCapabilityRequest({ stack: stackSelector }, {
    requesterComponentId, providerComponentId, sessionId, capability, reason,
    ...(acceptance ? { acceptance } : {}), actor: { client: "stacks-mcp" },
  }) as unknown as Record<string, unknown>));

  server.registerTool("capability_request_transition", {
    title: "Transition capability request", description: "Append a role-checked request transition. Providers start or report completion; consumers verify or supersede. Stacks does not assign work.",
    inputSchema: z.object({ stack: selector, requestId: z.string().min(1), componentId: z.string().min(1), status: requestTransitionStatus, summary: z.string().min(1), evidence: z.string().min(1).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, requestId, componentId, status, summary, evidence }) => result(await application.transitionCapabilityRequest({ stack: stackSelector }, {
    requestId, componentId, status, summary, ...(evidence ? { evidence } : {}), actor: { client: "stacks-mcp" },
  }) as unknown as Record<string, unknown>));

  server.registerTool("work_list", {
    title: "List logical work", description: "List recent logical work items and their turn counts, status, component, actor, and usage. A work item is not an agent chat.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1).optional(), status: z.enum(["active", "completed"]).optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, componentId, status }) => {
    const activity = await application.getActivity({ stack: stackSelector });
    const work = activity.work.filter((item) => (!componentId || item.componentId === componentId) && (!status || (status === "active" ? item.status === "active" : item.status !== "active")));
    return result({ schemaVersion: "0.1", stack: activity.stack, work, limit: activity.workLimit });
  });

  server.registerTool("work_get", {
    title: "Get logical work", description: "Inspect one logical work item, including its ordered turns and sanitized lifecycle events.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, sessionId }) => result(await application.getActivityWork({ stack: stackSelector }, sessionId) as unknown as Record<string, unknown>));

  server.registerTool("turn_get", {
    title: "Get work turn", description: "Inspect one turn within a logical work item, including outcome, changed paths, usage, and briefing identity.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), turnId: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, sessionId, turnId }) => result(await application.getActivityTurn({ stack: stackSelector }, sessionId, turnId) as unknown as Record<string, unknown>));

  server.registerTool("work_start", {
    title: "Start logical Stack work", description: "Start one logical unit of work for a component. It may span multiple agent turns and is not the same thing as an agent chat.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), summary: z.string().min(1), workId: z.string().optional(), agent: z.string().optional(), client: z.string().optional(), model: z.string().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, componentId, summary, workId, agent, client, model }) => {
    const actor = agent || client || model ? { ...(agent ? { agent } : {}), ...(client ? { client } : {}), ...(model ? { model } : {}) } : undefined;
    return result(await application.startWork({ stack: stackSelector }, { componentId, summary, ...(workId ? { workId } : {}), ...(actor ? { actor } : {}) }) as unknown as Record<string, unknown>);
  });

  server.registerTool("turn_start", {
    title: "Start agent turn", description: "Open one turn and return a materialized orientation or compact refresh briefing with a durable digest.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), task: z.string().min(1), maxBytes: z.number().int().positive().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, task, maxBytes }) => result(await application.startTurn({ stack: stackSelector }, { sessionId, task, ...(maxBytes === undefined ? {} : { maxBytes }) }) as unknown as Record<string, unknown>));

  server.registerTool("turn_complete", {
    title: "Complete agent turn", description: "Close one started turn and append its progress plus optional observed telemetry.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), turnId: z.string().min(1), summary: z.string().min(1), status: z.enum(["progress", "blocked", "failed", "complete"]).optional(), changedPaths: z.array(z.string()).optional(), nextStep: z.string().optional(), usage: usageSchema.optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, turnId, summary, status, changedPaths, nextStep, usage }) => result(await application.completeTurn({ stack: stackSelector }, { sessionId, turnId, summary, ...(status ? { status } : {}), ...(changedPaths ? { changedPaths } : {}), ...(nextStep ? { nextStep } : {}), ...(usage ? { usage: usage as UsageData } : {}) }) as unknown as Record<string, unknown>));

  server.registerTool("work_complete", {
    title: "Complete Stack work session", description: "Append the outcome for a Stack work session.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), summary: z.string().min(1), outcome: z.enum(["success", "partial", "failed", "cancelled"]).optional(), remaining: z.array(z.string()).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, summary, outcome, remaining }) => result(await application.completeWork({ stack: stackSelector }, { sessionId, summary, ...(outcome ? { outcome } : {}), ...(remaining ? { remaining } : {}) }) as unknown as Record<string, unknown>));

  server.registerTool("usage_import", {
    title: "Import delayed usage", description: "Append delayed provider or external telemetry with explicit cost provenance.",
    inputSchema: usageImportSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, turnId, componentId, provider, model, inputTokens, outputTokens, cachedInputTokens, reasoningTokens, toolCalls, durationMs, amount, currency, costKind, pricingReference, note }) => {
    const usage: UsageData = { provider, model, ...(inputTokens === undefined ? {} : { inputTokens }), ...(outputTokens === undefined ? {} : { outputTokens }), ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }), ...(reasoningTokens === undefined ? {} : { reasoningTokens }), ...(toolCalls === undefined ? {} : { toolCalls }), ...(durationMs === undefined ? {} : { durationMs }), ...(amount === undefined ? {} : { amount }), ...(currency === undefined ? {} : { currency }), ...(costKind === undefined ? {} : { costKind: costKind as CostKind }), ...(pricingReference === undefined ? {} : { pricingReference }), ...(note === undefined ? {} : { note }) };
    return result(await application.importUsage({ stack: stackSelector }, { ...(sessionId ? { sessionId } : {}), ...(turnId ? { turnId } : {}), ...(componentId ? { componentId } : {}), usage }) as unknown as Record<string, unknown>);
  });

  server.registerTool("usage_report", {
    title: "Get usage report", description: "Aggregate usage for one registered Stack.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.getUsageReport({ stack: stackSelector }) as unknown as Record<string, unknown>));

  return server;
}

export function startMcpServer(): void {
  const handle = serveStdio(() => buildMcpServer());
  console.error("Stacks MCP server is listening for the machine catalog");
  process.on("SIGINT", () => { void handle.close(); });
  process.on("SIGTERM", () => { void handle.close(); });
}
