# Stacks project status

Do not infer completion from product documentation or accepted RFCs. This ledger records evidence from the current checkout.

## Implemented locally

| Area | Evidence |
| --- | --- |
| Manifest and context spike | Existing unit tests validate manifests and resolve layered capability context. |
| Conservative Git operations | Temporary-repository integration test covers clone, fetch, dirty preservation, and lock observation. |
| Agent events and usage | Lifecycle and aggregation test covers start, turn, usage, and completion. |
| Foundation example | Example test verifies materialized paths and selected context. |
| npm workspace and copied installation | Root workspaces include local web and reserved cloud applications. `install:local` gracefully retires registered UI processes, then packs and globally installs a copied CLI plus static web artifact; the quality gate verifies an isolated non-symlink installation and starts its unified UI/API process. |
| Stable Stack identity | Manifests require immutable ID, namespace, and name; events and plans use the immutable ID. |
| Documentation truth model | Product, current architecture, user guide, RFC, and status sources are distinct. |
| Local documentation UI | `apps/web` renders the canonical Markdown library. |
| Admin Overview vertical slice | Shared overview DTO, versioned loopback HTTP endpoint, `stacks ui` launcher, live component/workspace UI states, and HTTP integration tests are implemented. |
| Admin documentation and Tools & agents vertical slice | Plain-language getting-started guide, flat searchable documentation navigation, shared integration DTO, versioned HTTP endpoint/schema, Stack-specific Codex setup, hosted metadata boundary, UI states, and integration tests are implemented. Installation is documented separately from runtime connection settings. |
| Admin Graph vertical slice | Deterministic provider/dependency DTO, unresolved-requirement evidence, versioned HTTP endpoint/schema, searchable accessible SVG, detail states, and focused tests are implemented. |
| Versioned CLI JSON contracts | A subprocess integration test covers init, validate, status, dry-run sync, lock, context, check-in, usage recording, and reporting. |
| Cross-platform CI | The same install and check gate passes on GitHub-hosted Windows, macOS, and Linux runners. |
| Container quality gate | `Dockerfile.quality` runs the complete gate in a clean Node 22 Linux image through `npm run check:docker`. |
| Global Stack catalog | Readable definitions, lowercase platform config/state locations, stable identity, explicit machine-local component bindings, and identity-preserving export/register/rebind are implemented and tested. |
| Global UI shell and selection | One Node process serves the static Vite UI and same-origin API, preferring port 3210 with automatic fallback. `/api/v0.1/stacks` discovery, query-scoped endpoints, empty state, a subdued selector above navigation, and a version/settings menu replace per-directory UI processes. Version-aware reuse and authenticated runtime registration prevent stale servers after installation. |
| Global stdio MCP | One `stacks mcp` registration lists the machine catalog; every Stack-specific tool requires a selector and the transport test protects stdout. |
| Human and agent interface references | The web documentation library includes exhaustive CLI and MCP references. MCP initialization instructions, `instructions_get`, and packaged `stacks://instructions`, `stacks://reference/mcp`, and `stacks://reference/cli` resources expose the same operational truth to agents. |
| Application use-case boundary | CLI, stdio MCP, and loopback HTTP orchestration use the `StacksApplication` interface with an in-process local implementation. Global `status` reads the catalog; other commands enter directory compatibility mode only through explicit `--root`. ADR 0007 records optional REST-client and Streamable HTTP MCP direction. |
| Admin Manage vertical slice | The loopback API and UI create registered Stacks, add components at explicit paths, and change machine-local bindings. Mutations require JSON, enforce browser origin restrictions, report conflict/input states, and use cross-process catalog writer serialization with reader-safe commit ordering. |
| Admin Activity vertical slice | Per-Stack cross-process writer serialization protects append-only JSONL events. A bounded application DTO, versioned HTTP endpoint/schema, session and provenance-preserving usage aggregation, responsive loading/empty/error/success UI, and concurrency/integration tests are implemented. |

## Proposed

- Hosted Stack snapshots, web access, and authenticated Streamable HTTP MCP.
- Context materialization under explicit byte/token budgets.

## Current validation

The gate runs the Node test suite plus strict TypeScript checking, core compilation, the static Vite build, and an isolated copied-package UI/API startup. Catalog tests cover platform paths, readable definitions, shared component directories, and global bindings. Overview, Graph, Activity, and Tools & agents use tested loopback contracts. GitHub Actions applies the gate on Windows, macOS, and Linux; Docker adds a clean Linux run.
