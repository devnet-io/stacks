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

Returns `{ "schemaVersion": "0.1", "status": "ok" }`.

### `GET /api/v0.1/stacks`

Lists registered Stack identities.

## Stack views

These routes accept `?stack=namespace%2Fname`. Without it, the first catalog entry is selected for compatibility with the local UI bootstrap.

### `GET /api/v0.1/overview`

Returns Stack identity, storage mode, component health summary, explicit paths, and Git status.

### `GET /api/v0.1/activity`

Returns the append-only event summary, token totals, cost totals grouped by currency and provenance, at most 100 work sessions, and at most the 100 newest sanitized events. Aggregate counts cover the complete readable history. Monetary totals are never combined across `reported`, `estimated`, and `allocated` values. The response follows `schemas/http-activity.schema.json`.

### `GET /api/v0.1/graph`

Returns component nodes, capability/dependency edges, and unresolved requirements.

### `GET /api/v0.1/integrations`

Returns runtime diagnostics and generated CLI/MCP setup for the selected Stack. Secret values are never returned.

## Create a Stack

### `POST /api/v0.1/stacks`

```json
{ "selector": "acme/customer-portal" }
```

Returns `201` with the immutable identity. It creates catalog state only; it does not create a project directory.

## Add a component

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

`stack`, `id`, and `path` are required. `git`, `name`, and `kind` are optional. Without `git`, the directory must already exist. With `git`, a missing explicit path may be cloned. Returns `201` with Stack identity, component binding, and synchronization result.

## Change a component binding

### `PUT /api/v0.1/component-binding`

```json
{
  "stack": "acme/customer-portal",
  "componentId": "app",
  "path": "/work/customer-portal"
}
```

Changes only the machine-local binding. Stacks never moves the repository. A non-Git component path must exist; a missing Git path may be cloned. Returns Stack identity, the resulting binding, and synchronization result.

## Not yet exposed

Portable definition register/export, bulk synchronization, context, lifecycle writes, and usage writes currently remain CLI/MCP operations. The HTTP API exposes their read-only Activity projection. Write parity will be added through `StacksApplication` before the remote endpoint mode ships.
