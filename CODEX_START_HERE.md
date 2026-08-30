# Codex: start here

You are taking over the first implementation of **Stacks**.

## Product statement

Stacks is a local-first workspace and knowledge composition layer for agent-assisted development. It declares a graph of independently versioned components—products, libraries, standards, reference implementations, tools, and eventually lower-level engineering layers—and makes their relationships useful to agents.

A stack can say, for example:

- `product` consumes `ui.react.application-patterns` from `ui-patterns`;
- `ui-patterns` consumes `ui.react.primitives` from `ui-primitives`;
- every component consumes development standards from `standards`;
- a Cloudflare reference component provides known-good Worker, D1, and CI/CD patterns;
- agents working on a target should read the exact exported context associated with those capabilities;
- every agent reports work start, turn completion, work completion, token usage, and cost when available.

The deeper purpose is to maintain an evolving, inspectable “view of the world” about how software should be built, not merely to clone multiple repositories.

## What already exists in this starter

The repository contains a narrow vertical slice:

- manifest loading and structural validation;
- component path resolution;
- capability/provider context planning;
- Git status, safe cloning, and fetching;
- lock snapshot generation;
- append-only JSONL events;
- usage aggregation;
- a CLI;
- an MCP stdio adapter;
- an example stack;
- tests for the core semantics;
- an optional agent Skill.
- an npm workspace with a first local documentation UI and a reserved, non-implemented hosted adapter boundary.

Treat the code as executable design material. Improve it rather than preserving weak details for compatibility.

## First assignment

Complete **Milestone 1** in `docs/08-roadmap.md` and leave the repository in a state where a real first stack can be declared and used by Codex locally.

### Required acceptance criteria

1. `stacks init`, `validate`, `status`, `sync`, `lock`, and `context` work on macOS, Linux, and Windows-compatible Node APIs.
2. A Git component can be cloned into `.stack-workspace/<id>` without becoming a Git submodule.
3. Existing dirty repositories are never reset, overwritten, or silently moved.
4. Context resolution is deterministic, explains why every item was selected, detects ambiguous capability providers, and never reads outside allowed roots.
5. An agent can create a session, append turn summaries, complete work, record usage, and produce a usage report.
6. MCP exposes the read operations and check-in protocol over stdio using the current v2 TypeScript SDK.
7. `--json` output has documented, test-covered shapes.
8. The example foundational stack demonstrates standards -> UI primitives -> UI patterns -> product layering plus an infrastructure reference component.
9. Immutable Stack identity and readable namespace are used consistently across manifests, events, plans, and adapters.
10. Windows, macOS, and Linux run the same check in CI.
11. The local web workspace renders canonical product, current-state, guide, RFC, and status documentation without duplicating it.
12. `npm run check` passes and the README five-minute path is based on an actual test.

## Recommended implementation order

1. Harden manifest parsing and schema parity. Decide whether YAML is accepted in Milestone 1; JSON must remain canonical and fully supported.
2. Replace ad hoc validation with a single schema-derived path if that reduces duplication without making runtime errors worse.
3. Add temp-repository integration tests for `status`, `sync`, and `lock`.
4. Make event/session concurrency explicit. An event append must be atomic enough for multiple local agents.
5. Add MCP server tests using an in-memory client or the official inspector-compatible transport.
6. Test the full example as an end-to-end scenario.
7. Only then begin the ingestion proposal model.

## Do not do these yet

- Do not add hosted synchronization or a cloud database before the portable application/storage boundary is implemented and exercised locally.
- Keep the local web UI focused on real Stack management and canonical documentation; do not build a separate content system.
- Do not embed an LLM call in the core.
- Do not design a generalized job/plan/action model; agent orchestration belongs with Vaultar or another orchestrator.
- Do not build a package manager or custom build graph.
- Do not implement automatic cross-repository refactors from ingested references.
- Do not introduce a vector database before deterministic file/context semantics work.
- Do not create a broad plugin marketplace architecture.

## Questions to resolve through code and ADRs

- Should component self-description live in an optional `.stack/component.json`, with stack-level overlays?
- Should `stack.lock.json` pin active-development components or only immutable/reference components?
- What event identity and file-locking strategy is reliable across supported platforms?
- How should secrets and per-machine repository URLs be overlaid without polluting the portable manifest?
- What is the smallest useful ingestion proposal schema?

## Initial Codex prompt

Use this verbatim after opening the repository:

> Read `AGENTS.md`, `CODEX_START_HERE.md`, `docs/README.md`, and every current or relevant RFC document under `docs/` except `docs/research-notes.md`. Run the existing tests and exercise the example stack. Then implement Milestone 1 as a sequence of small, tested changes. Preserve the product boundary: Stacks is a portable composition/context/event layer, not an agent orchestrator. Before coding, write a concise gap analysis against the acceptance criteria in `CODEX_START_HERE.md`; then begin with the highest-leverage failing criterion. Do not merely produce a plan—make the changes, run the checks, and update current documentation and project status with what remains.
