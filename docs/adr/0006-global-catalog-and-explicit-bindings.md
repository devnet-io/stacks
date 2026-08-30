# ADR 0006: global catalog and explicit component bindings

- Status: accepted and implemented for alpha
- Date: 2026-08-30
- Supersedes: ADR 0002's default hidden workspace layout

## Context

A Stack is useful to people as well as agents. Requiring component repositories beneath a hidden Stack-owned directory made ordinary IDE and repository workflows awkward. Per-directory UI and MCP processes also produced unstable ports and repeated client configuration.

## Decision

Register Stacks in a machine-level catalog using immutable IDs and readable `namespace/name` selectors. Store definitions as ordinary JSON in lowercase platform-native config directories and operational data in platform state directories.

Require an explicit local path binding for every component, including Git components. Keep Git provenance in the portable definition and machine paths in separate bindings. Permit the same directory to be bound into multiple Stacks and do not write membership markers into component repositories.

Treat knowledge and standards as ordinary components with capabilities and resources. Provide one global `stacks ui` with a Stack selector and one global `stacks mcp` stdio command whose Stack-specific tools require a selector.

Keep directory manifests and `--root` as migration compatibility while examples and callers move to the catalog.

## Consequences

People can arrange repositories naturally, MCP needs no long-running process or port, and future hosted adapters already have explicit Stack identity. Machine bindings are intentionally non-portable; definitions remain readable and suitable for versioning. Catalog mutation needs stronger transactions and import/export workflows in later slices.

