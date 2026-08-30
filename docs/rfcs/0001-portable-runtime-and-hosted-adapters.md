# RFC-0001: Portable runtime and hosted adapters

Status: Implementing

## Problem

Stacks must operate fully against local files and Git while preserving a cheap path to hosted documentation, Stack snapshots, and remote MCP. The current spike passes a filesystem-root object through core operations and uses an editable Stack name as identity.

## Proposal

- Give every Stack an immutable opaque ID plus a readable namespace and name. Implemented by ADR-0005.
- Address portable resources by Stack ID, component ID, relative path, and optional revision rather than absolute local path.
- Make application operations accept an explicit Stack reference. Local adapters may bind it from the current directory or process root.
- Depend on focused `StackStore`, `ContentStore`, and `EventStore` ports at the application boundary.
- Keep Node filesystem, Git, JSONL, stdio MCP, and local HTTP as local adapters.
- Reserve authenticated HTTP, snapshot storage, hosted web, and Streamable HTTP MCP as hosted adapters.
- Keep Git-readable Stack files canonical. A hosted copy is a versioned representation, never silent replacement state.

## Local and hosted shape

```text
portable application services
  local Node adapters: files, Git, JSONL, CLI, stdio MCP, local web
  hosted adapters: snapshots, HTTP API, hosted web, remote MCP
```

## Deferred decisions

Cloudflare D1, R2, Durable Objects, authentication provider, synchronization schedule, and deployment topology remain unselected until a hosted vertical slice requires them. The sibling `govwork` project is a reference for Worker structure, checked-in configuration, GitHub deployment, and documentation delivery; its domain and storage choices are not inherited automatically.

## Acceptance criteria

- Pure graph and context selection can run without Node filesystem imports.
- Local CLI behavior remains unchanged except for explicit identity migration.
- Canonical context-plan DTOs contain portable resource references; local evidence is adapter metadata.
- Contract tests run on Windows, macOS, and Linux.
- Hosted implementation cannot become canonical without a separate source-of-truth ADR.
