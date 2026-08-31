# ADR 0009: Management mutations are activity events

Status: accepted

## Context

The Activity view originally projected only agent work and usage events. A component could therefore be added or rebound successfully through the CLI, web UI, or MCP while the Stack timeline remained unchanged. That made the durable history incomplete and made it difficult for a human to understand how the current Stack definition arose.

## Decision

The shared application use-case boundary appends an event after each successful registered Stack creation, component addition, or changed component binding. The event types are `stack.created`, `component.added`, and `component.binding.changed`. A binding request that leaves the path unchanged does not append a duplicate event.

CLI, web, and MCP adapters identify themselves through the event actor's `client` field. The application boundary owns this behavior so every adapter receives the same semantics; lower-level catalog functions remain free of implicit event writes. Read-only operations never append events, and management events never write to component repositories.

Events are appended only after the canonical catalog mutation commits. Stacks does not invent events for operations performed before this decision, and it does not infer history from the current definition. If the subsequent event append fails, the mutation error is surfaced; because the catalog may already contain the requested change, callers must inspect current state before retrying.

## Consequences

- Activity records new human and agent management changes alongside work sessions and usage.
- Adapter provenance distinguishes CLI, web, and MCP operations without making those adapters part of the core domain model.
- Historical timelines remain honest rather than being backfilled with guessed timestamps or actors.
- The catalog and append-only event file are not a distributed transaction; a rare post-commit append failure is explicit and recoverable through inspection rather than hidden.
