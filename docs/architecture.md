# Current architecture

This document describes only implemented repository behavior as of the current checkout. Proposed hosted and package-boundary changes live in [RFCs](rfcs/README.md).

## Repository shape

The repository is an npm workspace. The root package currently contains the TypeScript core, CLI, and stdio MCP adapter. `apps/web` contains the first local documentation/control-plane UI. `apps/cloud` reserves a hosted adapter boundary but contains no runtime.

```text
src/core/                 current domain and local Node operations
src/application/          versioned adapter-neutral response builders
src/http/                 loopback-only local HTTP adapter
src/ui/                   local UI process launcher
src/cli.ts                CLI adapter
src/mcp/                  per-Stack stdio MCP adapter
apps/web/                 React documentation UI
apps/cloud/               documented placeholder; no service
docs/                     product, current, RFC, and status truth
examples/foundation-stack executable example Stack
```

## Current state model

`stack.json` is canonical. Path components resolve inside the Stack repository. Git components materialize as ordinary clones under `.stack-workspace/`. Local operational events live under `.stacks/`. A lock file is an observed snapshot, not an instruction to reset repositories.

The current core still uses Node filesystem operations directly in several modules. The storage-port extraction described in RFC-0001 is not implemented and must not be described as current architecture.

Every current manifest has an immutable `metadata.id` and readable `metadata.namespace` plus `metadata.name`. Events, locks, context plans, and structured status use the immutable ID; people see `namespace/name`.

## Current interfaces

- The CLI implements `init`, `validate`, `status`, `sync`, `lock`, `context`, check-ins, usage reporting, and stdio MCP startup.
- The MCP adapter is bound to one Stack root when started.
- `stacks ui` starts a Stack-scoped loopback HTTP API and the checked-in web client. The Overview section consumes the shared versioned overview contract and shows live read-only component/workspace status. The Documentation section renders canonical Markdown. Other admin sections are not implemented.

## Portability

The implementation uses Node process and path APIs and invokes Git with argument arrays. Temporary-repository tests and the same `npm run check` gate pass on Windows, macOS, and Linux in GitHub Actions.

Versioned transport DTO builders live under `src/application/`. The CLI uses them for initialization, validation, status, synchronization, and lock output; MCP reuses the same status DTO. Context plans, events, and usage reports are already versioned domain DTOs. A subprocess integration test exercises the structured CLI lifecycle and verifies that stdout remains parseable JSON.

## Known limitations

- Runtime manifest validation and JSON Schema remain separate representations.
- JSONL appends have no cross-process locking strategy.
- Context plans expose local absolute paths and have not yet been split into portable resource references plus local evidence.
- MCP lacks an end-to-end client/server transport test.
- The UI launcher currently locates the checked-in web workspace; npm publication and a self-contained packaged web artifact are not implemented.
