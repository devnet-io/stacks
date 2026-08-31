# Local MVP acceptance workflow

This document records the continuously verified local MVP path supported by the current repository. It is current delivery evidence, not a future proposal. The earlier design narrative is retained in the archived [MVP agent workflow vision](11-mvp-agent-workflow-vision.md).

## Acceptance boundary

`npm run check` packs Stacks, installs that package into an isolated npm prefix, and verifies that the installed package is a copy rather than a link to the source checkout. The gate then creates an isolated machine catalog and three independent component directories:

- `knowledge`, with required engineering guidance;
- `ui-library`, publishing `ui.button` and `ui.paged-data-list` from its bounded provider descriptor; and
- `product`, consuming those authoritative capabilities and carrying its own repository instructions.

The component directories are explicit bindings. They are not placed inside a hidden Stacks workspace and Stacks writes no ownership marker into them.

## Exercised agent journey

The copied CLI creates the Stack, adds all three components, declares Stack-owned knowledge and consumer relationships, composes the UI provider descriptor, configures bounded Markdown resources, and installs the managed Stacks block into the product's existing `AGENTS.md`. The check confirms that repository-owned instructions survive activation.

A live `stacks mcp` stdio process from the copied package then performs the agent-facing workflow:

1. Discover the product binding with `stack_memberships`, then inspect its component and Stack status.
2. Start logical product work and a first turn.
3. Receive an orientation briefing containing required engineering rules plus the authoritative button and paged-list documentation.
4. Complete that turn and begin a compact refresh turn for a dialog task.
5. Inspect existing requests, declare the product's missing `ui.dialog` requirement, record its cross-component request, and close the product turn as blocked.
6. Start separate provider work in `ui-library`; observe the request in provider context; and append the `in-progress` transition.
7. Publish bounded dialog documentation, add the provider-owned `ui.dialog` export to `.stack/component.json`, and report provider completion with evidence.
8. Resume the original product work. The refresh contains both the provider-complete request and the newly authoritative dialog documentation.
9. Append separate consumer verification, finish the product turn, and complete the logical work.
10. Read back a consumer-verified request with newest-first append-only transitions and completed product work containing three turns.

The exercise proves the shared installed CLI/MCP/application behavior as one scenario. It does not run an autonomous coding agent, assign provider work, or retain the temporary acceptance Stack after the gate finishes.

## Passing evidence

The acceptance path lives in `scripts/verify-mvp-workflow.mjs` and is invoked by `scripts/verify-package.mjs`. A passing run ends with:

```text
Verified copied CLI, packaged MCP contract, three-component agent workflow, and web runtime.
```

Run the focused copied-package check after building:

```powershell
npm run build
npm run verify:package
```

Run `npm run check` before delivery. That complete gate also validates documentation, unit and integration tests, strict TypeScript, the core build, and the production web build.

## Current limitations

- Turn refresh is a smaller deterministic current-plan briefing, not a change-aware delta.
- Consumer relationships and Stack overrides remain Stack-managed; provider descriptors intentionally cannot declare them.
- The acceptance client uses live stdio MCP but is deterministic automation rather than a vendor-specific agent harness.
- Remote application and Streamable HTTP MCP transports remain future work.
