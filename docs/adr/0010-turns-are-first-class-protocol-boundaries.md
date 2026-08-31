# ADR 0010: Turns are first-class protocol boundaries

Status: accepted

## Context

The initial activity protocol opened work sessions, accepted completed-turn checkpoints, and recorded usage through a separate operation. It did not start turns, link context resolution to a turn, or associate live telemetry with a particular turn. A participating agent could therefore report context, progress, and usage independently, and the resulting history could not prove which guidance or telemetry belonged to one agent turn.

Stacks needs a client-neutral turn boundary without assuming that every client defines a turn identically or exposes the same telemetry. It must keep historical JSONL events readable and must not store raw prompts, completions, or sensitive source payloads by default.

## Decision

A work session is an umbrella for one component and may contain multiple turns. Each new participating turn starts explicitly and receives a stable `turnId`. Starting a turn requires an active session and a concise task description, resolves the target component's current context plan, appends `turn.started`, and returns the event plus that plan. The task informs the transient context result but is not copied into the durable activity event.

The current `turn.started` record stores the plan generation time and aggregate item/warning/error counts, not the selected paths, content, or task. A stable plan revision or digest is required before activity history can identify the exact returned plan; that is intentionally deferred with briefing materialization rather than approximated from later Stack state.

Only one turn may be open in a session. Completing a turn requires its `sessionId` and `turnId`, refuses unknown or already completed turns, and appends `turn.completed`. Known provider/model/token/duration/tool/cost facts may be supplied with completion. When present, Stacks appends a linked `usage.recorded` event under the same writer lock and sync operation. Both events carry the same session and turn identities.

Delayed provider exports and external measurements use an explicitly named usage-import operation. Imported usage may link to a known turn or session when that identity is available, but it is not presented as live turn completion. Reports continue to aggregate both live and imported `usage.recorded` events while preserving cost provenance.

Completing work refuses a session with an open turn. Existing event history remains valid: `turnId` is an optional additive event field, and older `turn.completed` and `usage.recorded` events are read as historical pre-boundary records. No event is rewritten or backfilled.

The definition of a turn remains adapter-neutral: one model response, agent loop, or another meaningful client unit is valid if the adapter is consistent. Unknown telemetry is omitted rather than fabricated. Client adapters are responsible for invoking the protocol; Stacks records and validates participation but does not orchestrate the agent.

## Consequences

- Context, progress, and live telemetry share one durable turn identity.
- A session history can distinguish open, completed, and historical pre-boundary turns.
- Agent instructions and MCP clients gain an explicit turn-start call before material work on each turn.
- Separate live usage writes are removed from normal agent guidance; delayed reconciliation remains possible through an honest import surface.
- Turn completion may append more than one JSONL record atomically with respect to other Stack writers.
- Task-aware selection and content materialization can evolve behind turn start without changing the lifecycle boundary.
