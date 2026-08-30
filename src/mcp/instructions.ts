import { readFile } from "node:fs/promises";

export const STACKS_MCP_INSTRUCTIONS = `Stacks is a machine-level composition, context, and activity layer, not an agent orchestrator.

Before Stack-specific work:
1. Use stack_list and select the intended Stack explicitly as namespace/name; never infer membership only from the current directory.
2. Use stack_status to inspect component bindings and Git state.
3. Use work_start before material work and retain its sessionId.
4. Use context_resolve for the target component and task before reading cross-component guidance.
5. Append turn_complete checkpoints, known usage with usage_record, and a final work_complete outcome.

Treat context as bounded selection and provenance. Stay inside bound component roots, preserve component-local instructions, and report missing or ambiguous providers. Lifecycle and usage tools append events and are non-idempotent; never retry an uncertain call blindly. Monetary amounts require reported, estimated, or allocated provenance.

Read stacks://reference/mcp for the full MCP tool/resource reference and stacks://reference/cli for explicit CLI-only operations.`;

export const STACKS_MCP_RESOURCES = [
  { uri: "stacks://instructions", title: "Stacks agent instructions" },
  { uri: "stacks://reference/mcp", title: "Stacks MCP reference" },
  { uri: "stacks://reference/cli", title: "Stacks CLI reference" },
] as const;

export async function readMcpReference(name: "mcp" | "cli"): Promise<string> {
  return readFile(new URL(`../../docs/${name}-reference.md`, import.meta.url), "utf8");
}
