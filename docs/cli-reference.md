# CLI command reference

This is the complete reference for the currently implemented `stacks` command. For a first-use sequence, see [Getting started](getting-started.md). For agent tools, see the [MCP reference](mcp-reference.md).

## Conventions

- Registered Stacks are selected as `namespace/name` with `--stack` or as the positional Stack argument used by `stack` and `component` commands.
- New workflows use the machine-level catalog. Single-Stack commands require `--stack <namespace/name>`. `--root <directory>` remains available only when explicitly supplied for legacy directory manifests; Stacks never discovers a manifest from the current directory by default.
- Commands that support `--json` write one versioned JSON document to stdout. Human diagnostics and MCP protocol diagnostics never share structured stdout.
- Exit code `0` means success, `1` means an invocation or runtime error, and `2` means the command completed with validation, context, or synchronization failures.
- Paths may be relative to the current shell directory. Use native Windows paths in PowerShell or Command Prompt; Unix single-quote examples are not Windows syntax.

## Help

### `stacks help`

Shows the small everyday command surface.

```bash
stacks help
stacks help commands
stacks help component
```

`help commands` lists every command group. `help <command>` explains one group. `--help` and `-h` are aliases for the short help.

### `stacks --version`

Prints the product version from the root npm package and exits.

```bash
stacks --version
```

The same version appears in the UI application menu and the local health response.

## Stack catalog

### `stacks stack create`

Creates a readable Stack definition and machine-local catalog entry. It does not create a project directory.

```text
stacks stack create <namespace/name> [--json]
```

```bash
stacks stack create acme/customer-portal
```

The Stack receives an immutable ID. The namespace and name remain its human-readable selector.

### `stacks stack list`

Lists registered Stacks in the machine catalog.

```text
stacks stack list [--json]
```

```bash
stacks stack list --json
```

### `stacks stack register`

Imports a portable JSON definition into this machine's Stack catalog. “Register” means “make this definition known to the local catalog”; it does **not** register a Git repository, publish anything, contact GitHub, or import another machine's component paths.

```text
stacks stack register <definition.json> [--json]
```

```bash
stacks stack register ./customer-portal.stack.json
```

The normal source is `stacks stack export` on another installation or a definition file retrieved from version control. Registration copies and validates the definition, preserves its immutable Stack ID and readable `namespace/name`, creates an empty machine-local bindings record, and rejects an ID or selector already present in the catalog. Bind every imported component on the new machine with `component bind`.

This is the low-level manual portability primitive. The planned Git-backed Collections workflow will eventually provide a higher-level way to synchronize groups of definitions; it will build on rather than change Stack identity.

### `stacks stack export`

Writes the portable definition without machine-local bindings.

```text
stacks stack export <namespace/name> --to <definition.json> [--json]
```

```bash
stacks stack export acme/customer-portal --to ./customer-portal.stack.json
```

## Components

### `stacks component add`

Adds a component definition and an explicit machine-local path. Existing directories are inspected; Git components may be cloned only into the requested missing path.

```text
stacks component add <namespace/name> <id> --path <directory>
  [--git <url>] [--kind <kind>] [--name <display-name>] [--json]
```

```bash
stacks component add acme/customer-portal app --path /work/customer-portal --kind product
stacks component add acme/customer-portal standards --path /work/engineering-standards --git https://github.com/acme/engineering-standards.git --kind knowledge
```

`--path` is always required. Without `--git`, the directory must exist. Stacks never adds a membership marker or Git submodule.

### `stacks component bind`

Binds an existing component definition to its explicit directory on this machine. This is normally used after `stack register`.

```text
stacks component bind <namespace/name> <id> --path <directory> [--json]
```

```bash
stacks component bind acme/customer-portal app --path /work/customer-portal
```

For a Git component, a missing bound destination may be cloned. Existing repositories are inspected conservatively.

## Inspection and context

### `stacks status`

With no selector, loads every registered Stack and reports component paths, existence, Git revision, remote, dirty state, and issues. `--stack` narrows the result to one registered Stack. Explicit `--root` inspects one legacy directory manifest. It never changes component repositories.

```text
stacks status [--stack <namespace/name> | --root <directory>] [--json]
```

```bash
stacks status
stacks status --stack acme/customer-portal
```

### `stacks context`

Builds a deterministic, provenance-rich context plan for one target component. It reports selected guidance, provider chains, warnings, and errors; it does not concatenate every repository or execute discovered content.

```text
stacks context <target-component> (--stack <namespace/name> | --root <directory>)
  [--task <description>] [--json]
```

```bash
stacks context app --stack acme/customer-portal --task "Add account recovery" --json
```

The command exits with code `2` when the plan contains resolution errors such as missing or ambiguous providers.

## Repository synchronization

### `stacks sync`

Inspects every component and may clone or fetch Git repositories. It never merges, rebases, resets, cleans, force-checks out, moves, or overwrites dirty work.

```text
stacks sync (--stack <namespace/name> | --root <directory>)
  [--dry-run] [--update] [--json]
```

```bash
stacks sync --stack acme/customer-portal --dry-run
stacks sync --stack acme/customer-portal
stacks sync --stack acme/customer-portal --update
```

- Default behavior clones missing Git components and inspects existing destinations.
- `--dry-run` reports intended actions without cloning or fetching.
- `--update` fetches existing Git remotes without changing the checked-out branch or worktree.

### `stacks lock`

Writes `stack.lock.json` with observed component revisions and status.

```text
stacks lock (--stack <namespace/name> | --root <directory>) [--json]
```

```bash
stacks lock --stack acme/customer-portal
```

The lock is an observation snapshot, not permission to reset repositories to those revisions.

## Local interfaces

### `stacks ui`

Starts the machine-level web UI and read-only API in one Node process.

```text
stacks ui [--port <number>] [--no-open]
```

```bash
stacks ui
stacks ui --port 4321 --no-open
```

Stacks prefers `http://localhost:3210/` and automatically tries successive ports when the default is occupied. An explicit `--port` must be available. The command remains in the foreground until interrupted.

### `stacks mcp`

Runs the machine-level MCP server over stdio.

```text
stacks mcp
```

```bash
codex mcp add stacks -- stacks mcp
```

An MCP client launches this command on demand. Do not start it as a daemon, and never redirect protocol stdout into human logs. See the [MCP reference](mcp-reference.md).

## Work lifecycle events

All check-in commands append events. They never rewrite prior history.

### `stacks checkin start`

Starts a work session and returns a `sessionId`.

```text
stacks checkin start (--stack <namespace/name> | --root <directory>)
  --component <id> --summary <text>
  [--work <external-id>] [--agent <name>] [--client <name>] [--model <name>] [--json]
```

```bash
stacks checkin start --stack acme/customer-portal --component app --summary "Implement account recovery" --agent codex --json
```

### `stacks checkin turn`

Appends one completed-turn checkpoint.

```text
stacks checkin turn (--stack <namespace/name> | --root <directory>)
  --session <id> --summary <text>
  [--status progress|blocked|failed|complete] [--files <comma-separated-paths>]
  [--next <text>] [--json]
```

```bash
stacks checkin turn --stack acme/customer-portal --session <id> --summary "Added recovery request flow" --status progress --files "src/recovery.ts,test/recovery.test.ts" --next "Add delivery adapter" --json
```

### `stacks checkin complete`

Appends the final outcome for a work session.

```text
stacks checkin complete (--stack <namespace/name> | --root <directory>)
  --session <id> --summary <text>
  [--outcome success|partial|failed|cancelled] [--remaining <comma-separated-items>] [--json]
```

```bash
stacks checkin complete --stack acme/customer-portal --session <id> --summary "Account recovery verified" --outcome success --json
```

## Usage events and reports

### `stacks usage record`

Appends known provider, model, token, duration, tool-call, and monetary usage facts for a session. Unknown values should be omitted rather than guessed.

```text
stacks usage record (--stack <namespace/name> | --root <directory>)
  --session <id> --provider <name> --model <name>
  [--component <id>] [--work <external-id>]
  [--input <tokens>] [--output <tokens>] [--cached-input <tokens>]
  [--reasoning <tokens>] [--tool-calls <count>] [--duration-ms <milliseconds>]
  [--amount <number> --currency <code> --cost-kind reported|estimated|allocated]
  [--pricing-reference <text>] [--note <text>]
  [--agent <name>] [--client <name>] [--json]
```

```bash
stacks usage record --stack acme/customer-portal --session <id> --provider openai --model gpt-5 --input 1200 --output 340 --amount 0.02 --currency USD --cost-kind reported --pricing-reference "provider usage export" --json
```

Whenever `--amount` is supplied, `--cost-kind` is required. Do not record raw prompts, completions, secrets, or source payloads.

### `stacks usage report`

Aggregates recorded usage by provider, model, component, token counts, and currency.

```text
stacks usage report (--stack <namespace/name> | --root <directory>) [--json]
```

```bash
stacks usage report --stack acme/customer-portal
```

## Troubleshooting and legacy manifests

### `stacks doctor`

Checks the Node runtime, installed CLI entrypoint, Stack definition, component bindings, and MCP setup. It is for installation and adapter troubleshooting; routine Stack health uses `status`.

```text
stacks doctor (--stack <namespace/name> | --root <directory>) [--json]
```

```bash
stacks doctor --stack acme/customer-portal
```

### `stacks validate`

Validates a registered, standalone, or legacy Stack definition. Registered Stacks are already validated whenever loaded.

```text
stacks validate (--stack <namespace/name> | --root <directory>) [--json]
```

```bash
stacks validate --root ./examples/foundation-stack --json
```

### `stacks init`

Creates a legacy directory-based `stack.json`. New user workflows should use `stack create`.

```text
stacks init --namespace <namespace> --name <name> [--root <directory>] [--json]
```

```bash
stacks init --namespace acme --name legacy-stack --root ./legacy-stack
```
