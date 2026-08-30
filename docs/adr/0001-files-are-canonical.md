# ADR 0001: ordinary files are the canonical Stack representation

- Status: accepted for alpha
- Date: 2026-08-29

## Decision

Keep the Stack manifest, schemas, decisions, and adoption provenance in ordinary files suitable for Git. Treat JSONL events and any SQLite database as local operational storage with documented export paths.

## Consequences

The stack remains cloneable, reviewable, and tool-independent. Query performance may require derived indexes later. Schema migrations must be explicit.
