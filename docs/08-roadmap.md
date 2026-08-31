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

## Milestone 3: dependable MVP agent workflow

Complete the proposed [MVP agent workflow](11-mvp-agent-workflow-vision.md) with the smallest explicit mechanisms:

- authorable capability providers, consumer relationships, guidance, and bounded resource exports through shared application adapters;
- distinct session-orientation, compact turn-refresh, and on-demand context products;
- deterministic task-sensitive selection before optional semantic ranking;
- hard byte budgets, safe file materialization, provenance, omissions, and a stable context-plan revision or digest;
- append-only cross-component capability requests with provider completion and separate consumer verification;
- full CLI, MCP, HTTP, Activity, and Manage UI slices for the implemented operations;
- one exercised three-component Stack using curated Markdown indexes and explicit declarations.

Exit condition: an activated product agent can discover its Stack, receive a bounded briefing, reuse an authoritative UI capability, record a missing capability request, observe provider completion, verify it, and resume—without Stacks assigning or scheduling agents.

## Milestone 4: self-description, ingestion, and richer retrieval

Add after the explicit MVP workflow is proven:

- optional `.stack/component.json` published by reusable components;
- stack-level overlays with explicit precedence;
- ingestion source registry, read-only acquisition, and inventory;
- observation and adoption-proposal schemas with approval/disposition records;
- provenance links to resulting commits/docs;
- glob expansion and Markdown/source chunking within authorized exports;
- optional semantic ranking and a cached local index, potentially SQLite/FTS.

Exit condition: reusable components can safely publish bounded descriptions, and a reference project can produce reviewable target-specific proposals without changing canonical targets automatically.

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

1. **Complete:** global CLI migration. Global commands use the machine catalog; single-Stack commands require `--stack`; directory manifests are reached only through explicit legacy `--root` or `init` behavior.
2. **Complete:** establish one `StacksApplication` use-case boundary for CLI, MCP, and HTTP orchestration, with an in-process implementation as the default.
3. Complete write-operation parity for Stack/component management through the application boundary, versioned HTTP API, CLI, MCP, and full UI editing slices. Creation, membership discovery, local add/bind, and minimum context-graph authoring are complete; removal and richer multi-path editing remain.
4. **Complete:** add opt-in agent activation. The adapter manages only a delimited Stacks block in `AGENTS.md`, with print/check/install/remove modes; it preserves user-owned instructions and uses membership discovery rather than hard-coding one Stack.
5. **Complete:** make turns first-class protocol boundaries. `turn_start` returns the current context plan, `turn_complete` records progress and known live telemetry under the same turn identity, and delayed measurements use `usage_import`. Exact plan identity and briefing materialization remain later steps.
6. **Complete:** add capability, authoritative-provider, guidance, and single bounded-resource-path authoring through the application boundary and a complete Manage slice. Explicit Stack declarations precede provider self-description.
7. Build the minimum dependable briefing: session orientation and compact turn refresh, deterministic task-sensitive selection, hard byte budgets, safe excerpts, provenance, explicit omissions, and a durable plan revision or digest.
8. Add cross-component capability requests as a complete vertical slice: create, list, inspect, transition, provider-complete, consumer-verify, and link blocked work through append-only events. Stacks records the protocol but never assigns agents or schedules execution.
9. Exercise the complete [three-component MVP workflow](11-mvp-agent-workflow-vision.md) through a copied installation and real agent activation before expanding the platform boundary.
10. Define optional provider-owned self-description for capabilities and bounded exports, with consumer relationships remaining in the Stack definition and precedence recorded in an ADR.
11. Add remote transports together: an HTTP application client plus global `--endpoint` and `STACKS_ENDPOINT` selection for the CLI, and a Streamable HTTP MCP endpoint backed by the same `StacksApplication` and authentication boundary. Local in-process CLI execution and local stdio MCP remain the defaults; `stacks mcp --endpoint` may bridge stdio-only clients to a remote application. Non-loopback exposure requires authentication.
12. Define and implement a portable, generic Git-backed Stack collection format and explicit add/list/sync/remove/publish workflows. Collections exclude machine bindings, credentials, caches, and local activity state.
13. Build the Collections admin section as a complete vertical slice, including divergence and conflict states.
14. Add optional GitHub conveniences—OAuth or GitHub App connection, repository selection/creation, permissions, and pull-request publishing—without embedding GitHub in the core model.

Each numbered item must update tests, schemas, interface references, current architecture, and project status in the same change. The REST and MCP HTTP surfaces share application semantics, service origin, Stack authorization, and credential policy rather than becoming separate hosted systems. Generic Git collections precede GitHub-specific integration.
