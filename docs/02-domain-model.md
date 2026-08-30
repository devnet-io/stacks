# Domain model

## Core graph

```text
Stack
  | contains
  v
Component ---------------------> Source
  | provides                       | git | path | url (future)
  v
CapabilityExport
  ^
  | satisfies
CapabilityRequirement <-------- Component

Stack / Component
  | declares
  v
Guidance + ContextPath

Agent session
  | appends
  v
Event stream -----> Usage report / activity report / later indexes

Ingestion source
  | produces observations
  v
Adoption proposal -----> target component changes + provenance
```

## Stack

A named, versioned composition registered by immutable ID and readable `namespace/name`. It owns:

- a readable graph definition and local operational state identity;
- stack-wide context;
- component declarations and overlays;
- optional lock snapshots;
- stack-owned decisions and ingestion proposals.

It does not own the contents of every component repository.

## Component

The generic member of a stack. `kind` is intentionally extensible; common values may include:

- `product`
- `library`
- `knowledge`
- `reference`
- `tool`
- `platform`
- `hardware`

A component has a source, access policy, capabilities, requirements, explicit dependencies, and guidance. “Project” can be a user-facing synonym when the member is an independently developed codebase, but the core term stays broader.

## Source

The provenance/materialization strategy for a component. Every registered component also has a separate explicit machine-local path binding.

Initial source types:

- `local`: available at its explicit registered binding;
- `git`: clone or inspect at its explicit registered binding, optionally tracking a ref;
- `path`: legacy relative path inside a directory-based manifest.

Future types may include remote documents, package registries, generated components, and externally managed worktrees.

## Capability export

A namespaced assertion that a component provides something others may consume, for example:

- `practice.software-development`
- `ui.react.primitives`
- `ui.react.application-patterns`
- `platform.cloudflare.worker-patterns`
- `hardware.riscv.core`

An export may identify the context paths that explain how to consume it. Capability names describe meaning; package coordinates and build dependencies remain component-specific facts.

## Capability requirement

A component’s declaration that it consumes a capability. It may name an explicit provider. Without an explicit provider, exactly one matching provider must exist or context resolution reports ambiguity.

Requirements are not package-manager dependencies. They exist to compose knowledge and intent and may mirror a real package dependency without replacing it.

## Guidance

A path plus intent and strength:

- `required`: a constraint the agent must honor;
- `preferred`: a convention to follow unless a documented reason prevents it;
- `reference`: helpful material, examples, or implementation background.

Guidance can be stack-wide, component-local, or attached to a capability export.

## Context plan

A deterministic explanation of what an agent should inspect for a target. It contains descriptors, not necessarily the file contents:

- owning component;
- path or glob;
- strength and priority;
- selection reason;
- capability/dependency chain;
- estimated bytes when cheaply available;
- warnings and unresolved requirements.

A later materializer may read and rank contents under a hard budget.

## Agent session and events

A session represents one agent/client working against one or more components for an optional external work identifier. Events are immutable facts such as:

- `work.started`
- `turn.completed`
- `work.completed`
- `usage.recorded`
- `decision.recorded`
- `ingestion.registered`
- `adoption.proposed`
- `adoption.approved`
- `adoption.applied`

The initial implementation focuses on the first four.

## Ingestion source, observation, and adoption proposal

An ingestion source is a reference under consideration. Inspection produces evidence-backed observations. An adoption proposal maps selected observations to candidate target changes, including rationale, evidence, target policies, and disposition.

This separation prevents a discovered repository from becoming an implicit authority over the stack.

## Identity

A Stack has an immutable opaque `metadata.id` plus the readable `metadata.namespace/metadata.name` address. Component IDs are stable within a Stack, so a portable component address is Stack ID plus component ID. Do not derive identity solely from mutable paths, names, or URLs. Event IDs and session IDs use UUIDs initially.
