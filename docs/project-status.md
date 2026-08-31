# Stacks project status

Do not infer completion from product documentation or accepted RFCs. This ledger records evidence from the current checkout.

## Implemented locally

| Area | Evidence |
| --- | --- |
| Manifest and context spike | Existing unit tests validate manifests and resolve layered capability context. |
| Conservative Git operations | Temporary-repository integration test covers clone, fetch, dirty preservation, and lock observation. |
| Stack, agent, turn, and usage events | Application, HTTP, lifecycle, and aggregation tests cover Stack creation, component addition and rebinding, work sessions, first-class turn starts/completions, turn-linked live telemetry, delayed usage imports, and work completion with adapter provenance. Turn start returns a context plan but durably records only its generation time and aggregate counts. |
| Foundation example | Example test verifies declared context paths and deterministic capability-based selection. It does not materialize a briefing. |
| npm workspace and copied installation | Root workspaces include local web and reserved cloud applications. `install:local` gracefully retires registered UI processes, then packs and globally installs a copied CLI plus static web artifact; the quality gate verifies an isolated non-symlink installation and starts its unified UI/API process. |
| Stable Stack identity | Manifests require immutable ID, namespace, and name; events and plans use the immutable ID. |
| Documentation truth model | Product, current architecture, user guide, RFC, decision, archive, and status sources are distinct. `docs/catalog.json` is the shared lifecycle/navigation registry; `npm run docs:check` rejects uncataloged or missing documents, duplicate metadata, invalid lifecycle values, and broken relative Markdown links. |
| Local documentation UI | `apps/web` auto-discovers all `docs/**/*.md` sources, consumes the canonical lifecycle catalog, warns on proposed/decision/archive material, groups by truth type, nests selected-document headings in the same sidebar, preserves repository-relative document links, and supports stable URL deep links. |
| Admin Overview vertical slice | Shared overview DTO, versioned loopback HTTP endpoint, `stacks ui` launcher, live component/workspace UI states, and HTTP integration tests are implemented. |
| Admin documentation and Tools & agents vertical slice | Plain-language getting-started guide, grouped searchable full-library navigation, document/heading deep links, shared integration DTO, versioned HTTP endpoint/schema, Stack-specific Codex setup, hosted metadata boundary, UI states, and integration tests are implemented. Installation is documented separately from runtime connection settings. |
| Admin Graph vertical slice | Deterministic provider/dependency DTO, unresolved-requirement evidence, versioned HTTP endpoint/schema, searchable accessible SVG, detail states, and focused tests are implemented. |
| Versioned CLI JSON contracts | A subprocess integration test covers init, validate, status, dry-run sync, lock, context, work and turn check-ins, turn-linked usage, work completion, and reporting. |
| Cross-platform CI | The same install and check gate passes on GitHub-hosted Windows, macOS, and Linux runners. |
| Container quality gate | `Dockerfile.quality` runs the complete gate in a clean Node 22 Linux image through `npm run check:docker`. |
| Global Stack catalog | Readable definitions, lowercase platform config/state locations, stable identity, explicit machine-local component bindings, safe cross-process mutation, and multi-Stack directory membership discovery are implemented and tested. |
| Global UI shell and selection | One Node process serves the static Vite UI and same-origin API, preferring port 3210 with automatic fallback. `/api/v0.1/stacks` discovery, query-scoped endpoints, empty state, a subdued selector above navigation, and a version/settings menu replace per-directory UI processes. Version-aware reuse and authenticated runtime registration prevent stale servers after installation. |
| Global stdio MCP | One `stacks mcp` registration discovers workspace memberships; lists, inspects, adds, and binds local components; and exposes the work/turn lifecycle. `turn_start` returns context, `turn_complete` accepts known live telemetry, and `usage_import` is reserved for delayed measurements. Every selected-Stack tool requires a selector, Git cloning stays CLI-only, and source plus packed-install transport checks compare actual tools/resources with the canonical catalog. `stacks doctor` reports the installed contract and the agent-client restart boundary. |
| Repository agent activation | `stacks agent print/check/install/remove` safely manages one delimited Stacks block in `AGENTS.md`, preserves user instructions and line endings, refuses symlinks or malformed markers, and discovers Stack membership at agent runtime. Tools & agents publishes the install/check commands. |
| Human and agent interface references | The web documentation library includes exhaustive CLI and MCP references. MCP initialization instructions, `instructions_get`, and packaged `stacks://instructions`, `stacks://reference/mcp`, and `stacks://reference/cli` resources expose the same operational truth to agents. |
| Application use-case boundary | CLI, stdio MCP, and loopback HTTP orchestration use the `StacksApplication` interface with an in-process local implementation. Global `status` reads the catalog; other commands enter directory compatibility mode only through explicit `--root`. ADR 0007 records optional REST-client and Streamable HTTP MCP direction. |
| Admin Manage vertical slice | The loopback API and UI create registered Stacks, add components at explicit paths, and change machine-local bindings. Mutations require JSON, enforce browser origin restrictions, report conflict/input states, and use cross-process catalog writer serialization with reader-safe commit ordering. |
| Admin Activity vertical slice | Per-Stack cross-process writer serialization protects append-only JSONL events. Registered Stack creation, component addition, and changed bindings are recorded by the shared application boundary with CLI/web/MCP provenance. A bounded application DTO, versioned HTTP endpoint/schema, management and session timeline, provenance-preserving usage aggregation, responsive loading/empty/error/success UI, and concurrency/integration tests are implemented. |

## Proposed

- Hosted Stack snapshots, web access, and authenticated Streamable HTTP MCP.
- Authorable capability relationships, guidance, and bounded resource exports through the shared application adapters and Manage UI.
- Session-orientation and turn-refresh briefings with deterministic task-sensitive selection, explicit byte/token budgets, provenance, omissions, and a durable plan revision or digest.
- Append-only cross-component capability requests with provider and consumer views, evidence, blocking relationships, and consumer verification—but no agent assignment or scheduling.
- Optional provider-owned component self-description and later ingestion proposals after the explicit MVP workflow is proven.

## Current validation

The gate runs the Node test suite plus strict TypeScript checking, core compilation, the static Vite build, and an isolated copied-package UI/API startup. Catalog tests cover platform paths, readable definitions, shared component directories, and global bindings. Overview, Graph, Activity, and Tools & agents use tested loopback contracts. GitHub Actions applies the gate on Windows, macOS, and Linux; Docker adds a clean Linux run.
