# Stacks user guide

Start with [Getting started](getting-started.md). Installation is documented separately in [Installation and distribution](deployment.md). For exhaustive syntax, options, side effects, and examples, use the [CLI command reference](cli-reference.md) and [MCP server reference](mcp-reference.md).

## Finding help

```bash
stacks help
stacks help commands
stacks help status
```

The first command shows the normal workflow, `help commands` lists the complete surface, and `help <command>` explains one command group. Most work uses `stack`, `component`, `status`, `context`, `ui`, and `mcp`.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `stacks stack create <namespace/name>` | Create a registered Stack in the machine catalog. |
| `stacks stack list` | List registered Stacks. |
| `stacks locate [directory]` | Find every Stack/component binding containing a directory. |
| `stacks agent install --path .` | Add or refresh the bounded Stacks activation block in `AGENTS.md`. |
| `stacks component list <stack>` | List component declarations and bindings. |
| `stacks component get <stack> <id>` | Inspect one complete component declaration and binding. |
| `stacks component add <stack> <id> --path <dir>` | Add a component and bind its explicit path. Add `--git <url>` to clone when the path is missing. |
| `stacks component bind <stack> <id> --path <dir>` | Change an existing component's directory binding on this machine. |
| `stacks status [--stack <stack>]` | Inspect all registered Stacks, or one selected Stack, without changing repositories. Loading also validates each definition. |
| `stacks context <target> --stack <stack> [--task <text>]` | Resolve bounded, provenance-rich context for a target component. |
| `stacks sync --stack <stack> [--dry-run] [--update]` | Clone missing Git components or fetch existing remotes with `--update`. |
| `stacks ui [--port <number>] [--no-open]` | Start the global UI and local API on one loopback address. |
| `stacks --version` | Print the installed product version. |
| `stacks mcp` | Run the global stdio MCP adapter for an agent client. |

`component add --path` is mandatory. Without `--git`, the directory must already exist. With `--git`, a missing directory is cloned and an existing directory is inspected. Kind is an optional extensible label that defaults to `component`; capabilities describe what a component actually provides and consumes. `sync --update` fetches only; Stacks never merges, rebases, resets, cleans, moves, or discards dirty repositories.

## Local UI

```bash
stacks ui
```

Stacks serves the static Vite application and `/api/v0.1/*` from the same Node process. The default address is `http://localhost:3210/`. If port 3210 is unavailable, Stacks tries successive ports and prints the selected address. Passing `--port` requests an exact port and reports a conflict instead of silently changing it. Re-running `npm run install:local` gracefully stops registered UI processes before replacing the installed snapshot; restart with `stacks ui` afterward.

The UI is machine-level. A subdued Stack selector sits directly below the sidebar header and applies to every operational section. Overview shows component health, Graph shows provider and dependency relationships, Activity separates logical work from Stack changes and links to work/turn details, Requests provides paginated request creation/list/detail/transition views, Manage creates Stacks, edits component display metadata, binds components, configures Stack-owned context, and displays provider-descriptor provenance and validation failures, Tools & agents contains runtime connection instructions, and Documentation renders every canonical Markdown file under `docs/`. The bottom application menu displays the installed version and reserves space for future account/settings controls. Installation instructions live in Documentation rather than the operational tabs.

Component IDs are stable Stack-local identities. Choose a concise portable ID when adding a component; later edit its display name, description, kind, and agent access without changing that ID. Bindings, relationships, requests, events, and work refer to the stable ID. Change the local directory through the binding control rather than treating the path as identity.

Capability consumption is required unless explicitly marked optional. A missing or ambiguous required provider is a context error; an optional one remains visible but is a warning. Manage labels every saved requirement as required or optional. Graph lays providers and dependencies above their consumers, distinguishes capability, dependency, and optional edges in a compact legend, and keeps selected-component details below the full-width composition canvas. Direct component dependencies are currently always required.

## Provider-owned component descriptors

A reusable component may publish `.stack/component.json` in its own repository:

```json
{
  "schemaVersion": "0.1",
  "provides": [
    {
      "capability": "ui.dialog",
      "description": "Accessible shared dialog",
      "context": [
        { "path": "docs/dialog.md", "strength": "preferred" }
      ],
      "artifact": {
        "ecosystem": "npm",
        "name": "@acme/ui",
        "path": "."
      }
    }
  ]
}
```

This file is optional and provider-owned. It may publish only capabilities, bounded context paths, and portable artifact identities; it cannot identify the component, bind directories, declare consumers or dependencies, install instructions, or execute anything. Stacks reads at most 64 KiB from the fixed location after the component is explicitly bound. A Stack-owned provider declaration with the same capability replaces the descriptor entry completely. Consumer requirements always remain explicit Stack data.

Manage shows whether the descriptor is absent, valid, invalid, or unavailable, along with published, applied, and overridden capabilities. Invalid descriptors are ignored without changing the Stack definition. Edit and review the descriptor in the component repository through its normal Git workflow; Stacks does not create or update it.

## Consuming implementation artifacts

When a consumed capability identifies an artifact, `stacks context`, `context_resolve`, and `turn_start` return `artifactGuidance`. The Stack relationship records dependency intent; it does not install or link the package. For npm-compatible packages the guidance includes the package name, provider and package roots, a local `file:` candidate derived from the consumer and provider bindings, and the exact fallback `package.json` dependency entry.

The agent must inspect the repositories before changing dependency files:

1. Preserve an existing dependency or project-specific package configuration.
2. If provider and consumer already participate in the same npm, pnpm, Yarn, or Bun workspace, follow that workspace's convention.
3. If the organization already publishes the package through a configured registry, use the registry coordinate and normal version policy.
4. In a mixed layout, apply workspace conventions to members and consider `file:` only for a provider outside that workspace.
5. When the components are in unrelated directory trees and no registry/workspace strategy exists, use the returned local `file:` value as the development fallback.

The portable definition stores `npm` and `@acme/ui`, never `../ui-library` or an absolute machine path. Each machine derives its own candidate from explicit bindings. Stacks does not edit `package.json`, choose npm versus pnpm/Yarn/Bun, run installs, execute lifecycle scripts, build packages, or publish them.

The fallback uses the common `file:` protocol, but native behavior is not identical: [npm accepts local package paths](https://docs.npmjs.com/files/package.json/#local-paths), [pnpm hard-links `file:` packages and installs their dependencies](https://pnpm.io/cli/link#whats-the-difference-between-pnpm-link-and-using-the-file-protocol), [Yarn copies folder-based `file:` packages](https://yarnpkg.com/protocol/file), and [Bun treats local-source dependencies as project-local and separately controls lifecycle-script trust](https://bun.sh/docs/pm/lifecycle). This is why Stacks returns evidence and a fallback rather than pretending to offer one universal install operation.

Documentation is grouped by purpose. Selecting a document reveals its second- and third-level headings as nested navigation. The current section, document, and heading are encoded in the URL as `view`, `document`, and `heading`, so bookmarks and shared local links reopen the same location. Links between canonical Markdown documents remain inside the documentation interface.

Read-only endpoints:

- `GET /api/v0.1/stacks`
- `GET /api/v0.1/overview?stack=namespace/name`
- `GET /api/v0.1/activity?stack=namespace/name`
- `GET /api/v0.1/graph?stack=namespace/name`
- `GET /api/v0.1/integrations?stack=namespace/name`
- `GET /api/v0.1/health`

Contracts are stored in `schemas/`, including separate Activity overview, logical-work detail, turn-detail, and capability-request list/detail schemas. Canonical documentation remains in `docs/`; do not maintain a second copy in frontend components.

## Cross-component capability requests

A capability request records that active work in one component depends on a missing capability expected from another component. Creation requires the requesting component's active `sessionId`, the expected provider, capability, reason, and optional acceptance evidence. It does not assign an agent or schedule provider work.

The lifecycle is `requested`, `in-progress`, `provider-complete`, and `consumer-verified`, with `rejected` and `superseded` terminal alternatives. Providers start or report completion; only the requester verifies the original need. Every transition appends a summary and optional evidence. The Requests UI exposes the same protocol as `stacks request ...` and the `capability_request_*` MCP tools. Relevant non-terminal requests are included in bounded resolved context for both requesters and providers.

## Local MCP

```bash
codex mcp add stacks -- stacks mcp
```

Fully quit and reopen Codex after registration, and after installing any Stacks upgrade that changes MCP tools. A new task in the same desktop process may retain the old callable-tool registry. `stacks doctor` reports the contract built into the installed package; Codex's MCP settings or `/mcp` view reports what the client actually loaded.

`stacks mcp` uses stdio. The agent client launches it when needed and communicates through stdin/stdout, so local use has no URL, token, daemon, or port. Protocol diagnostics go to stderr.

`stacks agent print|check|install|remove` manages repository activation separately from the global MCP connection. Install and remove touch only the delimited Stacks block, preserve all other `AGENTS.md` content, refuse malformed markers and symlinks, and never hard-code one Stack selection.

`stack_memberships` accepts a workspace path. Direct `component` results mean the path is inside a binding. If there are no direct matches, `ancestor` results identify bound components below a shared parent and require an explicit target choice. `stack_list` remains the fallback when there is no relationship. Component tools provide structured local management; capability-request tools expose create/list/detail/transition behavior with provider and consumer roles. Selected-Stack, context, lifecycle, request, and usage tools require `stack: "namespace/name"`. Git cloning and synchronization are intentionally not exposed through MCP.

## Work and usage events

The Activity section has separate Work and Stack changes views. Each Work row is one logical unit started by `work_start`, preserves its original title, reports its completion result and turn count, and opens a deep-linked detail page. Work detail lists child turns; turn detail shows status, briefing evidence, changed paths, next step, and usage. Stack changes contains catalog/configuration activity without interleaving every work lifecycle record. Lists and detail event evidence are bounded while aggregate counts cover the complete readable history. Independent local writers serialize appends with a per-Stack lock; earlier events are never rewritten.

A `sessionId` groups logical work; it is not a Codex chat ID. Keep it active across clarification, retries, and multiple agent turns, and call `work_complete` only when that work is actually done. One agent chat may complete multiple logical work items.

| Command | Purpose |
| --- | --- |
| `stacks checkin start` | Append the start of a work session and return its session ID. |
| `stacks checkin turn-start` | Open a turn and return its ID plus a bounded orientation or refresh briefing. |
| `stacks checkin turn-complete` | Close that turn with status, changed paths, next step, and optional known telemetry. |
| `stacks checkin complete` | Append completion and outcome without rewriting earlier events. |
| `stacks usage import` | Import delayed provider or external telemetry not available at turn completion. |
| `stacks usage report --stack <stack>` | Aggregate recorded usage. |

Example:

```bash
stacks checkin start --stack my-team/my-stack --component app --summary "Starting change"
stacks checkin turn-start --stack my-team/my-stack --session <id> --task "Implement the next slice"
stacks checkin turn-complete --stack my-team/my-stack --session <id> --turn <turn-id> --summary "Implemented slice" --provider openai --model gpt-5
stacks checkin complete --stack my-team/my-stack --session <id> --summary "Verified" --outcome success
stacks usage report --stack my-team/my-stack
```

Only one turn may be open in a session, and work completion refuses an open turn. Usage amounts require `--cost-kind reported|estimated|allocated`.

The first turn in a session defaults to a 32 KiB orientation; later turns default to an 8 KiB refresh. `--max-bytes` overrides the hard content budget. Returned context includes hashes, provenance, truncations, omissions, and the same digest recorded on `turn.started`; task text and materialized content are not stored in Activity.

## Structured output

Pass `--json` when automation consumes a supported command. stdout contains one versioned JSON document; diagnostics and failures use stderr. Current management outputs use `schemaVersion: "0.1"`. Before a compatibility milestone is declared, unused contracts may be simplified or removed, but Stacks must detect durable data safely and never silently corrupt or discard it.

## Advanced and compatibility commands

| Command | When to use it |
| --- | --- |
| `stacks validate (--stack <stack> | --root <dir>)` | Validate a registered or legacy definition. Registered Stacks are already validated whenever loaded, including by `status`. |
| `stacks doctor` | Inspect the installed runtime and complete MCP tool/resource contract without selecting a Stack. |
| `stacks doctor --stack <stack>` | Add definition, component-binding, and Stack-specific integration diagnostics. It is not part of routine Stack health checks. |
| `stacks init --namespace <namespace> --name <name> [--root <dir>]` | Create a legacy directory-based manifest. New Stacks should use `stack create`. |

Explicit `--root /path/to/stack` remains supported for checked-in examples and migration. In that mode Stacks searches for `stack.json`, `stack.yaml`, or `stack.yml`, and relative component paths resolve under the manifest directory. Stacks never enters this mode merely because the current directory contains—or does not contain—a manifest.

## Repository checks

For contributors to Stacks itself, `npm run check` runs documentation checks, tests, strict types, the core and static Vite builds, and a clean temporary installation test. `npm run check:docker` repeats the checks in clean Node 22 Linux userspace. These are development commands, not part of using an installed Stack.
