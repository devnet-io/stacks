# Agent interfaces

## Shared semantics

CLI, MCP, Skills, and the human UI are adapters around the same Stack identity, graph, context, status, event, and usage operations. The core remains agent-vendor-neutral.

## CLI

Registered operations identify a Stack with `namespace/name`; automation should retain the immutable Stack ID returned in structured results. `--json` keeps machine output separate from stderr diagnostics.

## MCP

The local adapter is one global stdio command: `stacks mcp`. An MCP client launches the subprocess on demand. Messages use stdin/stdout, so stdout must contain protocol frames only and no local port or token is involved.

The server sends concise operating instructions during MCP initialization. Clients may also call the read-only `instructions_get` tool or read `stacks://instructions`. Full runtime references are available as `stacks://reference/mcp` and `stacks://reference/cli`; these resources are packaged with the installed server.

Resources are:

- `stacks://instructions`
- `stacks://reference/mcp`
- `stacks://reference/cli`
- `stacks://catalog`

Current tools are:

- `instructions_get`
- `stack_list`
- `stack_memberships`
- `stack_get`
- `component_list`
- `component_get`
- `component_add`
- `component_bind`
- `stack_status`
- `context_resolve`
- `work_start`
- `turn_complete`
- `work_complete`
- `usage_record`
- `usage_report`

`stack_memberships` maps an explicit workspace path to zero, one, or multiple bound Stack components. It never guesses when a directory is shared. Every subsequent Stack-specific tool requires a `stack` selector. This same explicit context boundary can later map to authorization in a hosted Streamable HTTP adapter.

MCP may add an existing local component and change its binding, but Git cloning and repository synchronization remain absent because those filesystem/network mutations are better initiated explicitly through the CLI.

## Skills and clients

The bundled Skill tells agents to prefer server instructions and runtime reference resources, discover membership from the current workspace, explicitly resolve ambiguity, inspect the target component, resolve bounded context, preserve component-local instructions, and append lifecycle events. It supplements rather than overwrites `AGENTS.md` in component repositories and does not duplicate the full interface manuals.

Not every client exposes tokens, model identity, tool calls, or stable sessions. Adapters record partial facts and never fabricate values. Cost remains `reported`, `estimated`, or `allocated`.

## Human UI

`stacks ui` presents the machine catalog with a Stack selector above its section navigation. Overview, Graph, Activity, Tools & agents, and canonical documentation use the same contracts available to agents. A bottom application menu shows the installed version; Tools & agents contains runtime connection settings, while installation remains in canonical documentation.

## Hosted boundary

A future authenticated HTTP MCP may expose authorized Stacks to ChatGPT or remote agents. It should preserve explicit Stack selection and application contracts without making hosted state canonical or adding Vaultar-style orchestration.
