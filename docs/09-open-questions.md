# Open questions

These are deliberately deferred. Codex should not silently lock them in without an ADR and a concrete use case.

## Naming and packaging

- Is “Component” the best generic core term, with “Project,” “Knowledge,” and “Reference” as kinds or UI labels?
- What npm package scope and binary name are actually available?
- Does the public project need a different name because “Stacks” is crowded?

## Manifest format

- Is JSON sufficient as canonical storage with optional YAML input?
- Should comments live in sidecar Markdown rather than JSONC/YAML?
- How should `apiVersion` migrations work?

## Workspace and Git

- Should active components track branches while references pin commits?
- What does a lock snapshot promise?
- How should forks, multiple remotes, worktrees, and credentials be represented?
- Should machine-local URL/path overrides use a separate ignored overlay file?

## Context

- Are capabilities sufficient, or are named relationship types also needed?
- How should conflicting required guidance be surfaced?
- How should target-specific preferences override general stack guidance without erasing it?
- Which model-specific tokenizers, if any, should supplement the portable hard byte budget?
- What change evidence should make a later refresh a delta rather than a smaller current-plan briefing?
- When is optional semantic ranking justified within declared context boundaries?

## Events and analytics

- Which event fields are safe to commit in sanitized exports?
- How are provider price changes versioned for estimates?

## Ingestion

- What is the smallest useful evidence locator across Git files, web pages, and documents?
- How are license constraints represented and enforced?
- Should proposal application be a Stacks command or always delegated to an external agent/orchestrator?

## Security

- What approval behavior can be assumed across Codex and other MCP hosts?

## Vaultar integration

- Does a Vaultar work unit reference one Stack and many components, or can it span Stacks?
- Which system owns the canonical agent session identity?
- Which events should flow both ways versus remain local telemetry?
