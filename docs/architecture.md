# Current architecture

This document describes implemented behavior in this checkout. Hosted direction belongs in [RFCs](rfcs/README.md).

No compatibility milestone has been declared. Unused command and adapter surfaces may therefore be removed instead of retained as legacy workflow. Durable definitions, bindings, and events remain protected: incompatible stored data must be migrated explicitly or rejected with a clear error, never silently rewritten, corrupted, or discarded.

## Repository shape

The npm workspace contains a TypeScript core, CLI, stdio MCP adapter, loopback HTTP adapter, repository-agent-instruction adapter, and React local UI. `apps/cloud` is only a reserved future boundary.

```text
src/core/          domain, catalog, filesystem, Git, context, and events
src/application/   StacksApplication use cases and versioned adapter-neutral responses
src/http/          loopback local API
src/ui/            UI launcher
src/cli.ts         human and automation CLI
src/mcp/           global stdio MCP adapter
src/agent/         bounded repository instruction adapters
apps/web/          local management and documentation UI
apps/cloud/        placeholder only
```

## Global catalog

New Stacks are registered by immutable ID and readable `namespace/name`. The catalog stores readable Stack definitions and machine-local component path bindings in the platform config directory, and append-only events, locks, and other operational state in the platform state directory.

Definitions and bindings are ordinary JSON. SQLite and hosted storage are not canonical. Linux uses XDG config/state conventions; macOS and Windows use native application-data locations, always with lowercase `stacks`.

A registered definition does not imply a Stack workspace directory. Every component has an explicit local binding. A Git URL describes source provenance while its binding describes where that repository lives on this machine. Multiple Stacks may bind the same directory. Stacks writes no membership marker into a component repository.

The `workspace`, relative `path` source, `stacks init`, and `--root` surfaces remain implemented for the repository's older examples and migration compatibility.

## Component and context model

Components are ordinary graph nodes. Software, standards, design systems, infrastructure references, and documentation may all be components; `kind` describes intent but does not create a second storage hierarchy. Components provide capabilities, consume capabilities, depend on other components, and export bounded context resources.

Directory membership is derived from explicit machine bindings. A queried path matches a component when it is the bound root or lies beneath it. Discovery returns every match because one directory may participate in multiple Stacks; it never relies on repository names or ownership markers. New components persist the neutral `component` kind when no optional kind is supplied, while capabilities remain the functional contract.

Repository activation is opt-in. `stacks agent install` manages only a uniquely marked block inside a regular, non-symlinked `AGENTS.md`, preserves all other content and line endings, writes atomically, and refuses malformed markers. The managed instructions perform membership discovery at runtime instead of embedding a Stack identity. Print and check are read-only; remove deletes only the managed block.

Context resolution is deterministic and provenance-rich. It verifies file-backed paths against the owning component root and reports missing or ambiguous providers. The current resolver plans context; explicit byte/token enforcement remains unfinished.

## Adapters

- CLI, MCP, and HTTP handlers call one `StacksApplication` interface. `LocalStacksApplication` is the implemented in-process adapter over the catalog, filesystem, Git, context, and event modules. No local daemon is required.
- `stacks status` without a selector inspects every registered Stack. Commands that require one Stack select it with `--stack namespace/name`; the current directory is never an implicit Stack. Compatibility manifests require explicit `--root` (or the explicitly legacy `init` command).
- `stacks ui` starts one Node loopback server that serves both the packaged static Vite application and `/api/v0.1/*`. It prefers port 3210, selects the next free port when necessary, and needs no API-origin query parameter or separate web runtime. The UI calls `/api/v0.1/stacks`, then supplies a Stack selector above the sidebar navigation to Overview, Graph, Activity, and Integrations. The bottom application menu exposes the root package version and reserves a stable location for later account/settings surfaces.
- `stacks mcp` is one machine-catalog stdio adapter. It supplies standard initialization instructions, agent-readable instruction/CLI/MCP resources, and an `instructions_get` discovery tool. Stack-specific MCP tools require `stack`; there is no local MCP port.
- Directory-scoped HTTP/UI and CLI behavior is retained only when an explicit legacy `--root` is supplied.

An HTTP implementation of `StacksApplication`, global CLI endpoint selection, and Streamable HTTP MCP are accepted direction in ADR 0007 but are not implemented. The intended remote service shares one origin and authentication boundary for the web UI, REST application API, and MCP. Local CLI and stdio MCP remain the defaults.

The loopback API exposes read-only Overview, Graph, Activity, Integrations, catalog, and health routes plus JSON-only mutations for Stack creation, component addition, and component rebinding. Browser mutations reject non-loopback origins. Catalog writers acquire a cross-process lock; new Stack files are committed before the catalog entry, and new component bindings are committed before the component definition, so lock-free readers do not observe partial reachable state. Overview reports live status, Graph renders the declarative provider/dependency relationships, Activity presents bounded recent events plus full-history session and usage aggregates, Manage exposes the implemented catalog mutations, and Tools & agents presents MCP plus repository-activation settings. Documentation auto-discovers every repository Markdown file under `docs/`, reads navigation and lifecycle metadata from `docs/catalog.json`, exposes non-current warnings, nested heading navigation, and stable `view`, `document`, and `heading` query-parameter deep links, and intercepts repository-relative document links without maintaining a second prose copy. `npm run docs:check` requires every Markdown file to have unique lifecycle metadata and rejects missing files or broken relative Markdown links.

The root npm package version is the shared product version for CLI output, UI display, health responses, and integration metadata. Running UI processes register PID/origin/version plus a random control token under the platform state directory. `install:local` uses the authenticated loopback shutdown endpoint to retire registered processes before replacing the copied package. Version-aware UI reuse prevents a newly installed CLI from attaching to an older healthy server.

## Events and safety

Work starts, completed turns, work completion, and usage are append-only JSONL events under a registered Stack's state directory. Independent processes serialize appends through a per-Stack exclusive lock and sync each record before releasing it; readers never acquire the writer lock. A lock timeout fails with its exact path instead of deleting a possibly live lock. Monetary values require `reported`, `estimated`, or `allocated` provenance. Read commands never mutate component repositories. Git sync may clone to an explicit path or fetch with `--update`, but never resets, cleans, merges, rebases, overwrites dirty work, or silently moves a repository.
