# Validation and handoff

This document records the current checkout's validation surface and remaining Milestone 1 gaps. It is current-state documentation, not the original archive report.

## Exercised locally

- Installed the root npm workspace and generated the unified lockfile.
- The Node suite covers global catalog paths and bindings, CLI product/version contracts and linked-entrypoint resolution, exhaustive CLI/MCP documentation drift, MCP initialization instructions and reference resources, local Overview, Graph, Activity, integration/runtime HTTP APIs, global stdio MCP transport, context, documentation truth, events, examples, Git safety, initialization, and validation.
- Ran strict TypeScript checking successfully.
- Built the core package successfully.
- Built the static Vite web workspace successfully with the canonical Markdown documentation library.
- Served the packaged web workspace and same-origin API from one Node process, receiving HTTP 200 for the root route, marker, and health endpoint.
- Exercised the self-hosting and foundation validate/context/status demos after the identity migration.
- Ran the complete `npm run check` gate successfully after all code and documentation changes.
- Packed Stacks, installed it into an isolated npm prefix, confirmed the package was a copy rather than a symlink, ran its copied CLI, and served and fetched the packaged production web UI. This verification is part of `npm run check`.
- Replaced the machine's former development link with `npm run install:local`, confirmed the global package is not a symlink, and launched the UI from that installed copy.
- Built the Docker quality image and ran the same complete gate in clean Node 22 Linux userspace.

## CI portability

`.github/workflows/ci.yml` runs `npm ci` and `npm run check` on Windows, macOS, and Linux. GitHub Actions run `33284842320` passed all three jobs.

## Remaining Milestone 1 gaps

- Runtime validation and JSON Schema remain separate representations and can drift.
- Canonical context-plan DTOs still contain local absolute paths.
- Registered Git components require explicit destinations; broader remote mismatch and failure-rollback coverage remains useful.
- The beginner documentation, Overview, Graph, and Tools & agents sections are complete against the checked-in web workspace and copied local installation. Publishing the package to a registry remains future release work.

## Handoff rule

Do not paper over a failing check by weakening strictness or removing safety behavior. Record the gap, add a focused test, change the smallest domain surface needed, and update current documentation plus project status in the same change.
