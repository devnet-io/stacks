# Current installation and deployment contract

This document describes what this checkout supports now. Hosted execution remains proposed in RFC-0001.

## Local development installation

Run `npm run install:local` from the Stacks source repository. It builds the CLI and static web application, gracefully stops every registered local Stacks UI process, creates an npm package archive, and globally installs that archive. npm copies the package into machine-level storage; no installed path points back to the clone. The command is idempotent and replaces the previous snapshot. It does not restart the UI automatically; run `stacks ui` after installation when you want it running again. It also cannot refresh MCP tool registries already loaded by an agent client. Fully restart Codex after registration or an upgrade that changes MCP tools. Verify with `stacks --version` and `stacks doctor`, then use `stacks stack list` and `stacks status --stack namespace/name`.

The registry package is not published, so installation still begins from a clone. After installation the clone is unnecessary: the archive includes `dist/cli.js` plus the static Vite artifact. `stacks ui` serves that artifact and the read-only API from the same Node process; Vinext, Wrangler, and a separate frontend server are not part of the installed runtime.

Each UI process writes a small runtime record under the lowercase platform state directory. The record contains its PID, loopback origin, product version, and a random shutdown token. The installer uses that token to request graceful shutdown before replacement; it never kills an arbitrary PID based only on a process listing. A newly installed `stacks ui` also refuses to reuse a healthy UI from a different product version.

The root `package.json` version is the product version and is incremented for each pushed product delivery. `stacks --version`, the UI application menu, `GET /api/v0.1/health`, and generated integration metadata use that value.

## Environment-correct instructions

User-facing agent setup comes from `GET /api/v0.1/integrations?stack=namespace/name`, not hard-coded machine paths. The response is generated from the selected Stack, package version, running CLI entrypoint, and adapter configuration. `stacks doctor --json` retains the same data for explicit troubleshooting, but it is not part of the normal workflow.

Local MCP is stdio and has neither a URL nor an authentication token. If a deployment later supplies hosted adapter metadata, use:

- `STACKS_HOSTED_MCP_URL` for the Streamable HTTP endpoint;
- `STACKS_HOSTED_MCP_TOKEN_ENV_VAR` for the **name** of the environment variable containing its bearer token.

Never put the bearer token value in documentation, URLs, committed configuration, API responses, or the admin UI. Codex Streamable HTTP configuration should reference the environment-variable name.

## Release verification

Before release, run `npm run check`, install the candidate with `npm run install:local`, run `stacks doctor`, create or select a registered Stack, run `stacks status --stack namespace/name`, start `stacks ui`, switch Stacks, and confirm Tools & agents reports the intended adapter metadata. The temporary installation test initializes the installed stdio server and compares its actual `tools/list` and `resources/list` responses with the canonical MCP catalog.
