# RFC-0002: First-class application HTTP API

Status: Proposed

## Summary

Treat the versioned Stacks HTTP API as a supported way for developers and automation to use Stacks, alongside the CLI, MCP, and Admin UI. The Admin UI should consume the same public application API available to external clients rather than relying on an incidental or UI-only backend surface.

This RFC extends [RFC-0001](0001-portable-runtime-and-hosted-adapters.md). RFC-0001 defines the portable application and hosted-adapter direction; this RFC defines the quality boundary for its HTTP representation.

## Problem

Stacks already exposes a versioned loopback JSON API because the local Admin UI needs one. The current surface is useful for local automation, but it is incomplete relative to `StacksApplication`, documented primarily as an implementation interface for the UI, and has no explicit long-term contract for external callers.

Allowing this surface to evolve accidentally would create several problems:

- Admin UI needs could dictate route shapes without considering other clients.
- CLI, MCP, and HTTP could drift into different application semantics.
- remote transport work could expose a local implementation detail instead of a deliberate API.
- callers would lack machine-readable discovery, consistent pagination, concurrency behavior, idempotency guidance, and a stable error model.
- internal process-management operations could be confused with supported application operations.

## Proposal

### A peer application adapter

Make HTTP a peer adapter over the same `StacksApplication` use cases as CLI, MCP, and the Admin UI. Domain behavior, validation, event semantics, authorization decisions, and filesystem safety remain in the shared application layer; route handlers only translate HTTP contracts.

The Admin UI should use this public API for application behavior. Internal runtime-control operations, including local UI shutdown, must live in an explicitly private lifecycle surface and must not be presented as general Stacks API functionality.

### A deliberate public contract

Before declaring the API stable, define and verify:

- a complete use-case parity matrix across `StacksApplication`, CLI, MCP, and HTTP, with every intentional omission explained;
- consistent resource naming, Stack selection, pagination, filtering, sorting, and timestamps;
- one structured error envelope with stable machine-readable codes and useful human messages;
- explicit idempotency and retry semantics for every mutation;
- optimistic concurrency or revision preconditions where concurrent portable-state edits could overwrite one another;
- request-size limits, bounded responses, and clear handling of truncated or omitted context;
- an authoritative machine-readable contract, expected to be OpenAPI, checked against implemented routes and examples;
- generated or contract-tested examples for curl and ordinary HTTP clients;
- a compatibility and deprecation policy appropriate to the product's eventual first stable API milestone.

The current `/api/v0.1` routes remain pre-stable implementation evidence. This proposal does not promise compatibility for unused pre-milestone shapes.

### Local and remote operation

Local API use remains available through the same loopback origin started by `stacks ui`; a separate daemon is not required merely to call HTTP. Local browser-origin protections remain in force.

Remote exposure arrives with the authenticated transport work in the roadmap and RFC-0001. The same public application contract should work locally and remotely, but transport concerns may differ:

- loopback operation can rely on local-machine trust boundaries plus origin protections;
- non-loopback operation requires authentication, Stack-scoped authorization, secure transport, audit attribution, and deployable rate/size limits;
- credentials and server lifecycle must never become fields in portable Stack definitions.

The planned `--endpoint` / `STACKS_ENDPOINT` CLI mode and Streamable HTTP MCP adapter should consume this application API rather than creating separate remote semantics.

## Non-goals

- Making hosted infrastructure mandatory for local Stacks.
- Replacing the CLI, MCP, or Admin UI.
- Exposing raw catalog, definition, binding, or event files as storage APIs.
- Turning Stacks into an agent orchestrator, package manager, or general-purpose database.
- Treating private runtime-control endpoints as public application operations.
- Freezing the existing pre-stable route layout before the contract audit is complete.

## Delivery sequence

1. Inventory `StacksApplication` use cases and the existing HTTP route/schema/reference coverage.
2. Separate public application routes from private local runtime control.
3. Choose the resource, error, pagination, idempotency, and concurrency conventions.
4. Add the machine-readable API definition and bidirectional drift checks against handlers and documentation.
5. Close intentional local API gaps required by real clients and the Admin UI.
6. Add an HTTP application client and global CLI endpoint selection.
7. Reuse the authenticated contract for Streamable HTTP MCP and later hosted access.

The local MVP remains the sequencing priority. This work should begin when a concrete API client or remote-transport slice requires the contract, rather than as speculative route expansion.

## Acceptance criteria

- A developer can discover, understand, and call every supported operation without reading frontend source.
- The Admin UI uses only public application routes plus a narrowly isolated private runtime-control mechanism.
- Public HTTP behavior maps to `StacksApplication` rather than duplicating domain logic.
- The machine-readable contract, handlers, schemas, reference documentation, and examples fail CI when they drift.
- Mutations document validation, side effects, retry safety, conflicts, and activity attribution.
- Bounded context and activity responses expose limits and omissions explicitly.
- Local loopback behavior remains fully functional without authentication or hosted infrastructure.
- Any non-loopback deployment requires authenticated, Stack-scoped authorization and secure transport.
- CLI endpoint mode and Streamable HTTP MCP reuse the same application semantics and error model.

## Open decisions

- Final resource-oriented route layout and stable API versioning scheme.
- Whether OpenAPI is generated from route definitions or checked in as the authoritative contract.
- Authentication and authorization mechanisms for non-loopback deployments.
- Revision token format for optimistic concurrency.
- Whether a standalone local API process is useful beyond the existing unified `stacks ui` runtime.
