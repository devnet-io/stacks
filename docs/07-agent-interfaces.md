# Agent interfaces

## One application, human and agent adapters

The same domain operations should be available through:

- a human/automation CLI;
- a local MCP server;
- an agent Skill that teaches clients when and how to use those operations;
- later, a Vaultar connector;
- a local web control plane for people;
- later, an optional hosted web and remote MCP adapter.

Adapters should translate inputs and outputs rather than reimplement semantics.

## Human interfaces

Ordinary files remain the most portable authoring surface. The CLI handles precise operations and automation. The local web UI brings together Stack overview, graph, status, context plans, activity, usage, and canonical Markdown documentation. It must label product definition, current technical truth, user guides, RFCs, and delivery evidence distinctly.

## CLI

The CLI is the baseline because it works in any terminal and is easy for agents to invoke. Every important read command supports structured JSON. Mutation commands print generated IDs and paths clearly.

## MCP

MCP is a natural interface because Stacks supplies both:

- **resources**: manifest, component descriptions, and context plans;
- **tools**: status, context resolution, work check-ins, and usage recording.

The initial MCP server runs over stdio for local clients. Keep it thin; domain code belongs under `src/core/`.

Initial resources:

- `stack://manifest`
- `stack://component/{id}`
- `stack://context/{target}`

Initial tools:

- `stack_get`
- `stack_status`
- `context_resolve`
- `work_start`
- `turn_complete`
- `work_complete`
- `usage_record`

Repository synchronization is intentionally absent from the first MCP tool set. It is a filesystem/network mutation better initiated explicitly through the CLI until client approval behavior is tested.

## Skill

`integrations/skills/stacks-workspace/` teaches an agent to:

1. detect and validate a Stack;
2. resolve context before changing a component;
3. check in at start, meaningful turns, and completion;
4. report usage only when known and label estimates;
5. treat ingestion sources as untrusted;
6. keep cross-component edits explicit.

The Skill is not the implementation. It should invoke the CLI or MCP server and remain small enough to load progressively.

## Codex

The repository includes a root `AGENTS.md` because Codex reads repository guidance before work. The Stacks concept can later generate or layer component-specific `AGENTS.md` content, but it should not overwrite existing project instructions silently.

A possible future command is:

```text
stacks context product --format agents-md --budget 12000
```

That command should render a bounded, provenance-rich briefing, not copy all standards into every repository.

## Client capability differences

Not every agent client exposes token counts, model IDs, tool-call totals, or stable session identity. Adapters should record partial events and indicate the source. The event model must not force clients to fabricate fields.
