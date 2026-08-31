# MVP agent workflow vision

This document captures an illustrative target workflow for Stacks. It refines the product vision but does not claim that every behavior is implemented. See [Project status](project-status.md) for delivery evidence.

## Purpose

Stacks should give an agent a dependable understanding of the larger system around the repository where it is working. The Stack is not embedded inside the product and does not control the development process. It is the composition, knowledge-routing, and coordination layer that tells the agent:

- where it is in the Stack;
- which guidance applies now;
- which related components are authoritative for particular capabilities;
- which reusable capabilities already exist;
- and which cross-component needs or decisions are currently unresolved.

The agent remains responsible for planning and implementation. Stacks supplies the map, bounded context, and shared protocol.

## Example Stack

The minimum useful example has three independently owned components.

### Knowledge component

A knowledge-oriented repository contains mostly Markdown guidance for humans and agents. It may include engineering rules, product-development preferences, testing expectations, security constraints, and instructions for how agents should work.

Not all guidance has the same delivery cadence:

- **Session-start guidance** gives an agent enough orientation to understand the Stack, its role, and the major authorities before substantial work begins.
- **Turn-refresh guidance** contains a small set of critical rules that should be refreshed on every agent turn when the client supports that behavior.
- **On-demand guidance** remains discoverable and is selected when the task, capability, changed paths, or agent judgment makes it relevant.

These categories describe intended behavior, not three separate repository types. Guidance remains readable ordinary files with provenance, priority, and explicit selection reasons. Stacks should avoid repeatedly loading large documents merely because a small rule must stay salient.

### UI capability component

A React component-library repository provides reusable interface capabilities such as buttons, panels, cards, dropdowns, inputs, dialogs, and larger compositions such as paged data lists.

The library should expose enough bounded guidance for a consumer to determine what exists and how to use it. For an MVP, that could be a maintained Markdown index rather than a specialized registry. Repository-local instructions may require agents working on the library to keep the index accurate as components change.

The important Stack-level fact is not the index format. It is that the UI repository is declared as the authority for specified UI capabilities and exports the index, usage guidance, or selected source paths as context for consumers.

### Product component

A product repository or product monorepo implements an application, such as an interactive platform for searching government contract opportunities. It is an independently owned component with an explicit local binding and declared relationships to the knowledge and UI components.

The product does not contain or own the Stack. When an agent works inside the product, it discovers that the directory belongs to a Stack and uses the Stack to understand the broader environment in which the product is developed.

## Agent operating rhythm

### At the beginning of a session

Before material work, the agent should:

1. Discover the Stack and target component from its current workspace.
2. Resolve ambiguity explicitly if the directory belongs to multiple Stacks.
3. Inspect the target component, relevant relationships, and current Stack status.
4. Load a bounded orientation briefing containing essential Stack knowledge, applicable repository rules, authoritative providers, and relevant unresolved work.
5. Record a work start when the client participates in the activity protocol, then open the first turn and retain its turn identity.

The orientation should be substantial enough to establish a correct mental model without concatenating every related repository into the prompt.

### At the beginning of a later turn

The agent should not need to reconstruct the entire Stack on every turn. It opens a first-class turn, receives the context selected for that turn, and should refresh only the compact rules and state that must remain current, such as critical constraints, changed cross-component requests, or newly available capabilities. It closes that same turn with its outcome and any telemetry it actually knows. It can retain session orientation when the client preserves conversational context and request a fuller briefing again when context is lost or the task changes materially.

Stacks should make the refresh operation deterministic and inexpensive. Whether it is initiated by a client hook, an instruction-following agent, a Skill, or an MCP call is an adapter concern rather than a core domain rule.

### While working

The agent consults additional authorized sources as the task unfolds. Stacks routes it to the relevant component and exported resources; the agent reads or searches those sources as needed. Context selection stays bounded, explains why each source was selected, and never treats unrelated repositories as an unbounded search corpus.

## Example: building an admin section

A user asks an agent working in the product repository to add an administration section.

1. The agent discovers that the product is a component of the example Stack.
2. It receives the applicable high-priority development rules from the knowledge component.
3. It sees that the UI component library is authoritative for the UI capabilities consumed by the product.
4. It consults the library's exported component index and usage guidance.
5. It selects an existing button rather than designing a parallel button.
6. It discovers a higher-level paged-data-list capability and uses that composition when it fits the requested administration experience.
7. It continues to consult more specific knowledge only when the work makes that knowledge relevant.

This is progressive context acquisition: orientation first, compact turn refreshes, and deeper consultation driven by the actual task.

## Example: a missing shared capability

During the same work, the agent determines that the clean implementation requires a dialog capability that the authoritative UI library does not provide.

The agent should not silently create a product-local substitute and should not directly mutate another component merely because that would unblock its task. Instead, it should be able to create a durable, evidence-backed request associated with:

- the requesting product component and work session;
- the capability that is missing;
- the authoritative provider expected to supply it;
- the reason it is needed and the product work it blocks;
- relevant constraints or acceptance evidence;
- and the current request state.

The original product work may pause or mark itself blocked on that request. A person, agent client, or separate orchestrator can then select the request and perform the UI-library work in the correct repository. When that work is reported complete, the product agent can inspect and verify the new capability, acknowledge that its need is satisfied, and resume.

A minimal lifecycle might distinguish requested, in progress, provider-complete, consumer-verified, rejected, and superseded states. The exact names and transition rules require design work. Corrections and transitions should be append-only events rather than silent history rewrites.

Stacks owns the durable request, relationships, evidence, and status protocol. It does not assign agents, schedule execution, decide who must perform the work, or run an autonomous dependency queue. Those responsibilities belong to people, agent clients, or an orchestrator such as Vaultar.

## MVP outcome

The MVP workflow is successful when a user can:

1. Create a Stack through the UI, CLI, or MCP.
2. Attach the knowledge, UI-library, and product repositories at explicit local paths.
3. Declare or discover the capabilities they provide and consume, the authoritative providers, and the bounded resources they export.
4. Activate an agent in the product repository so it reliably discovers Stack membership.
5. Start a session with an explainable orientation briefing and refresh critical turn guidance without reloading everything.
6. Ask for an admin section and observe the agent reuse the authoritative button and paged-data-list capabilities.
7. Record a missing dialog as a cross-component request instead of introducing an accidental parallel implementation.
8. Complete the provider work elsewhere, verify it from the consumer, resume the original work, and retain the full activity history.

The first useful version can rely on curated Markdown indexes, explicit capability declarations, and agent-initiated MCP calls. It does not require semantic search, autonomous orchestration, or a generalized plugin system.

## Design implications and open choices

This workflow sharpens several requirements without deciding their final representation:

- Guidance needs explicit refresh semantics in addition to strength and priority.
- Session orientation and per-turn refresh are different context products and should have separate budgets.
- Task text must influence selection rather than merely being recorded in a context plan.
- Component-owned indexes and exports should be easy to maintain as ordinary files.
- Capability requests need stable identity, append-only transitions, links to requesting and providing components, and evidence for verification.
- Blocking is a recorded relationship between work and an unmet need, not permission for Stacks to become a scheduler.
- The same application semantics should be available through UI, CLI, MCP, and future remote adapters.
- Client-specific hooks may improve reliability, but the core workflow must remain agent-agnostic.

The deliberately unresolved question is how much behavior belongs in deterministic Stacks context resolution versus an agent interpreting a smaller set of reliable pointers. The MVP should implement the smallest mechanism that makes the complete walkthrough dependable in a real Stack.
