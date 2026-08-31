# MCP server reference

This is the complete reference for the currently implemented Stacks MCP server. For shell usage, see the [CLI reference](cli-reference.md).

## Connection and discovery

The local server is one machine-level stdio adapter:

```bash
codex mcp add stacks -- stacks mcp
```

Fully quit and reopen Codex after registering Stacks. Also restart Codex after installing a Stacks version that changes MCP tools; creating another task inside the same desktop process may retain its previously loaded tool registry. Run `stacks doctor` to inspect the installed Stacks MCP contract, then use Codex's MCP settings or `/mcp` view to confirm that the client loaded it.

The client launches `stacks mcp` when needed. Local MCP has no URL, port, token, or long-running daemon. stdout is reserved for protocol messages; diagnostics go to stderr. Listing or reading MCP resources through a generic resource bridge does not by itself prove that the client loaded the server's callable tools.

MCP registration makes the tools available, but repository-level instructions are what reliably tell a newly started agent to consult them. Run `stacks agent install --path .` inside an opted-in component repository. Stacks manages only its delimited `AGENTS.md` block; `stacks agent check --path .` detects an absent or stale block, and `stacks agent remove --path .` removes only that block.

During initialization, the server supplies concise operating instructions. The same guidance is available through `instructions_get` and `stacks://instructions`. Read `stacks://reference/mcp` for this complete reference and `stacks://reference/cli` when a required mutation is intentionally CLI-only.

Every Stack-specific tool takes `stack` in `namespace/name` form. Use `stack_memberships` to discover which Stack components contain the current workspace. One directory may be bound to multiple Stacks, so multiple results require explicit selection rather than inference.

## Recommended agent sequence

1. Read the server instructions or call `instructions_get`.
2. Call `stack_memberships` with the workspace directory. A `component` result is direct; an `ancestor` result means the workspace contains descendant components and requires explicit target selection. If there is no match, call `stack_list`; never guess among multiple matches.
3. Call `component_get` and `stack_status` for the target component.
4. Treat one `sessionId` as a logical work item, not the whole chat. Reuse a retained active item across clarifications/retries; use `work_list` or `work_get` when status is uncertain, and call `work_start` before genuinely new material work.
5. At the beginning of every participating turn, call `turn_start` with the session and current task. Retain its `turnId`, use the materialized briefing, and review its omissions and truncations.
6. Close that exact turn with `turn_complete`, including only telemetry the client actually observes.
7. Use `usage_import` only for delayed provider exports or external measurements.
8. Call `work_complete` only when the logical work is finished and all its turns are closed. One chat may contain multiple work items.

## Resources

### `stacks://instructions`

Concise operating instructions and discovery links. MIME type: `text/markdown`.

### `stacks://reference/mcp`

This complete MCP reference. MIME type: `text/markdown`.

### `stacks://reference/cli`

The complete CLI reference, including the explicit synchronization surface that MCP intentionally omits. MIME type: `text/markdown`.

### `stacks://catalog`

Machine-level registered Stack identities. MIME type: `application/json`.

Output shape:

```json
{ "schemaVersion": "0.1", "stacks": [{ "id": "...", "namespace": "acme", "name": "portal" }] }
```

## Discovery tools

### `instructions_get`

Returns the server operating instructions and canonical resource URIs. Use it when the client exposes tools but does not surface initialization instructions or MCP resources.

Input: none.

Side effects: none; read-only and idempotent.

```json
{}
```

### `stack_list`

Lists registered Stacks available to the local adapter.

Input: none.

Output: `schemaVersion` plus Stack `id`, `namespace`, and `name` entries.

Side effects: none; read-only and idempotent.

```json
{}
```

### `stack_memberships`

Finds direct component membership or, as a fallback, components below an ancestor workspace. `path` is optional and defaults to the MCP process working directory; agents should pass their workspace path explicitly when available.

```json
{ "path": "/work/customer-portal/src" }
```

Output includes the canonical queried path, `resolution`, and a `memberships` array. `resolution: "component"` means the query is the component root or lies below it; each result includes `relativePath`. Only when no direct match exists, `resolution: "ancestor"` returns components below the query with `componentPath`. Direct results suppress unrelated descendants. Zero or multiple matches are valid, and ancestor results never choose which descendant component is the work target.

Side effects: none; read-only and idempotent. It does not inspect repository names, guess a Stack, or write markers.

### `stack_get`

Returns one effective registered Stack definition plus machine-local component bindings.

Input:

```json
{ "stack": "acme/customer-portal" }
```

Output: `manifest` and `bindings`. Bindings contain local absolute paths and are not portable definition data.

Side effects: none; read-only and idempotent.

### `component_list`

Lists every component declaration and explicit machine binding for one Stack.

```json
{ "stack": "acme/customer-portal" }
```

Side effects: none; read-only and idempotent.

### `component_get`

Returns one complete component declaration and its explicit binding.

```json
{ "stack": "acme/customer-portal", "componentId": "shared-ui" }
```

Side effects: none; read-only and idempotent.

### `component_add`

Adds an existing local directory to a Stack. Required input: `stack`, `componentId`, and `path`. Optional input: `name` and `kind`; kind defaults to the extensible label `component`.

```json
{
  "stack": "acme/customer-portal",
  "componentId": "shared-ui",
  "path": "/work/shared-ui",
  "name": "Shared UI",
  "kind": "library"
}
```

Side effects: writes the Stack definition and machine-local binding, appends a `component.added` Activity event attributed to `stacks-mcp`, then inspects the directory. It does not clone, move, or modify the component repository. Non-idempotent: do not retry an uncertain call without checking `component_get`.

### `component_bind`

Changes the explicit local directory for an existing component.

```json
{ "stack": "acme/customer-portal", "componentId": "shared-ui", "path": "/work/shared-ui" }
```

Side effects: writes the machine-local binding and, when the path changed, appends a `component.binding.changed` Activity event attributed to `stacks-mcp`, then inspects the directory. For a missing Git destination it reports that cloning would be required but does not perform the clone. It does not move or modify the repository. Idempotent for the same Stack, component, and path.

### `capability_provide`

Upserts a capability exported by a component and optionally exposes one component-relative context path.

```json
{
  "stack": "acme/customer-portal",
  "componentId": "shared-ui",
  "capability": "ui.react.components",
  "description": "Shared React components",
  "contextPath": "docs/components.md",
  "strength": "required",
  "priority": 1000
}
```

Side effects: when state changes, writes the portable Stack definition and appends a `component.configuration.changed` event attributed to `stacks-mcp`. An identical upsert is an event no-op. It never writes the referenced file. Idempotent for the same Stack, component, and capability.

### `capability_consume`

Upserts a capability requirement for a consumer. `from` selects the authoritative provider; omit it only when provider inference is intentionally unambiguous.

```json
{ "stack": "acme/customer-portal", "componentId": "app", "capability": "ui.react.components", "from": "shared-ui", "optional": false }
```

Side effects: when state changes, writes the portable Stack definition and appends a configuration event. An identical upsert is an event no-op. Idempotent for the same Stack, component, and capability.

### `guidance_configure`

Upserts one component-relative guidance descriptor.

```json
{
  "stack": "acme/customer-portal",
  "componentId": "standards",
  "path": "engineering.md",
  "description": "Required engineering rules",
  "strength": "required",
  "priority": 1000,
  "appliesTo": ["practice.engineering"]
}
```

Side effects: when state changes, writes the portable Stack definition and appends a configuration event. An identical upsert is an event no-op. It never creates or modifies the guidance file. Idempotent for the same Stack, component, and path.

### `stack_status`

Validates the loaded Stack and inspects component paths and Git state without modifying repositories.

Input:

```json
{ "stack": "acme/customer-portal" }
```

Output: versioned Stack identity plus component existence, root, source type, Git observations, and issues.

Side effects: none; read-only and idempotent.

### `context_resolve`

Builds a deterministic, explainable context plan and safely materializes declared regular text files into a hard-budget briefing.

Input:

```json
{
  "stack": "acme/customer-portal",
  "target": "app",
  "task": "Add account recovery",
  "mode": "orientation",
  "maxBytes": 32768
}
```

`mode` is optional (`orientation` by default); `maxBytes` is optional and must be from 1 through 262144. Orientation defaults to 32768 bytes and refresh to 8192 bytes. Task keywords match declared path, description, tags, capabilities, and selection reasons within each strength tier.

Output includes the plan plus `briefing`: safely read content, source/included byte counts, SHA-256 content hashes, truncation state, provenance, omissions, exact budget use, and a SHA-256 digest. Missing, unreadable, directory, unsafe symlink escape, binary, and budget exclusions are explicit. The tool never scans undeclared paths. Side effects: none; read-only and idempotent.

Side effects: none; read-only and idempotent.

### `work_list`

Lists recent logical work and its active/completed state, component, actor, turn count, opening title, completion result, and usage. A work item is not an agent chat.

```json
{ "stack": "acme/customer-portal", "componentId": "app", "status": "active" }
```

`componentId` and `status` (`active` or `completed`) are optional filters. Output is bounded to the Activity work limit. Side effects: none; read-only and idempotent.

### `work_get`

Returns one logical work item, its child turns in newest-first order, and sanitized lifecycle events.

```json
{ "stack": "acme/customer-portal", "sessionId": "session-id" }
```

Use this before resuming a retained `sessionId` when its status is uncertain. Side effects: none; read-only and idempotent.

### `turn_get`

Returns one turn's status, outcome summary, changed paths, next step, usage, briefing identity/counts, and linked sanitized events.

```json
{ "stack": "acme/customer-portal", "sessionId": "session-id", "turnId": "turn-id" }
```

Side effects: none; read-only and idempotent.

## Work lifecycle tools

Lifecycle tools append events and are deliberately non-idempotent. Never retry an uncertain call blindly; first determine whether its event was recorded.

### `work_start`

Appends a work-start event for one component and returns a `sessionId`. It represents one logical unit of work that may span multiple turns, retries, or clarifications—not an entire Codex chat and not one response.

Required input: `stack`, `componentId`, `summary`.

Optional input: `workId`, `agent`, `client`, `model`.

```json
{
  "stack": "acme/customer-portal",
  "componentId": "app",
  "summary": "Implement account recovery",
  "agent": "codex",
  "client": "codex-desktop"
}
```

### `turn_start`

Opens one turn in an active work session, appends `turn.started`, and returns top-level `sessionId` and `turnId` fields together with the target component's current plan, materialized briefing, and underlying event. Only one turn may be open in a session.

Required input: `stack`, `sessionId`, `task`. Optional `maxBytes` overrides the cadence default from 1 through 262144.

The first turn is an `orientation` with a 32768-byte default. Later turns are `refresh` briefings with an 8192-byte default. Refresh currently re-materializes the ranked current plan under the smaller budget; it is not yet a change-aware delta. Task text and file contents are transient. The durable event records the briefing digest, mode, bytes, budget, and aggregate counts.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
  "task": "Add account recovery"
}
```

### `turn_complete`

Closes one started turn. It appends `turn.completed` and, when `usage` is supplied, a linked `usage.recorded` event under the same event-writer lock.

Required input: `stack`, `sessionId`, `turnId`, `summary`.

Optional input:

- `status`: `progress`, `blocked`, `failed`, or `complete`;
- `changedPaths`: array of component-relative changed paths;
- `nextStep`: concise next action;
- `usage`: observed provider/model/token/duration/tool/cost facts for this turn. `provider` and `model` are required inside `usage`; monetary amounts require `costKind`.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
  "turnId": "turn-id",
  "summary": "Added recovery request flow and tests",
  "status": "progress",
  "changedPaths": ["src/recovery.ts", "test/recovery.test.ts"],
  "nextStep": "Add the delivery adapter",
  "usage": { "provider": "openai", "model": "gpt-5", "inputTokens": 1200, "outputTokens": 340 }
}
```

### `work_complete`

Appends the final logical-work outcome. Call it only when that work is finished, not automatically after every agent response. It refuses completion while a turn remains open.

Required input: `stack`, `sessionId`, `summary`.

Optional input:

- `outcome`: `success`, `partial`, `failed`, or `cancelled`;
- `remaining`: array of remaining work descriptions.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
  "summary": "Account recovery verified",
  "outcome": "success",
  "remaining": []
}
```

## Usage tools

### `usage_import`

Imports delayed provider/model/token/cost telemetry that was not available during live turn completion. Normal participating agents report known telemetry through `turn_complete`; unknown values are omitted rather than estimated silently.

Required input: `stack`, `provider`, `model`.

Optional input: `sessionId`, `turnId`, `componentId`, `inputTokens`, `outputTokens`, `cachedInputTokens`, `reasoningTokens`, `toolCalls`, `durationMs`, `amount`, `currency`, `costKind`, `pricingReference`, and `note`. A supplied `turnId` must identify a known turn and determines its session.

If `amount` is present, `costKind` is required:

- `reported`: provider or client billing data;
- `estimated`: calculated from a cited pricing snapshot;
- `allocated`: a shared charge assigned by an explicit rule.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
  "turnId": "turn-id",
  "provider": "openai",
  "model": "gpt-5",
  "inputTokens": 1200,
  "outputTokens": 340,
  "amount": 0.02,
  "currency": "USD",
  "costKind": "reported",
  "pricingReference": "provider usage export"
}
```

Do not record raw prompts, completions, secrets, or source payloads.

### `usage_report`

Aggregates recorded usage for one Stack.

Input:

```json
{ "stack": "acme/customer-portal" }
```

Output: grouped provider/model/component rows, token counts, currency amounts, and warnings.

Side effects: none; read-only and idempotent.

## Intentionally absent from MCP

Git clone/fetch, lock writing, UI startup, repository activation-file management, and installation troubleshooting remain CLI operations. They modify repositories or machine state, start a process, or are human operational concerns. Existing-directory component registration and binding are available through `component_add` and `component_bind`. Use `stacks://reference/cli` for the remaining CLI-only operations and invoke them only with appropriate user intent; never substitute an undisclosed shell action for a missing MCP tool.
