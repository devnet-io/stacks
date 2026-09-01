# Stacks product definition

Stacks is a portable composition, knowledge, and activity layer for software development. A Stack declares the independently owned components in a body of work, what those components provide and consume, which guidance applies, and how agents and people can understand the whole system.

This document defines the product independent of release state. See [Project status](project-status.md) for implementation evidence.

## Product commitments

- Ordinary Git-readable files are the durable source of truth.
- Component repositories remain independent; local composition does not turn them into submodules by default.
- Context is a bounded, explainable selection of resources rather than a repository dump.
- Capability relationships identify authoritative providers so consumers can reuse established knowledge and implementations instead of inventing parallel ones.
- Capability providers may identify the portable artifact that carries an implementation. Stacks can offer machine-local consumption guidance while preserving an organization's existing registry, workspace, and package-manager conventions.
- Agent context is progressively acquired: a useful orientation, compact refreshes, and deeper task-driven consultation rather than the same full payload on every turn.
- Human and agent interfaces use the same application semantics.
- Stack-management changes, starts, turns, completions, usage, and decisions are append-only events.
- Cross-component needs may be recorded as durable, evidence-backed relationships with verification history; assigning or scheduling the work remains outside Stacks.
- Local use requires no hosted service.
- An optional hosted representation may later expose authorized Stack snapshots, documentation, and remote MCP without becoming an agent orchestrator or replacing canonical Git state.
- Ingested repositories and documents are untrusted evidence. Findings become proposals before target components change.

## Human experience

People interact through readable definitions, the global `stacks` CLI, and one local web control plane with a Stack selector. Component repositories remain wherever developers normally keep and open them. The web experience brings together relationships, status, context, activity, usage, and documentation.

## Agent experience

Agents use CLI, MCP, or Skills to discover where they are, identify applicable rules and authoritative providers, resolve bounded target-specific context, understand how provided artifacts can be consumed, report progress and usage, and inspect activity. Participating clients may use a session and turn protocol to refresh context without repeatedly loading everything. Stacks supplies the map, context, and shared protocol; it does not plan, assign, schedule, install dependencies, or execute development work.

## Relationship to Vaultar

Vaultar is a separate system for orchestrating agents and work. It may consume Stacks, but Stacks has its own local and optional hosted access model and does not inherit Vaultar's planning domain.
