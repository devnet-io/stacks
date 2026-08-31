# ADR 0011: Context plans materialize as bounded briefings

## Status

Accepted and implemented.

## Decision

Keep deterministic context planning separate from safe materialization. The local application resolves declared guidance and capability paths first, then reads only regular text files whose canonical paths remain inside their owning component roots.

The first turn in a work session receives an `orientation` briefing with a default 32 KiB content budget. Later turns receive a `refresh` briefing with a default 8 KiB budget. A caller may request a different positive byte budget up to 256 KiB. Bytes are the enforceable unit; Stacks does not claim model-specific token precision without a tokenizer.

Selection remains deterministic. Guidance strength is primary, task-keyword matches against declared metadata and provenance rank within a strength, then declared priority, target locality, component, and path settle ties. Materialization follows that order until the budget is exhausted. Missing, unreadable, non-file, unsafe, binary, truncated, and budget-excluded resources are reported explicitly.

Each result includes selected content, source and included byte counts, content hashes, provenance, omissions, and a SHA-256 briefing digest. `turn.started` records the digest, mode, budget, byte count, and aggregate item/omission counts. It does not record task text or materialized file content.

Directory membership discovery also distinguishes two scopes. A query inside a bound component returns only direct `component` matches. When there is no direct match, a query that is an ancestor of bound components returns `ancestor` matches. Stacks never chooses among multiple descendant components or Stacks.

## Consequences

- Agents receive usable content rather than paths alone while the core retains a small plan/materializer boundary.
- Symlink escapes and undeclared repository scans are excluded.
- Briefing size is deterministic and auditable, but model token counts remain the consuming client's concern.
- A digest identifies the returned briefing without copying potentially sensitive content into Activity.
- Refresh mode is presently a smaller re-materialization of the current plan; change-aware deltas may be added later without changing the turn boundary.
- Opening an agent at a shared project parent becomes discoverable but cannot silently select a target component.
