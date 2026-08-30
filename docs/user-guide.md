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

The UI is machine-level. A subdued Stack selector sits directly below the sidebar header and applies to every operational section. Overview shows component health, Graph shows provider and dependency relationships, Activity shows append-only work sessions and provenance-labeled usage, Manage creates Stacks and configures components and bindings, Tools & agents contains runtime connection instructions, and Documentation renders every canonical Markdown file under `docs/`. The bottom application menu displays the installed version and reserves space for future account/settings controls. Installation instructions live in Documentation rather than the operational tabs.

Documentation is grouped by purpose. Selecting a document reveals its second- and third-level headings as nested navigation. The current section, document, and heading are encoded in the URL as `view`, `document`, and `heading`, so bookmarks and shared local links reopen the same location. Links between canonical Markdown documents remain inside the documentation interface.

Read-only endpoints:

- `GET /api/v0.1/stacks`
- `GET /api/v0.1/overview?stack=namespace/name`
- `GET /api/v0.1/activity?stack=namespace/name`
- `GET /api/v0.1/graph?stack=namespace/name`
- `GET /api/v0.1/integrations?stack=namespace/name`
- `GET /api/v0.1/health`

Contracts are stored in `schemas/http-overview.schema.json`, `schemas/http-graph.schema.json`, and `schemas/http-integrations.schema.json`. Canonical documentation remains in `docs/`; do not maintain a second copy in frontend components.

## Local MCP

```bash
codex mcp add stacks -- stacks mcp
```

Fully quit and reopen Codex after registration, and after installing any Stacks upgrade that changes MCP tools. A new task in the same desktop process may retain the old callable-tool registry. `stacks doctor` reports the contract built into the installed package; Codex's MCP settings or `/mcp` view reports what the client actually loaded.

`stacks mcp` uses stdio. The agent client launches it when needed and communicates through stdin/stdout, so local use has no URL, token, daemon, or port. Protocol diagnostics go to stderr.

`stacks agent print|check|install|remove` manages repository activation separately from the global MCP connection. Install and remove touch only the delimited Stacks block, preserve all other `AGENTS.md` content, refuse malformed markers and symlinks, and never hard-code one Stack selection.

`stack_memberships` accepts a workspace path and returns every matching Stack/component binding; `stack_list` remains the fallback when there is no match. `component_list`, `component_get`, `component_add`, and `component_bind` provide structured local component management. Selected-Stack, context, lifecycle, and usage tools require `stack: "namespace/name"`. Git cloning and synchronization are intentionally not exposed through MCP.

## Work and usage events

The Activity section presents these records without exposing the raw JSONL file. Its session and recent-event lists are each bounded to 100 records, while aggregate counts cover the complete readable event history. Independent local writers serialize appends with a per-Stack lock; earlier events are never rewritten.

| Command | Purpose |
| --- | --- |
| `stacks checkin start` | Append the start of a work session and return its session ID. |
| `stacks checkin turn` | Append a completed turn, status, changed paths, and next step. |
| `stacks checkin complete` | Append completion and outcome without rewriting earlier events. |
| `stacks usage record` | Append model/token/cost data for a session. |
| `stacks usage report --stack <stack>` | Aggregate recorded usage. |

Example:

```bash
stacks checkin start --stack my-team/my-stack --component app --summary "Starting change"
stacks checkin turn --stack my-team/my-stack --session <id> --summary "Implemented slice"
stacks checkin complete --stack my-team/my-stack --session <id> --summary "Verified" --outcome success
stacks usage report --stack my-team/my-stack
```

Usage amounts require `--cost-kind reported|estimated|allocated`.

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

## Repository quality gate

For contributors to Stacks itself, `npm run check` runs tests, strict types, the core and static Vite builds, and an isolated pack/install/start verification. `npm run check:docker` repeats the gate in clean Node 22 Linux userspace. These are development commands, not part of using an installed Stack.
