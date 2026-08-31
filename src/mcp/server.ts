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
    title: "Find Stack memberships", description: "Find every registered Stack component whose explicit binding contains a directory. Returns multiple matches instead of guessing.",
    inputSchema: z.object({ path: z.string().min(1).optional().describe("Directory to locate; defaults to the MCP process working directory") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ path }) => result(await application.findMemberships(path ?? process.cwd()) as unknown as Record<string, unknown>));

  server.registerTool("stack_get", {
    title: "Get Stack", description: "Return one registered Stack definition and component bindings.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.getStack({ stack: stackSelector }) as unknown as Record<string, unknown>));

  server.registerTool("component_list", {
    title: "List components", description: "List component definitions and explicit machine bindings for one Stack.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.listComponents(stackSelector) as unknown as Record<string, unknown>));

  server.registerTool("component_get", {
    title: "Get component", description: "Return one component definition and its explicit machine binding.",
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

  server.registerTool("stack_status", {
    title: "Inspect Stack status", description: "Inspect explicit component paths and Git state without modifying them.", inputSchema: z.object({ stack: selector }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector }) => result(await application.getStatus({ stack: stackSelector }) as unknown as Record<string, unknown>));

  server.registerTool("context_resolve", {
    title: "Resolve component context", description: "Build a bounded, explainable context plan for one target component.",
    inputSchema: z.object({ stack: selector, target: z.string().min(1), task: z.string().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ stack: stackSelector, target, task }) => result(await application.resolveContext({ stack: stackSelector }, target, task) as unknown as Record<string, unknown>));

  server.registerTool("work_start", {
    title: "Start Stack work session", description: "Append a work-start event for a component.",
    inputSchema: z.object({ stack: selector, componentId: z.string().min(1), summary: z.string().min(1), workId: z.string().optional(), agent: z.string().optional(), client: z.string().optional(), model: z.string().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, componentId, summary, workId, agent, client, model }) => {
    const actor = agent || client || model ? { ...(agent ? { agent } : {}), ...(client ? { client } : {}), ...(model ? { model } : {}) } : undefined;
    return result(await application.startWork({ stack: stackSelector }, { componentId, summary, ...(workId ? { workId } : {}), ...(actor ? { actor } : {}) }) as unknown as Record<string, unknown>);
  });

  server.registerTool("turn_complete", {
    title: "Record completed agent turn", description: "Append a progress checkpoint for a Stack work session.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), summary: z.string().min(1), status: z.enum(["progress", "blocked", "failed", "complete"]).optional(), changedPaths: z.array(z.string()).optional(), nextStep: z.string().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, summary, status, changedPaths, nextStep }) => result(await application.completeTurn({ stack: stackSelector }, { sessionId, summary, ...(status ? { status } : {}), ...(changedPaths ? { changedPaths } : {}), ...(nextStep ? { nextStep } : {}) }) as unknown as Record<string, unknown>));

  server.registerTool("work_complete", {
    title: "Complete Stack work session", description: "Append the outcome for a Stack work session.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), summary: z.string().min(1), outcome: z.enum(["success", "partial", "failed", "cancelled"]).optional(), remaining: z.array(z.string()).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, summary, outcome, remaining }) => result(await application.completeWork({ stack: stackSelector }, { sessionId, summary, ...(outcome ? { outcome } : {}), ...(remaining ? { remaining } : {}) }) as unknown as Record<string, unknown>));

  server.registerTool("usage_record", {
    title: "Record agent usage", description: "Append provider/model/token/cost telemetry with explicit cost provenance.",
    inputSchema: z.object({ stack: selector, sessionId: z.string().min(1), provider: z.string().min(1), model: z.string().min(1), componentId: z.string().optional(), inputTokens: z.number().nonnegative().optional(), outputTokens: z.number().nonnegative().optional(), cachedInputTokens: z.number().nonnegative().optional(), reasoningTokens: z.number().nonnegative().optional(), toolCalls: z.number().nonnegative().optional(), durationMs: z.number().nonnegative().optional(), amount: z.number().nonnegative().optional(), currency: z.string().optional(), costKind: z.enum(["reported", "estimated", "allocated"]).optional(), pricingReference: z.string().optional(), note: z.string().optional() }).refine((value) => value.amount === undefined || value.costKind !== undefined, { message: "costKind is required whenever amount is supplied" }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ stack: stackSelector, sessionId, componentId, provider, model, inputTokens, outputTokens, cachedInputTokens, reasoningTokens, toolCalls, durationMs, amount, currency, costKind, pricingReference, note }) => {
    const usage: UsageData = { provider, model, ...(inputTokens === undefined ? {} : { inputTokens }), ...(outputTokens === undefined ? {} : { outputTokens }), ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }), ...(reasoningTokens === undefined ? {} : { reasoningTokens }), ...(toolCalls === undefined ? {} : { toolCalls }), ...(durationMs === undefined ? {} : { durationMs }), ...(amount === undefined ? {} : { amount }), ...(currency === undefined ? {} : { currency }), ...(costKind === undefined ? {} : { costKind: costKind as CostKind }), ...(pricingReference === undefined ? {} : { pricingReference }), ...(note === undefined ? {} : { note }) };
    return result(await application.recordUsage({ stack: stackSelector }, { sessionId, ...(componentId ? { componentId } : {}), usage }) as unknown as Record<string, unknown>);
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
