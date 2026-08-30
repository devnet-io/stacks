# ADR 0007: Application boundary and optional remote transports

Status: accepted

## Context

The CLI, stdio MCP adapter, and loopback HTTP adapter initially called core filesystem and catalog modules independently. That duplicated use-case orchestration and made a future host CLI talking to a containerized or hosted Stacks service difficult. Making HTTP mandatory locally would instead require a daemon for ordinary CLI use.

## Decision

Define a `StacksApplication` interface for application use cases. CLI, MCP, and HTTP adapters call this interface rather than orchestrating core modules directly.

The default implementation is in-process and local-first. A later HTTP client implementation will satisfy the same interface and be selected explicitly with `--endpoint` or `STACKS_ENDPOINT`. The absence of an endpoint continues to mean in-process execution; Stacks does not require a local daemon.

The same remote-service stage will add Streamable HTTP MCP. One service origin may therefore serve the web UI at `/`, the versioned application API under `/api/`, and MCP under `/mcp`. REST and MCP use the same `StacksApplication`, Stack authorization rules, and authentication policy. They are transport alternatives, not independent backends.

Local agent clients continue to use `stacks mcp` over stdio without a daemon. A later `stacks mcp --endpoint` mode may retain that stdio-facing contract while delegating operations to a remote `StacksApplication`; clients supporting Streamable HTTP MCP may connect to `/mcp` directly.

Directory manifests are compatibility input only. They are selected explicitly with `--root`; the current working directory is never an implicit Stack selector. Machine-wide operations use the global catalog, and operations requiring one registered Stack require `--stack namespace/name`.

## Consequences

- CLI, MCP, HTTP, and UI share application semantics and versioned outputs.
- A host CLI can eventually address a Stacks process in a container without changing command meaning.
- Remote agents can use Streamable HTTP MCP directly, while stdio-only clients can use the CLI adapter as a bridge.
- Local CLI use remains fast and available when the UI/API process is stopped.
- Filesystem paths supplied to a remote service refer to that service's filesystem, so container documentation must require explicit mounts and path mapping.
- Authentication is required before an HTTP endpoint may be exposed beyond loopback.
- Compatibility code may load legacy roots inside the local implementation, but new domain behavior must not depend on directory discovery.
