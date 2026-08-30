# Current architecture

This document describes only implemented repository behavior as of the current checkout. Proposed hosted and package-boundary changes live in [RFCs](rfcs/README.md).

## Repository shape

The repository is an npm workspace. The root package currently contains the TypeScript core, CLI, and stdio MCP adapter. `apps/web` contains the first local documentation/control-plane UI. `apps/cloud` reserves a hosted adapter boundary but contains no runtime.

```text
src/core/                 current domain and local Node operations
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
- The web workspace currently renders repository documentation and a representative overview of the self-hosting Stack. It is not yet connected to live Stack application services, and `stacks ui` is not implemented.

## Portability

The implementation uses Node process and path APIs and invokes Git with argument arrays. Existing tests exercise temporary repositories on Windows. A three-operating-system CI workflow is being added; passing that workflow is required before portability is considered verified.

## Known limitations

- Runtime manifest validation and JSON Schema remain separate representations.
- JSONL appends have no cross-process locking strategy.
- Context plans expose local absolute paths and have not yet been split into portable resource references plus local evidence.
- CLI JSON contracts and MCP transport lack end-to-end contract tests.
- The local web UI is a source-development workspace rather than an installed CLI command.
