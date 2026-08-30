# ADR 0003: capability relationships drive context composition

- Status: accepted for alpha
- Date: 2026-08-29

## Decision

Components declare namespaced capabilities they provide and consume. Capability exports identify relevant context paths. Explicit dependencies remain available for relationships that are not naturally expressed as capabilities.

## Consequences

Stacks can model knowledge and reference relationships beyond package dependencies and across ecosystems. Naming discipline and ambiguity handling are required.
