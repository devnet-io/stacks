# Validation and handoff

This document records the current checkout's validation surface and remaining Milestone 1 gaps. It is current-state documentation, not the original archive report.

## Exercised locally

- Installed the root npm workspace and generated the unified lockfile.
- Ran 16 Node tests covering versioned CLI JSON contracts, the local Overview HTTP API and launcher, context, documentation truth, events, the foundation example, Git safety, initialization, and validation.
- Ran strict TypeScript checking successfully.
- Built the core package successfully.
- Built the local web workspace successfully with the canonical Markdown documentation library.
- Served the local web workspace and received HTTP 200 for the root route.
- Exercised the self-hosting and foundation validate/context/status demos after the identity migration.
- Ran the complete `npm run check` gate successfully after all code and documentation changes.

## CI portability

`.github/workflows/ci.yml` runs `npm ci` and `npm run check` on Windows, macOS, and Linux. GitHub Actions run `33284842320` passed all three jobs.

## Remaining Milestone 1 gaps

- Runtime validation and JSON Schema remain separate representations and can drift.
- JSONL appends are not protected by a cross-process locking strategy.
- Canonical context-plan DTOs still contain local absolute paths.
- MCP lacks a real client/server transport test.
- Git coverage does not yet prove the initialized workspace clone remains ignored and cannot become a submodule.
- The Overview section is complete against the checked-in web workspace; packaging that web artifact for registry installation remains incomplete.

## Handoff rule

Do not paper over a failing check by weakening strictness or removing safety behavior. Record the gap, add a focused test, change the smallest domain surface needed, and update current documentation plus project status in the same change.
