# Local HTTP API reference

The installed `stacks ui` process serves the static web application and this versioned loopback API from one origin. The default origin is `http://127.0.0.1:3210`; if that port is occupied, use the URL printed by `stacks ui`.

The current API is for the local UI and local automation. It has no remote authentication and must not be exposed beyond loopback. A future authenticated remote transport is described separately in ADR 0007.

## Conventions

- Current routes use `/api/v0.1` and JSON responses with `schemaVersion: "0.1"`.
- Stack selectors use `namespace/name` in the `stack` query parameter or request body.
- Mutations require `Content-Type: application/json`. Browser mutation origins must be loopback origins.
- `400` means invalid input, `403` means a rejected browser origin, `404` means an unknown Stack/component/route, `409` means a conflict, `413` means the request exceeds 64 KiB, and `415` means a mutation did not use JSON.
- Git operations remain conservative. Add or bind may inspect or clone at an explicit path but never resets, cleans, merges, rebases, or overwrites dirty work.

## Health and catalog

### `GET /api/v0.1/health`

Returns `{ "schemaVersion": "0.1", "status": "ok", "version": "<product-version>" }`.

### `POST /api/v0.1/runtime/shutdown`

Internal lifecycle endpoint used only by `npm run install:local`. It exists only on a UI process registered by the launcher, requires `Content-Type: application/json` and that process's random `X-Stacks-Runtime-Token`, and returns `202` before graceful shutdown. The token is stored in the machine-local platform state directory and is never exposed in the web UI or documentation output. Missing or invalid tokens return `403`; servers started without runtime control return `404`.

### `GET /api/v0.1/stacks`

Lists registered Stack identities.

### `GET /api/v0.1/components`

Requires `?stack=namespace%2Fname`. Returns complete portable component declarations plus their explicit machine-local bindings for the Manage interface.

## Stack views

These routes accept `?stack=namespace%2Fname`. Without it, the first catalog entry is selected for compatibility with the local UI bootstrap.

### `GET /api/v0.1/overview`

Returns Stack identity, storage mode, component health summary, explicit paths, and Git status.

### `GET /api/v0.1/activity`

Returns full-history counts and usage totals plus at most 50 logical-work summaries and 30 recent Stack changes. A work summary preserves its opening title separately from its completion result and reports child-turn count, active status, actor, component, and usage. Lifecycle/usage events do not clutter the Stack-change list. Monetary totals remain separated by `reported`, `estimated`, and `allocated` provenance. The response follows `schemas/http-activity.schema.json`.

### `GET /api/v0.1/activity/work`

Requires `?stack=namespace%2Fname&session=<sessionId>` for registered mode. Returns one logical work item, its ordered turn summaries, and at most 100 sanitized events scoped to that work. `sessionId` is a durable logical-work identifier, not an agent-chat identity. Unknown work returns `404`. The response follows `schemas/http-activity-work.schema.json`.

### `GET /api/v0.1/activity/turn`

Requires `?stack=namespace%2Fname&session=<sessionId>&turn=<turnId>`. Returns one turn with status, outcome summary, changed paths, next step, briefing identity/counts, usage, and sanitized linked events. Unknown work or turn returns `404`. The response follows `schemas/http-activity-turn.schema.json`.

### `GET /api/v0.1/capability-requests`

Requires `?stack=namespace%2Fname`. Returns at most 50 request summaries newest-update first, including current state, requester, expected provider, blocked session, reason, acceptance, and latest evidence. The response follows `schemas/http-capability-requests.schema.json`.

### `GET /api/v0.1/capability-request`

Requires `?stack=namespace%2Fname&request=<requestId>`. Returns one request, newest-first transitions, sanitized linked events, and reader warnings. Unknown requests return `404`. The response follows `schemas/http-capability-request.schema.json`.

### `GET /api/v0.1/graph`

Returns component nodes, editable display metadata and access, declared implementation artifacts (including component-relative artifact roots), required/optional capability requirements, capability/dependency edges, and unresolved requirements. Capability edges and requirement entries carry `optional`; direct dependency edges currently report `optional: false`.

### `GET /api/v0.1/integrations`

Returns runtime diagnostics, generated CLI/MCP setup, and the safe `AGENTS.md` activation install/check/remove commands for the selected Stack. The local MCP object sets `clientRestartRequiredAfterRegistrationOrUpgrade: true` because the agent client owns its loaded callable-tool registry. Secret values are never returned. The response follows `schemas/http-integrations.schema.json`.

## Create a Stack

### `POST /api/v0.1/stacks`

```json
{ "selector": "acme/customer-portal" }
```

Returns `201` with the immutable identity. It creates catalog state only; it does not create a project directory.

## Add a component

### `GET /api/v0.1/components?stack=namespace/name`

Returns every effective component with its explicit machine binding and provider-descriptor report. The descriptor report includes `path`, `status` (`absent`, `valid`, `invalid`, or `unavailable`), `publishedCapabilities`, `appliedCapabilities`, `overriddenCapabilities`, and `errors`. Valid provider exports are composed beneath explicit Stack exports; invalid input contributes nothing. This route is read-only, performs no repository writes, and follows `schemas/http-components.schema.json`.

### `POST /api/v0.1/components`

```json
{
  "stack": "acme/customer-portal",
  "id": "app",
  "path": "/work/customer-portal",
  "name": "Customer portal",
  "kind": "product",
  "git": "https://github.com/acme/customer-portal.git"
}
```

`stack`, `id`, and `path` are required. `git`, `name`, and `kind` are optional; omitted kind persists as `component`. Without `git`, the directory must already exist. With `git`, a missing explicit path may be cloned. Returns `201` with Stack identity, component binding, and synchronization result, and appends a `component.added` Activity event attributed to `stacks-web`.

## Edit component metadata

### `PUT /api/v0.1/component`

```json
{ "stack": "acme/customer-portal", "componentId": "app", "name": "Customer portal", "description": "Primary product", "kind": "product", "access": "read-write" }
```

At least one editable field is required. `name` and `description` accept `null` to clear them. Component ID and source provenance are immutable; use the binding endpoint for the machine path. Access is advisory and does not change operating-system permissions. A changed value appends a `component.configuration.changed` Activity event attributed to `stacks-web`; identical values are an event no-op.

## Change a component binding

### `PUT /api/v0.1/component-binding`

```json
{
  "stack": "acme/customer-portal",
  "componentId": "app",
  "path": "/work/customer-portal"
}
```

Changes only the machine-local binding. Stacks never moves the repository. A non-Git component path must exist; a missing Git path may be cloned. Returns Stack identity, the resulting binding, and synchronization result. A changed path appends a `component.binding.changed` Activity event attributed to `stacks-web`; the same path is an event no-op.

## Configure context and capabilities

These idempotent mutations update the portable Stack definition and append a `component.configuration.changed` Activity event attributed to `stacks-web` only when state changes. An identical upsert is an event no-op. They never create or modify files in component repositories.

### `PUT /api/v0.1/capability-provider`

```json
{
  "stack": "acme/customer-portal",
  "componentId": "shared-ui",
  "capability": "ui.react.components",
  "description": "Shared React components",
  "contextPath": "docs/components.md",
  "strength": "required",
  "priority": 1000,
  "artifactEcosystem": "npm",
  "artifactName": "@acme/ui",
  "artifactPath": "."
}
```

Upserts by component and capability. `description`, `contextPath`, `strength`, `priority`, and artifact fields are optional. `artifactEcosystem` and `artifactName` must appear together; `artifactPath` is component-relative. The endpoint records portable metadata only and does not invoke a package manager.

### `PUT /api/v0.1/capability-requirement`

```json
{ "stack": "acme/customer-portal", "componentId": "app", "capability": "ui.react.components", "from": "shared-ui", "optional": false }
```

Upserts by component and capability. `from` and `optional` are optional. `optional` defaults to `false`; unresolved required relationships become context errors while unresolved optional relationships become warnings. Graph returns the distinction for resolved and unresolved capability relationships. Direct `dependsOn` relationships are currently required.

### `PUT /api/v0.1/component-guidance`

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

Upserts by component and path. Every path is component-relative; the referenced content remains repository-owned.

## Capability request mutations

These JSON-only mutations append request events. They do not assign agents, schedule work, or modify component repositories.

### `POST /api/v0.1/capability-requests`

```json
{
  "stack": "acme/customer-portal",
  "requesterComponentId": "app",
  "providerComponentId": "shared-ui",
  "sessionId": "active-session-id",
  "capability": "ui.dialog",
  "reason": "Avoid a product-local dialog",
  "acceptance": "Accessible export and usage guide"
}
```

The active session must belong to the requester, and requester/provider must be distinct registered components. Returns `201` with request detail. Non-idempotent.

### `PUT /api/v0.1/capability-request`

```json
{
  "stack": "acme/customer-portal",
  "requestId": "request-id",
  "componentId": "shared-ui",
  "status": "provider-complete",
  "summary": "Dialog exported and documented",
  "evidence": "shared-ui@abc123"
}
```

Appends one role-checked transition and returns updated request detail. Invalid lifecycle transitions return `409`; unknown requests return `404`. Non-idempotent.

## Not yet exposed

Portable definition register/export, bulk synchronization, context, work/turn lifecycle writes, and usage writes currently remain CLI/MCP operations. The HTTP API exposes their read-only Activity projection and the full capability-request protocol. Remaining write parity will be added through `StacksApplication` before the remote endpoint mode ships.
