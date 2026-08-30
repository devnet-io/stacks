# Roadmap

## Milestone 0: executable design spike (this archive)

- Canonical concepts and boundaries documented.
- JSON manifest and event schemas drafted.
- Core manifest/context/event/status functions prototyped.
- CLI and MCP surfaces sketched as real code.
- Example foundational stack included.
- Agent Skill included and validated.

Exit condition: Codex has enough concrete material to evaluate behavior instead of designing from a blank page.

## Milestone 1: usable local Stack

Build and harden:

- `init`, `validate`, `status`, `sync`, `lock`, `context`;
- path and Git source support;
- deterministic context plans with safe roots;
- JSONL session/check-in/usage lifecycle with concurrency tests;
- stable JSON output contracts;
- MCP stdio resources/tools;
- end-to-end example and installation docs;
- Windows/macOS/Linux-compatible path/process behavior.
- immutable Stack identity plus readable namespace;
- npm workspace packaging and a three-operating-system CI matrix;
- first local web documentation/control-plane slice.

Exit condition: the user can declare the first real stack, open any target with Codex, resolve applicable context, work, and see activity/usage across the stack.

## Milestone 2: portable application boundary and live local control plane

Add:

- transport-neutral Stack references and portable resource addresses;
- storage/content/event ports with Node filesystem implementations;
- installed `stacks ui` command and local HTTP API;
- live component overview, graph, status, context, activity, usage, and documentation;
- stable versioned CLI, HTTP, and MCP contracts.
- machine-level catalog, explicit component bindings, one global UI selector, and one global stdio MCP adapter.

Exit condition: the CLI, local web UI, and MCP use the same application services, and pure graph/context selection has no Node filesystem dependency.

## Milestone 3: self-describing components and ingestion proposals

Add:

- optional `.stack/component.json` published by reusable components;
- stack-level overlays with explicit precedence;
- ingestion source registry;
- read-only acquisition and inventory;
- observation and adoption-proposal schemas;
- approval/disposition records;
- provenance links to resulting commits/docs;
- a simple activity/usage report command.

Exit condition: a reference project can be safely inspected and produce reviewable target-specific improvement proposals.

## Milestone 4: bounded context materialization

Add:

- byte/token budgets;
- glob expansion under verified roots;
- Markdown/source chunking with provenance;
- deterministic selectors and optional semantic ranking within authorized exports;
- cached local index, potentially SQLite/FTS;
- generated agent briefings and component instruction overlays.

Exit condition: agents receive useful task-specific context at controlled size, with clear omissions and reasons.

## Milestone 5: ecosystem/layout adapters

Add only from real demand:

- npm/pnpm workspace adapter;
- monorepo component/path adapter;
- remote-document/reference adapter;
- package/build metadata discovery;
- hardware/Verilog-friendly examples;
- optional Git submodule adapter for stacks that explicitly need it.

Exit condition: the core graph remains stable while multiple physical layouts are supported.

## Milestone 6: optional hosted Stacks access

Expose independently of Vaultar:

- stable Stack/component IDs;
- signed/sanitized event export;
- remote status and context APIs;
- authenticated hosted Stack snapshots and documentation;
- Streamable HTTP MCP scoped to authorized Stacks;
- optional mapping from Vaultar work to Stack sessions/components;
- usage rollups and runner provenance.

Exit condition: people and remote agent clients can inspect authorized Stacks without making hosted storage canonical, and Vaultar may integrate without subsuming the local model.

## Sequencing rule

Do not begin a milestone because it is architecturally interesting. Begin it when the preceding milestone is exercised by a real stack and the missing capability creates measurable friction.

## Active implementation sequence

This is the agreed delivery order after the first global catalog, UI, and MCP slices were exercised:

### Immediate local MVP gate

Before expanding into component descriptors, remote transports, collections, or ingestion, the copied installation must support one reliable loop: create a Stack, attach existing component directories, inspect and manage it in the global UI, activate a component's `AGENTS.md`, restart/connect an agent client, discover membership through MCP, resolve context, and record work. `npm run check` must verify the packed CLI, MCP tool/resource contract, and web runtime. Friction in this loop takes priority over later milestones.

1. Finish global CLI migration. Global commands use the machine catalog; single-Stack commands require `--stack`; directory manifests are reached only through explicit legacy `--root` or `init` behavior.
2. Establish one `StacksApplication` use-case boundary and move CLI, MCP, and HTTP orchestration behind it. Keep an in-process implementation as the default.
3. Complete write-operation parity for Stack/component management through the application boundary, versioned HTTP API, CLI, MCP, and full UI editing slices. Membership discovery and local add/bind parity are complete; capability and guidance editing remains.
4. **Complete:** add opt-in agent activation. The adapter manages only a delimited Stacks block in `AGENTS.md`, with print/check/install/remove modes; it preserves user-owned instructions and uses membership discovery rather than hard-coding one Stack.
5. Define the provider-owned self-description contract for capabilities and bounded resource exports, while keeping consumer relationships in the Stack definition. Record the context-precedence decision in an ADR.
6. Add remote transports together: an HTTP application client plus global `--endpoint` and `STACKS_ENDPOINT` selection for the CLI, and a Streamable HTTP MCP endpoint backed by the same `StacksApplication` and authentication boundary. Local in-process CLI execution and local stdio MCP remain the defaults; `stacks mcp --endpoint` may bridge stdio-only clients to a remote application. Non-loopback exposure requires authentication.
7. Define a portable Stack collection format. A collection versions Stack definitions but excludes machine bindings, credentials, caches, and local activity state.
8. Implement generic Git-backed collection add, list, sync, remove, and explicit publish workflows using existing Git authentication.
9. Build the Collections admin section as a complete vertical slice, including divergence and conflict states.
10. Add optional GitHub conveniences—OAuth or GitHub App connection, repository selection/creation, permissions, and pull-request publishing—without embedding GitHub in the core model.

Each numbered item must update tests, schemas, interface references, current architecture, and project status in the same change. The REST and MCP HTTP surfaces share application semantics, service origin, Stack authorization, and credential policy rather than becoming separate hosted systems. Generic Git collections precede GitHub-specific integration.
