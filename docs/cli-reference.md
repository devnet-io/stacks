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

The Stack receives an immutable ID. The namespace and name remain its human-readable selector. Success appends a `stack.created` Activity event attributed to `stacks-cli`.

### `stacks stack list`

Lists registered Stacks in the machine catalog.

```text
stacks stack list [--json]
```

```bash
stacks stack list --json
```

## Components

### `stacks component list`

Lists every effective component in one Stack with its kind, explicit local binding, and structured provider-descriptor provenance under `--json`.

```text
stacks component list <namespace/name> [--json]
```

```bash
stacks component list acme/customer-portal --json
```

### `stacks component get`

Returns one effective component declaration plus its machine-local binding and provider-descriptor report. Human output identifies descriptor status and any applied or Stack-overridden capabilities; `--json` includes the fixed path, `absent|valid|invalid|unavailable` status, published/applied/overridden capability lists, and validation errors.

```text
stacks component get <namespace/name> <id> [--json]
```

```bash
stacks component get acme/customer-portal shared-ui --json
```

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

`--path` is always required. Without `--git`, the directory must exist. `--kind` is optional and defaults to the extensible label `component`; capabilities describe functional behavior. Stacks never adds a membership marker or Git submodule. Success appends a `component.added` Activity event attributed to `stacks-cli`.

### `stacks component bind`

Binds an existing component definition to a different explicit directory on this machine.

```text
stacks component bind <namespace/name> <id> --path <directory> [--json]
```

```bash
stacks component bind acme/customer-portal app --path /work/customer-portal
```

For a Git component, a missing bound destination may be cloned. Existing repositories are inspected conservatively. A changed path appends a `component.binding.changed` Activity event attributed to `stacks-cli`; rebinding to the same path does not add a duplicate.

### `stacks component provide`

Upserts one capability exported by a component. An optional component-relative context path identifies the bounded guide or index that explains how consumers should use it.

```text
stacks component provide <namespace/name> <id> <capability>
  [--context <path>] [--description <text>]
  [--strength required|preferred|reference] [--priority <number>] [--json]
```

```bash
stacks component provide acme/customer-portal shared-ui ui.react.components --context docs/components.md --strength required
```

Saving the same component and capability replaces that export instead of creating a duplicate. A state change writes only the portable Stack definition and appends a `component.configuration.changed` event; an identical upsert is an event no-op. It never modifies the component repository.

An explicit Stack export also replaces the complete provider-owned `.stack/component.json` entry for the same capability. Other valid descriptor exports remain effective. See [Provider-owned component descriptors](user-guide.md#provider-owned-component-descriptors).

### `stacks component consume`

Upserts one capability requirement. `--from` identifies the authoritative provider; without it context resolution succeeds only when exactly one provider exists.

```text
stacks component consume <namespace/name> <id> <capability>
  [--from <component-id>] [--optional] [--json]
```

```bash
stacks component consume acme/customer-portal app ui.react.components --from shared-ui
```

### `stacks component guidance`

Upserts one component-relative guidance path. The path remains ordinary repository content; Stacks stores only its descriptor and never creates or edits the file.

```text
stacks component guidance <namespace/name> <id> --path <path>
  [--description <text>] [--strength required|preferred|reference]
  [--priority <number>] [--applies-to <capability-a,capability-b>] [--json]
```

```bash
stacks component guidance acme/customer-portal standards --path engineering.md --strength required
```

## Inspection and context

### `stacks locate`

Finds Stack relationships for the supplied directory and defaults to the current directory. A direct result has `relationship: "component"` and means the path is the component root or lies inside it. When no direct result exists, Stacks returns descendant bindings with `relationship: "ancestor"`, meaning the queried workspace contains those components rather than belonging to any one of them. Multiple results are never auto-selected.

```text
stacks locate [directory] [--json]
```

```bash
stacks locate
stacks locate /work/customer-portal/src --json
```

Output includes `resolution: "component" | "ancestor" | "none"`. Direct matches take precedence, so opening one component does not also return unrelated sibling components merely because their common parent is an ancestor. This command is read-only. A zero-match result is successful discovery with an empty `memberships` array; it does not guess from repository names or write membership markers.

## Agent activation

### `stacks agent print`

Prints the current managed Stacks activation block without reading or writing a repository.

```text
stacks agent print [--path <directory>] [--json]
```

### `stacks agent check`

Reports whether the repository `AGENTS.md` contains the current managed block. Status is `current`, `stale`, or `absent`; stale or absent exits with code `2`.

```text
stacks agent check [--path <directory>] [--json]
```

### `stacks agent install`

Adds or refreshes only the content between the Stacks markers in `AGENTS.md`. It preserves existing instructions and line endings, creates `AGENTS.md` when absent, refuses malformed or repeated markers, refuses a symlinked `AGENTS.md`, and writes replacements atomically.

```text
stacks agent install [--path <directory>] [--json]
```

```bash
cd /work/customer-portal
stacks agent install --path .
```

The block tells an agent to discover membership, resolve ambiguity, inspect the selected component, and resolve bounded context. It does not hard-code a Stack because one repository may participate in multiple Stacks.

### `stacks agent remove`

Removes only the delimited Stacks block. It never deletes `AGENTS.md` or changes repository-owned instructions outside the block.

```text
stacks agent remove [--path <directory>] [--json]
```

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

Builds a deterministic, provenance-rich context plan and safely materializes its declared regular text files into a bounded briefing. It never searches undeclared repository contents or executes discovered content.

```text
stacks context <target-component> (--stack <namespace/name> | --root <directory>)
  [--task <description>] [--mode orientation|refresh]
  [--max-bytes <1..262144>] [--json]
```

```bash
stacks context app --stack acme/customer-portal --task "Add account recovery" --max-bytes 32768 --json
```

`orientation` is the default and uses 32 KiB unless overridden; `refresh` defaults to 8 KiB. Selection ranks required guidance first, then task matches within the same strength, declared priority, target locality, and stable ties. Output includes materialized content, content/source byte counts, hashes, truncation state, provenance, explicit omissions, and a briefing digest. The hard byte budget is exact; Stacks does not claim model-specific token precision. The command exits with code `2` when the plan contains resolution errors such as missing or ambiguous providers.

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

Starts one logical unit of work and returns its `sessionId`. The identifier does not represent an entire agent chat or one response. Reuse it across clarifications, retries, and turns while the same work remains active; one chat may contain multiple logical work items.

```text
stacks checkin start (--stack <namespace/name> | --root <directory>)
  --component <id> --summary <text>
  [--work <external-id>] [--agent <name>] [--client <name>] [--model <name>] [--json]
```

```bash
stacks checkin start --stack acme/customer-portal --component app --summary "Implement account recovery" --agent codex --json
```

### `stacks checkin turn-start`

Opens one turn in an active session and returns its `turnId` plus the target component's current plan and materialized briefing.

```text
stacks checkin turn-start (--stack <namespace/name> | --root <directory>)
  --session <id> --task <text> [--max-bytes <1..262144>] [--json]
```

```bash
stacks checkin turn-start --stack acme/customer-portal --session <id> --task "Add account recovery" --json
```

Only one turn may be open in a session. The first turn receives a 32 KiB orientation by default; later turns receive an 8 KiB refresh. `--max-bytes` overrides that turn's default. The task and materialized contents remain transient. Activity records only the briefing digest, mode, budget/count evidence, and existing plan counts.

### `stacks checkin turn-complete`

Closes one started turn and optionally records known telemetry in the same logical operation.

```text
stacks checkin turn-complete (--stack <namespace/name> | --root <directory>)
  --session <id> --turn <id> --summary <text>
  [--status progress|blocked|failed|complete] [--files <comma-separated-paths>]
  [--next <text>]
  [--provider <name> --model <name>]
  [--input <tokens>] [--output <tokens>] [--cached-input <tokens>]
  [--reasoning <tokens>] [--tool-calls <count>] [--duration-ms <milliseconds>]
  [--amount <number> --currency <code> --cost-kind reported|estimated|allocated]
  [--pricing-reference <text>] [--note <text>] [--json]
```

```bash
stacks checkin turn-complete --stack acme/customer-portal --session <id> --turn <turn-id> --summary "Added recovery request flow" --status progress --files "src/recovery.ts,test/recovery.test.ts" --next "Add delivery adapter" --provider openai --model gpt-5 --input 1200 --output 340 --json
```

### `stacks checkin complete`

Appends the final outcome for logical work. Call it only when that work is actually finished, not automatically at the end of every agent response. It refuses completion while a turn remains open.

```text
stacks checkin complete (--stack <namespace/name> | --root <directory>)
  --session <id> --summary <text>
  [--outcome success|partial|failed|cancelled] [--remaining <comma-separated-items>] [--json]
```

```bash
stacks checkin complete --stack acme/customer-portal --session <id> --summary "Account recovery verified" --outcome success --json
```

## Cross-component capability requests

Requests record missing shared capabilities and their evidence without assigning or scheduling provider work. Creation requires active logical work owned by the requester. All changes append events; `provider-complete` remains distinct from `consumer-verified`.

### `stacks request list`

Lists up to 50 requests, newest update first. `--component` matches either requester or provider; `--status` filters the current projected state.

```text
stacks request list --stack <namespace/name> [--component <id>] [--status <status>] [--json]
```

### `stacks request get`

Returns one request, originating work session, current state, newest-first transitions, evidence, and sanitized linked events. Read-only.

```text
stacks request get <request-id> --stack <namespace/name> [--json]
```

### `stacks request create`

Creates a stable request linked to active requester work. The requester and provider must be distinct registered components.

```text
stacks request create --stack <namespace/name>
  --requester <component> --provider <component> --session <active-session>
  --capability <name> --reason <text> [--acceptance <text>]
  [--agent <name>] [--client <name>] [--model <name>] [--json]
```

```bash
stacks request create --stack acme/customer-portal --requester app --provider shared-ui --session <id> --capability ui.dialog --reason "Avoid a product-local dialog" --acceptance "Accessible export and usage guide" --json
```

Non-idempotent. Inspect existing requests before retrying an uncertain call.

### `stacks request transition`

Appends a role-checked transition and optional evidence. Providers use `in-progress` and `provider-complete`; requesters use `consumer-verified` or `superseded`. Either party may reject. A requester may return provider-complete work to `in-progress` when verification finds more provider work is necessary. Verified, rejected, and superseded requests are terminal.

```text
stacks request transition <request-id> --stack <namespace/name>
  --component <acting-component>
  --status in-progress|provider-complete|consumer-verified|rejected|superseded
  --summary <text> [--evidence <text>]
  [--agent <name>] [--client <name>] [--model <name>] [--json]
```

```bash
stacks request transition <request-id> --stack acme/customer-portal --component shared-ui --status provider-complete --summary "Dialog exported and documented" --evidence "shared-ui@abc123" --json
```

## Usage events and reports

### `stacks usage import`

Imports delayed provider, model, token, duration, tool-call, and monetary usage facts that were not available at live turn completion. Normal participating agents supply known telemetry to `stacks checkin turn-complete`. Unknown values should be omitted rather than guessed.

```text
stacks usage import (--stack <namespace/name> | --root <directory>)
  --provider <name> --model <name>
  [--session <id>] [--turn <id>]
  [--component <id>] [--work <external-id>]
  [--input <tokens>] [--output <tokens>] [--cached-input <tokens>]
  [--reasoning <tokens>] [--tool-calls <count>] [--duration-ms <milliseconds>]
  [--amount <number> --currency <code> --cost-kind reported|estimated|allocated]
  [--pricing-reference <text>] [--note <text>]
  [--agent <name>] [--client <name>] [--json]
```

```bash
stacks usage import --stack acme/customer-portal --session <id> --turn <turn-id> --provider openai --model gpt-5 --input 1200 --output 340 --amount 0.02 --currency USD --cost-kind reported --pricing-reference "provider usage export" --json
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

Without a Stack selector, reports the installed runtime and complete MCP tool/resource contract. Add a selector for Stack definition, component binding, CLI entrypoint, and integration checks. It is for installation and adapter troubleshooting; routine Stack health uses `status`.

```text
stacks doctor [--stack <namespace/name> | --root <directory>] [--json]
```

```bash
stacks doctor
stacks doctor --stack acme/customer-portal
```

Stacks can report what its installed server advertises, but it cannot inspect the callable-tool registry already loaded inside an agent client. Fully restart Codex after registering Stacks or installing a version that changes MCP tools.

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
