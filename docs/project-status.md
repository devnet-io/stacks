# Stacks project status

Do not infer completion from product documentation or accepted RFCs. This ledger records evidence from the current checkout.

## Implemented locally

| Area | Evidence |
| --- | --- |
| Manifest and context spike | Existing unit tests validate manifests and resolve layered capability context. |
| Conservative Git operations | Temporary-repository integration test covers clone, fetch, dirty preservation, and lock observation. |
| Agent events and usage | Lifecycle and aggregation test covers start, turn, usage, and completion. |
| Foundation example | Example test verifies materialized paths and selected context. |
| npm workspace | Root workspaces include local web and reserved cloud applications. |
| Stable Stack identity | Manifests require immutable ID, namespace, and name; events and plans use the immutable ID. |
| Documentation truth model | Product, current architecture, user guide, RFC, and status sources are distinct. |
| Local documentation UI | `apps/web` renders the canonical Markdown library. |
| Admin Overview vertical slice | Shared overview DTO, versioned loopback HTTP endpoint, `stacks ui` launcher, live component/workspace UI states, and HTTP integration tests are implemented. |
| Versioned CLI JSON contracts | A subprocess integration test covers init, validate, status, dry-run sync, lock, context, check-in, usage recording, and reporting. |
| Cross-platform CI | The same install and check gate passes on GitHub-hosted Windows, macOS, and Linux runners. |

## In progress

- Extraction of portable application contracts from Node filesystem adapters.
- Self-contained packaging of the web artifact for registry installation.
- Cross-process event append coordination and MCP transport testing.

## Proposed

- Hosted Stack snapshots, web access, and authenticated Streamable HTTP MCP.
- Machine-level registry for aliases and recent Stacks.
- Context materialization under explicit byte/token budgets.

## Current validation

The current gate runs 16 Node tests plus strict TypeScript checking, core compilation, and the Vinext web build. The self-hosting and foundation validate/context/status demos also pass. The live Overview route and loopback API are exercised locally. GitHub Actions applies the same gate on Windows, macOS, and Linux; run evidence is retained with each pushed commit.
