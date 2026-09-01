# Local MVP acceptance workflow

This document records the continuously verified local MVP path supported by the current repository. It is current delivery evidence, not a future proposal. The earlier design narrative is retained in the archived [MVP agent workflow vision](11-mvp-agent-workflow-vision.md).

## Acceptance boundary

`npm run check` packs Stacks, creates a clean temporary installation in an isolated npm prefix, and verifies that the installation does not link to the source checkout. The test then creates an isolated machine catalog and three independent component directories:

- `knowledge`, with required engineering guidance;
- `ui-library`, publishing `ui.button` and `ui.paged-data-list` from its bounded provider descriptor and exposing them through a real npm package; and
- `product`, consuming those authoritative capabilities and carrying its own repository instructions.

The component directories are explicit bindings. They are not placed inside a hidden Stacks workspace and Stacks writes no ownership marker into them.

## Exercised agent journey

The temporarily installed CLI creates the Stack, adds all three components, declares Stack-owned knowledge and consumer relationships, composes the UI provider descriptor, configures bounded Markdown resources, and installs the managed Stacks block into the product's existing `AGENTS.md`. The test confirms that repository-owned instructions survive activation.

A live `stacks mcp` stdio process from that temporary installation then performs the agent-facing workflow:

1. Discover the product binding with `stack_memberships`, then inspect its component and Stack status.
2. Start logical product work and a first turn.
3. Receive an orientation briefing containing required engineering rules plus the authoritative button and paged-list documentation.
4. Receive the UI package identity and a derived local `file:` fallback, install it with lifecycle scripts disabled, and execute a real product import. Existing registry and workspace conventions remain preferred when present.
5. Complete that turn and begin a compact refresh turn for a dialog task.
6. Inspect existing requests, declare the product's missing `ui.dialog` requirement, record its cross-component request, and close the product turn as blocked.
7. Start separate provider work in `ui-library`; observe the request in provider context; and append the `in-progress` transition.
8. Publish bounded dialog documentation, add the provider-owned `ui.dialog` export to `.stack/component.json`, and report provider completion with evidence.
9. Resume the original product work. The refresh contains both the provider-complete request and the newly authoritative dialog documentation.
10. Append separate consumer verification, finish the product turn, and complete the logical work.
11. Read back a consumer-verified request with newest-first append-only transitions and completed product work containing three turns.

The exercise proves the shared installed CLI/MCP/application behavior as one scenario. It does not run an autonomous coding agent, assign provider work, or retain the temporary acceptance Stack after the test finishes.

## Passing evidence

The acceptance path lives in `scripts/verify-mvp-workflow.mjs` and is invoked by `scripts/verify-package.mjs`. A passing run ends with:

```text
Verified temporary installation: CLI, MCP contract, three-component agent workflow, and web runtime.
```

Run the focused temporary installation test after building:

```powershell
npm run build
npm run verify:package
```

Run `npm run check` before delivery. The complete check also validates documentation, unit and integration tests, strict TypeScript, the core build, and the production web build.

## Current limitations

- Turn refresh is a smaller deterministic current-plan briefing, not a change-aware delta.
- Consumer relationships and Stack overrides remain Stack-managed; provider descriptors intentionally cannot declare them.
- Artifact guidance explicitly requires the agent to inspect both package manifests, workspace configuration, and the lockfile before editing the consumer. It does not inspect every possible convention or invoke a package manager itself.
- The acceptance client uses live stdio MCP but is deterministic automation rather than a vendor-specific agent harness.
- Remote application and Streamable HTTP MCP transports remain future work.
