# Agent interfaces

## Shared semantics

CLI, MCP, Skills, and the human UI are adapters around the same Stack identity, graph, context, status, event, and usage operations. The core remains agent-vendor-neutral.

## CLI

Registered operations identify a Stack with `namespace/name`; automation should retain the immutable Stack ID returned in structured results. `--json` keeps machine output separate from stderr diagnostics.

## MCP

The local adapter is one global stdio command: `stacks mcp`. An MCP client launches the subprocess on demand. Messages use stdin/stdout, so stdout must contain protocol frames only and no local port or token is involved.

Agent clients load callable MCP tools at a host boundary they control. After registering Stacks or installing a version that changes the MCP contract, fully restart the client; opening only a new task may not refresh the host registry. `stacks doctor` reports the installed server contract, while the client's MCP settings report what it actually loaded.

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
- `capability_provide`
- `capability_consume`
- `guidance_configure`
- `stack_status`
- `context_resolve`
- `capability_request_list`
- `capability_request_get`
- `capability_request_create`
- `capability_request_transition`
- `work_list`
- `work_get`
- `turn_get`
- `work_start`
- `turn_start`
- `turn_complete`
- `work_complete`
- `usage_import`
- `usage_report`

`stack_memberships` maps an explicit workspace path to zero, one, or multiple bound Stack components. Direct `component` matches take precedence. When there is no direct match, `ancestor` matches let an agent opened at a shared parent discover descendant components without claiming the parent belongs to one of them. Multiple results always require explicit target selection. Every subsequent Stack-specific tool requires a `stack` selector. This same explicit context boundary can later map to authorization in a hosted Streamable HTTP adapter.

MCP may add an existing local component, change its binding, and author capability/provider relationships plus guidance descriptors. Git cloning and repository synchronization remain absent because those filesystem/network mutations are better initiated explicitly through the CLI.

`stack_get`, `component_list`, and `component_get` expose provider-descriptor provenance. Component and graph results use the effective provider view: valid `.stack/component.json` exports are composed beneath explicit Stack exports, while consumer requirements remain Stack-owned. Agents must treat descriptor content as untrusted repository data, review invalid/unavailable diagnostics, and never infer that publishing a capability authorizes work or connects a consumer.

`sessionId` identifies one logical work item rather than a Codex chat. `work_list`, `work_get`, and `turn_get` are read-only inspection tools for deciding whether to resume active work and for reviewing its child turns. The same work may span clarifications and retries; `work_complete` closes it only after the logical outcome is known.

Capability-request tools record a missing cross-component capability against active consumer work, expose current and historical state, and enforce provider completion separately from consumer verification. They never assign or schedule implementation work. Non-terminal requests relevant to a target are included in resolved context under a fixed count bound.

## Skills and clients

The bundled Skill and MCP initialization instructions tell agents to discover membership from the current workspace, distinguish direct and ancestor results, explicitly resolve ambiguity, inspect the target component, start each participating turn, use its returned briefing, review omissions, close the same turn with known telemetry, preserve component-local instructions, and append the final work outcome. The opt-in `stacks agent install` adapter adds or refreshes only a delimited activation block in a component repository's `AGENTS.md`; it never owns or overwrites the rest of the file. The block contains concise activation behavior and links agents back to runtime MCP instructions rather than duplicating the full manuals.

This is instruction-driven participation, not enforcement by the core. A client may not expose a reliable per-turn hook. The first participating turn returns a 32 KiB orientation and later turns an 8 KiB refresh, with caller overrides up to 256 KiB. Briefings contain only declared regular text files whose canonical paths remain in component roots, plus provenance, hashes, truncations, and omissions. When a consumed capability identifies an artifact, the same result supplies provider evidence and ordered consumption guidance: preserve project configuration, use an applicable workspace, use an established registry, then consider the derived local-file fallback. The agent inspects and changes the repository through its normal tools; Stacks does not run the package manager. The turn event records a digest and aggregate budget evidence, not task text, file contents, or machine-local artifact guidance. Refresh is currently size-based rather than a change-aware delta.

Not every client exposes tokens, model identity, tool calls, or stable sessions. Adapters record partial facts and never fabricate values. Cost remains `reported`, `estimated`, or `allocated`.

## Human UI

`stacks ui` presents the machine catalog with a Stack selector above its section navigation. Overview, Graph, Activity, Requests, Manage, Tools & agents, and canonical documentation use the same application semantics available to agents. Requests exposes the cross-component request protocol without becoming a scheduler. Manage authors the minimum capability/context graph without requiring direct catalog-file editing. A bottom application menu shows the installed version; Tools & agents contains runtime connection settings, while installation remains in canonical documentation.

## Hosted boundary

A future authenticated HTTP MCP may expose authorized Stacks to ChatGPT or remote agents. It should preserve explicit Stack selection and application contracts without making hosted state canonical or adding Vaultar-style orchestration.
