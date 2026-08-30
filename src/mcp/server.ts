import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { statusOutput } from "../application/contracts.ts";
import { buildUsageReport } from "../core/usage.ts";
import { completeTurn, completeWork, recordUsage, startWork } from "../core/events.ts";
import { resolveContext } from "../core/context.ts";
import { componentById, loadStack } from "../core/manifest.ts";
import { getComponentStatuses } from "../core/status.ts";
import type { CostKind, UsageData } from "../core/types.ts";

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function buildMcpServer(root: string): McpServer {
  const server = new McpServer({ name: "stacks", version: "0.0.0-alpha.1" });

  server.registerResource(
    "stack-manifest",
    "stack://manifest",
    { title: "Stack manifest", description: "The effective portable Stack declaration.", mimeType: "application/json" },
    async (uri) => {
      const stack = await loadStack(root);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(stack.manifest, null, 2) }] };
    },
  );

  server.registerResource(
    "stack-component",
    new ResourceTemplate("stack://component/{id}", {
      list: async () => {
        const stack = await loadStack(root);
        return {
          resources: stack.manifest.components.map((component) => ({
            uri: `stack://component/${encodeURIComponent(component.id)}`,
            name: component.name ?? component.id,
            ...(component.description === undefined ? {} : { description: component.description }),
          })),
        };
      },
    }),
    { title: "Stack component", description: "One component declaration from the Stack.", mimeType: "application/json" },
    async (uri, variables) => {
      const stack = await loadStack(root);
      const id = decodeURIComponent(String(variables.id));
      const component = componentById(stack.manifest, id);
      if (!component) throw new Error(`Unknown component: ${id}.`);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(component, null, 2) }] };
    },
  );

  server.registerResource(
    "stack-context-plan",
    new ResourceTemplate("stack://context/{target}", { list: undefined }),
    { title: "Stack context plan", description: "Deterministic context selected for a target component.", mimeType: "application/json" },
    async (uri, variables) => {
      const stack = await loadStack(root);
      const target = decodeURIComponent(String(variables.target));
      const plan = resolveContext(stack, target);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(plan, null, 2) }] };
    },
  );

  server.registerTool(
    "stack_get",
    {
      title: "Get Stack",
      description: "Return the effective Stack manifest. Read-only.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const stack = await loadStack(root);
      return result({ root: stack.root, manifestPath: stack.manifestPath, manifest: stack.manifest });
    },
  );

  server.registerTool(
    "stack_status",
    {
      title: "Inspect Stack status",
      description: "Inspect materialized component paths and Git state without modifying them.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const stack = await loadStack(root);
      return result(statusOutput(stack, getComponentStatuses(stack)) as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "context_resolve",
    {
      title: "Resolve component context",
      description: "Build a deterministic, provenance-rich context plan for one target component. This returns descriptors and does not concatenate file contents.",
      inputSchema: z.object({
        target: z.string().min(1).describe("Target component ID"),
        task: z.string().optional().describe("Optional task description, retained for later selectors"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async ({ target, task }) => {
      const stack = await loadStack(root);
      const plan = resolveContext(stack, target, task);
      return result(plan as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "work_start",
    {
      title: "Start Stack work session",
      description: "Record that an agent has started work on a component and return the generated session ID.",
      inputSchema: z.object({
        componentId: z.string().min(1),
        summary: z.string().min(1),
        workId: z.string().optional(),
        agent: z.string().optional(),
        client: z.string().optional(),
        model: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ componentId, summary, workId, agent, client, model }) => {
      const stack = await loadStack(root);
      const actor = agent || client || model ? {
        ...(agent === undefined ? {} : { agent }),
        ...(client === undefined ? {} : { client }),
        ...(model === undefined ? {} : { model }),
      } : undefined;
      const event = await startWork(stack, {
        componentId,
        summary,
        ...(workId === undefined ? {} : { workId }),
        ...(actor === undefined ? {} : { actor }),
      });
      return result(event as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "turn_complete",
    {
      title: "Record completed agent turn",
      description: "Append a meaningful progress checkpoint for an existing Stack work session.",
      inputSchema: z.object({
        sessionId: z.string().min(1),
        summary: z.string().min(1),
        status: z.enum(["progress", "blocked", "failed", "complete"]).optional(),
        changedPaths: z.array(z.string()).optional(),
        nextStep: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ sessionId, summary, status, changedPaths, nextStep }) => {
      const stack = await loadStack(root);
      const event = await completeTurn(stack, {
        sessionId,
        summary,
        ...(status === undefined ? {} : { status }),
        ...(changedPaths === undefined ? {} : { changedPaths }),
        ...(nextStep === undefined ? {} : { nextStep }),
      });
      return result(event as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "work_complete",
    {
      title: "Complete Stack work session",
      description: "Append the outcome and remaining work for an existing Stack session.",
      inputSchema: z.object({
        sessionId: z.string().min(1),
        summary: z.string().min(1),
        outcome: z.enum(["success", "partial", "failed", "cancelled"]).optional(),
        remaining: z.array(z.string()).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ sessionId, summary, outcome, remaining }) => {
      const stack = await loadStack(root);
      const event = await completeWork(stack, {
        sessionId,
        summary,
        ...(outcome === undefined ? {} : { outcome }),
        ...(remaining === undefined ? {} : { remaining }),
      });
      return result(event as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "usage_record",
    {
      title: "Record agent usage",
      description: "Append provider/model/token/cost telemetry. Monetary amounts must identify whether they are reported, estimated, or allocated.",
      inputSchema: z.object({
        sessionId: z.string().min(1),
        provider: z.string().min(1),
        model: z.string().min(1),
        inputTokens: z.number().nonnegative().optional(),
        outputTokens: z.number().nonnegative().optional(),
        cachedInputTokens: z.number().nonnegative().optional(),
        reasoningTokens: z.number().nonnegative().optional(),
        toolCalls: z.number().nonnegative().optional(),
        durationMs: z.number().nonnegative().optional(),
        amount: z.number().nonnegative().optional(),
        currency: z.string().optional(),
        costKind: z.enum(["reported", "estimated", "allocated"]).optional(),
        pricingReference: z.string().optional(),
        note: z.string().optional(),
      }).refine((value) => value.amount === undefined || value.costKind !== undefined, {
        message: "costKind is required whenever amount is supplied",
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ sessionId, provider, model, inputTokens, outputTokens, cachedInputTokens, reasoningTokens, toolCalls, durationMs, amount, currency, costKind, pricingReference, note }) => {
      const stack = await loadStack(root);
      const usage: UsageData = {
        provider,
        model,
        ...(inputTokens === undefined ? {} : { inputTokens }),
        ...(outputTokens === undefined ? {} : { outputTokens }),
        ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
        ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
        ...(toolCalls === undefined ? {} : { toolCalls }),
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(amount === undefined ? {} : { amount }),
        ...(currency === undefined ? {} : { currency }),
        ...(costKind === undefined ? {} : { costKind: costKind as CostKind }),
        ...(pricingReference === undefined ? {} : { pricingReference }),
        ...(note === undefined ? {} : { note }),
      };
      const event = await recordUsage(stack, { sessionId, usage });
      return result(event as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    "usage_report",
    {
      title: "Get usage report",
      description: "Aggregate normalized usage events by provider, model, and component.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async () => {
      const stack = await loadStack(root);
      return result(await buildUsageReport(stack) as unknown as Record<string, unknown>);
    },
  );

  return server;
}

export function startMcpServer(root: string): void {
  const handle = serveStdio(() => buildMcpServer(root));
  console.error(`Stacks MCP server is listening for ${root}`);
  process.on("SIGINT", () => {
    void handle.close();
  });
  process.on("SIGTERM", () => {
    void handle.close();
  });
}
