# Vision and boundaries

## Vision

Stacks should make an agent entering a local development environment immediately able to answer:

1. What body of work am I operating inside?
2. Which component am I changing?
3. What does that component consume, and who provides it?
4. Which standards, preferences, examples, and usage guides apply?
5. What else is being changed across the stack?
6. What did prior agents do, decide, and spend?
7. What external references have been considered, adopted, rejected, or deferred?

The system should remain inspectable without a server. A person should be able to inspect readable definitions, keep component repositories in ordinary locations, run explicit CLI operations, and understand the composed system.

People also need a coherent local control plane. The local web UI presents component relationships, status, selected context, activity, usage, and the Stack's canonical documentation. It is an adapter over the same application behavior as CLI and MCP, not a second source of truth.

## Product principles

### Declarative before imperative

The manifest describes components, relationships, and context. Adapters perform bounded operations such as clone, fetch, status, and event append. Avoid hiding orchestration inside declarations.

### Knowledge and code are both components

A standards repository, UI library, CI reference, product, and Verilog core can all participate. Their capabilities and context exports differ, but the composition semantics do not.

### Explain every selection

When context is resolved, every selected item has a reason: stack-wide guidance, target-local instruction, explicit dependency, or capability consumption. “The embedding search thought this looked useful” may become an additional ranking signal later, never the only explanation.

### Local-first does not mean local-only

The canonical representation is portable. An optional hosted Stacks service may later expose authorized snapshots, documentation, and remote MCP independently of agent orchestration, but a hosted dependency is not required for basic operation.

### Evolution is reviewable

Ingestion and learning produce proposals with evidence. A stack changes through ordinary diffs and component commits, not an invisible background memory.

## Explicit non-goals

Stacks is not initially:

- an agent runtime;
- a hierarchical planner;
- a project-management database;
- a replacement for Git, npm, pnpm, Cargo, Bazel, CI, or deployment tooling;
- a monorepo system;
- a code search engine;
- a vector database;
- a cloud runner manager;
- an autonomous framework for propagating changes across all repositories;
- Vaultar.

## Relationship to Vaultar

Vaultar is a separate system for structured agent orchestration concepts such as work units, plans, actions, runner sessions, acceptance criteria, and human validation.

Stacks should expose enough stable identity and events for Vaultar to reference:

- stack and component IDs;
- repository and revision status;
- context plans;
- agent session and usage events;
- ingestion/adoption provenance.

The integration direction should be “Vaultar operates against one or more Stacks,” not “Stacks gradually reimplements Vaultar.” Hosted Stacks access remains independently useful for people and non-orchestrating agent clients.
