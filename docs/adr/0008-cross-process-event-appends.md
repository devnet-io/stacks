# ADR 0008: Cross-process event append serialization

Status: accepted

## Context

Work and usage events are the durable append-only activity history for a Stack. A single process could append and sync JSONL records safely, but multiple CLI or MCP processes could open the same file concurrently. Stacks needs deterministic local behavior without replacing readable files with a database or requiring a daemon.

## Decision

Serialize each event append with an exclusive `events.lock` file in the Stack's operational state directory. A writer creates the lock atomically, writes diagnostic ownership metadata, appends one complete JSONL record, syncs it, closes it, and removes the lock. Other writers retry for up to five seconds; Windows sharing violations during lock release are treated as transient contention.

Readers remain lock-free and tolerate malformed historical lines with warnings. A timed-out writer reports the exact lock path. It does not automatically delete a lock because the owning process may still be active. Events remain append-only ordinary JSONL and no component repository is touched.

The application-level Activity view reads the whole available history for session and usage aggregates, but exposes at most 100 sessions and 100 sanitized recent records. Monetary totals remain separated by currency and by `reported`, `estimated`, or `allocated` provenance.

## Consequences

- Independent local CLI and MCP processes cannot interleave or lose event records during normal operation.
- A crashed writer may leave a lock that requires explicit operator inspection; automatic stale-lock recovery is deferred until ownership can be proven safely across supported platforms.
- Event readers do not block active agents.
- Activity adapters consume a stable bounded projection rather than interpreting arbitrary raw event data.
