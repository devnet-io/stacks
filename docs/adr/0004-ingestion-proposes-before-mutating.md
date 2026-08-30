# ADR 0004: ingestion proposes before mutating targets

- Status: accepted for alpha
- Date: 2026-08-29

## Decision

Inspection of an ingested source produces observations and target-specific adoption proposals. Applying changes is a separate, approved phase performed through normal component development workflows.

## Consequences

The system is safer, provenance remains visible, and each target’s preferences can shape adoption. Fully automatic propagation is deferred.
