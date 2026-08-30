# Events, usage, and analytics

## Why events

Agents may be running in different repositories, terminals, editors, and providers. A shared append-only protocol gives the stack an overall history without requiring Stacks to control the agents.

## Minimum check-in lifecycle

### Work start

Record:

- session ID;
- agent/client identity;
- target component;
- optional external work ID;
- model when known;
- initial summary and timestamp.

### Turn completion

Record:

- summary of what changed or was learned;
- changed paths or artifacts;
- next step;
- status (`progress`, `blocked`, `failed`, `complete`);
- optional usage reference.

A “turn” is intentionally client-neutral. It may be one model response, one agent loop, or another meaningful checkpoint, as long as the client is consistent.

### Work completion

Record outcome, summary, remaining issues, and relevant artifact/revision references.

## Event envelope

Every event has:

- `schemaVersion`;
- `id`;
- `timestamp`;
- `type`;
- required immutable `stackId`, plus optional `componentId`, `sessionId`, and `workId`;
- `actor` metadata;
- type-specific `data`.

Unknown event types should remain readable so adapters can evolve independently.

## Append-only rule

Do not edit historical events to “fix” them. Append a correction, supersession, or decision event that references the prior event. This preserves auditability and avoids concurrency races around in-place updates.

The prototype uses JSONL because it is portable and inspectable. Production work should add cross-platform atomic append/file-lock behavior and recovery from a partial final line. SQLite may index the stream later.

## Usage event

Record available fields without inventing missing values:

- provider and model;
- input, output, cached-input, and reasoning tokens;
- tool calls;
- wall duration;
- amount and currency;
- cost kind: `reported`, `estimated`, or `allocated`;
- pricing reference or estimation note;
- source event/client metadata.

## Analytics

Useful views include:

- cost and tokens by stack, component, work ID, session, model, provider, and day;
- active/blocked/completed sessions;
- work spanning multiple components;
- repeated context items or expensive workflows;
- ingestion proposals that led to accepted changes.

Analytics should operate on normalized event fields. Provider-specific raw payloads belong in optional attachments with explicit retention and redaction rules.

## Privacy defaults

Do not commit:

- raw prompts or completions;
- environment variables;
- API keys or OAuth tokens;
- full tool payloads containing source code or customer data;
- provider account identifiers unless explicitly requested.

Summaries should be useful but deliberately scoped. Exported reports should disclose whether cost totals are invoice-reported, client-reported, estimated, or mixed.
