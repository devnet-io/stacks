# ADR 0012: Capability requests are role-checked events

## Status

Accepted and implemented.

## Context

A consumer may discover that correct work depends on a capability owned by another component. Silently implementing a local substitute loses the Stack's authority model, but turning Stacks into a ticket scheduler or agent orchestrator would violate its product boundary.

The relationship also needs more truth than a single “done” flag. Provider completion says the expected provider believes the capability is available; only the requesting consumer can establish that its original need is satisfied.

## Decision

A capability request has a stable random `requestId` and begins with `capability-request.created`. Creation requires an active logical work session owned by the requesting component, a distinct expected provider component, a capability name, and a reason. Optional acceptance text records what the consumer expects to verify.

Every later state change is a `capability-request.transitioned` event carrying the previous state, next state, acting component, summary, and optional evidence. Current state is a projection of the append-only history.

The implemented states are:

- `requested`
- `in-progress`
- `provider-complete`
- `consumer-verified`
- `rejected`
- `superseded`

Provider components start work and report provider completion. Requesting components perform consumer verification or supersede the request. Rejection may be recorded by either party. A consumer may return provider-complete work to in-progress when verification finds more provider work is necessary. Terminal requests are never silently reopened or rewritten.

Open requests relevant to a target component are included as a bounded structured part of resolved context. The request protocol records need, state, and evidence; it does not assign an agent, schedule execution, or automatically mutate either component.

## Consequences

- Agents and people can coordinate across independently owned repositories without Stacks becoming an orchestrator.
- The originating work, requesting component, expected provider, and verification evidence remain traceable.
- Provider-complete and consumer-verified are intentionally distinct.
- Corrections require a new allowed transition rather than history mutation.
- Clients must not interpret a request as an assignment or execution queue.
