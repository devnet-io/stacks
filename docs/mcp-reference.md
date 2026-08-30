# MCP server reference

This is the complete reference for the currently implemented Stacks MCP server. For shell usage, see the [CLI reference](cli-reference.md).

## Connection and discovery

The local server is one machine-level stdio adapter:

```bash
codex mcp add stacks -- stacks mcp
```

The client launches `stacks mcp` when needed. Local MCP has no URL, port, token, or long-running daemon. stdout is reserved for protocol messages; diagnostics go to stderr.

MCP registration makes the tools available, but repository-level instructions are what reliably tell a newly started agent to consult them. Run `stacks agent install --path .` inside an opted-in component repository. Stacks manages only its delimited `AGENTS.md` block; `stacks agent check --path .` detects an absent or stale block, and `stacks agent remove --path .` removes only that block.

During initialization, the server supplies concise operating instructions. The same guidance is available through `instructions_get` and `stacks://instructions`. Read `stacks://reference/mcp` for this complete reference and `stacks://reference/cli` when a required mutation is intentionally CLI-only.

Every Stack-specific tool takes `stack` in `namespace/name` form. Use `stack_memberships` to discover which Stack components contain the current workspace. One directory may be bound to multiple Stacks, so multiple results require explicit selection rather than inference.

## Recommended agent sequence

1. Read the server instructions or call `instructions_get`.
2. Call `stack_memberships` with the workspace directory. If there is no match, call `stack_list`; if there are multiple matches, select explicitly.
3. Call `component_get` and `stack_status` for the target component.
4. Call `work_start` before material work and retain the returned `sessionId`.
5. Call `context_resolve` for the target and task before reading cross-component guidance.
6. Append `turn_complete` after meaningful increments or blockers.
7. Call `usage_record` only with known facts.
8. Call `work_complete` with the outcome and remaining work.

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

Finds every component binding that contains a directory. `path` is optional and defaults to the MCP process working directory; agents should pass their workspace path explicitly when available.

```json
{ "path": "/work/customer-portal/src" }
```

Output includes the canonical queried path and a `memberships` array. Each membership contains Stack identity, component identity/name/kind, the component root, and the path relative to that root. Zero or multiple matches are valid results.

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

Side effects: writes the Stack definition and machine-local binding, then inspects the directory. It does not clone, move, or modify the component repository. Non-idempotent: do not retry an uncertain call without checking `component_get`.

### `component_bind`

Changes the explicit local directory for an existing component.

```json
{ "stack": "acme/customer-portal", "componentId": "shared-ui", "path": "/work/shared-ui" }
```

Side effects: writes the machine-local binding and inspects the directory. For a missing Git destination it reports that cloning would be required but does not perform the clone. It does not move or modify the repository. Idempotent for the same Stack, component, and path.

### `stack_status`

Validates the loaded Stack and inspects component paths and Git state without modifying repositories.

Input:

```json
{ "stack": "acme/customer-portal" }
```

Output: versioned Stack identity plus component existence, root, source type, Git observations, and issues.

Side effects: none; read-only and idempotent.

### `context_resolve`

Builds a deterministic, explainable context plan for one target component and optional task.

Input:

```json
{
  "stack": "acme/customer-portal",
  "target": "app",
  "task": "Add account recovery"
}
```

Output: selected context items with owning component, path, strength, reasons, provider chain, warnings, and errors. The plan is bounded selection and provenance, not permission to read outside component roots or concatenate every repository.

Side effects: none; read-only and idempotent.

## Work lifecycle tools

Lifecycle tools append events and are deliberately non-idempotent. Never retry an uncertain call blindly; first determine whether its event was recorded.

### `work_start`

Appends a work-start event for one component and returns a `sessionId`.

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

### `turn_complete`

Appends a completed-turn checkpoint to an existing session.

Required input: `stack`, `sessionId`, `summary`.

Optional input:

- `status`: `progress`, `blocked`, `failed`, or `complete`;
- `changedPaths`: array of component-relative changed paths;
- `nextStep`: concise next action.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
  "summary": "Added recovery request flow and tests",
  "status": "progress",
  "changedPaths": ["src/recovery.ts", "test/recovery.test.ts"],
  "nextStep": "Add the delivery adapter"
}
```

### `work_complete`

Appends the final work outcome.

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

### `usage_record`

Appends known provider/model/token/cost telemetry. Unknown values should be omitted rather than estimated silently.

Required input: `stack`, `sessionId`, `provider`, `model`.

Optional input: `componentId`, `inputTokens`, `outputTokens`, `cachedInputTokens`, `reasoningTokens`, `toolCalls`, `durationMs`, `amount`, `currency`, `costKind`, `pricingReference`, and `note`.

If `amount` is present, `costKind` is required:

- `reported`: provider or client billing data;
- `estimated`: calculated from a cited pricing snapshot;
- `allocated`: a shared charge assigned by an explicit rule.

```json
{
  "stack": "acme/customer-portal",
  "sessionId": "session-id",
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

Component registration, binding, Git clone/fetch, lock writing, UI startup, and troubleshooting remain CLI operations. They mutate machine catalog or filesystem state, start a process, or are human operational concerns. Use `stacks://reference/cli` and invoke them only with appropriate user intent; never substitute an undisclosed shell action for a missing MCP tool.
