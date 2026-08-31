import { readFile } from "node:fs/promises";

export { STACKS_MCP_RESOURCES } from "./catalog.ts";

export const STACKS_MCP_INSTRUCTIONS = `Stacks is a machine-level composition, context, and activity layer, not an agent orchestrator.

Before Stack-specific work:
1. Use stack_memberships with the current workspace directory. If it returns no match, use stack_list; if it returns multiple matches, select explicitly instead of guessing.
2. Use component_get and stack_status to inspect the selected component, its binding, and Git state.
3. Use work_start before material work and retain its sessionId.
4. At the start of every participating agent turn, use turn_start with the sessionId and current task. Retain its turnId and use the returned context plan before relying on cross-component knowledge or capabilities.
5. Close that exact turn with turn_complete. Include known turn telemetry there, omitting facts the client cannot observe.
6. Use usage_import only for delayed provider exports or external measurements, then append a final work_complete outcome after all turns are closed.

Treat context as bounded selection and provenance. Stay inside bound component roots, preserve component-local instructions, and report missing or ambiguous providers. Lifecycle and usage tools append events and are non-idempotent; never retry an uncertain call blindly. Monetary amounts require reported, estimated, or allocated provenance.

Component tools can inspect, add, and bind existing local directories. Use the CLI for Git cloning or synchronization. Read stacks://reference/mcp for the full MCP tool/resource reference and stacks://reference/cli for explicit CLI-only operations.`;

export async function readMcpReference(name: "mcp" | "cli"): Promise<string> {
  return readFile(new URL(`../../docs/${name}-reference.md`, import.meta.url), "utf8");
}
