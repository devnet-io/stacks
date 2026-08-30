# ADR 0002: external components are independent clones, not submodules by default

- Status: accepted for alpha
- Date: 2026-08-29

## Decision

Materialize Git-backed components beneath an ignored workspace directory as ordinary repositories. Record observed revisions in `stack.lock.json` rather than using Git submodules as the default composition mechanism.

## Consequences

Active multi-repository work is straightforward and the stack metadata repository stays clean. Exact checkout enforcement is not automatic; immutable/reference pinning may be added separately.
