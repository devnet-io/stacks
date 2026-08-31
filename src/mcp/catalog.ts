export const STACKS_MCP_TOOL_NAMES = [
  "instructions_get",
  "stack_list",
  "stack_memberships",
  "stack_get",
  "component_list",
  "component_get",
  "component_add",
  "component_bind",
  "capability_provide",
  "capability_consume",
  "guidance_configure",
  "stack_status",
  "context_resolve",
  "work_start",
  "turn_start",
  "turn_complete",
  "work_complete",
  "usage_import",
  "usage_report",
] as const;

export const STACKS_MCP_RESOURCES = [
  { uri: "stacks://instructions", title: "Stacks agent instructions" },
  { uri: "stacks://reference/mcp", title: "Stacks MCP reference" },
  { uri: "stacks://reference/cli", title: "Stacks CLI reference" },
  { uri: "stacks://catalog", title: "Registered Stacks" },
] as const;

export const STACKS_MCP_CLI_ONLY_OPERATIONS = [
  "Git clone/fetch",
  "lock writing",
  "UI startup",
  "agent activation-file management",
  "installation troubleshooting",
] as const;
