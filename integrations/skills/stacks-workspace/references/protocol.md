# Stacks operation protocol

## Discovery and read operations

| Intent | MCP | CLI |
|---|---|---|
| Read operating instructions | `instructions_get` or `stacks://instructions` | `stacks help commands` and `stacks help <command>` |
| List Stacks | `stack_list` or `stacks://catalog` | `stacks stack list --json` |
| Read effective Stack | `stack_get` with `stack` | No direct read-only equivalent; use `status` or `context` for the intended operation |
| Inspect component state | `stack_status` with `stack` | `stacks status --stack <namespace/name>` |
| Resolve target context | `context_resolve` with `stack` | `stacks context <target> --stack <namespace/name> --task "..." --json` |
| Aggregate usage | `usage_report` with `stack` | `stacks usage report --stack <namespace/name> --json` |

## Work lifecycle

### Start

MCP: `work_start`

CLI:

```bash
stacks checkin start \
  --stack <namespace/name> \
  --component <component-id> \
  --summary "<what is starting>" \
  --work <optional-external-id> \
  --agent <agent-name> \
  --client <client-name> \
  --model <model-name> \
  --json
```

Retain the returned `sessionId`.

### Turn checkpoint

MCP: `turn_complete`

CLI:

```bash
stacks checkin turn \
  --stack <namespace/name> \
  --session <session-id> \
  --summary "<what changed or was learned>" \
  --status progress \
  --files "path/a,path/b" \
  --next "<next action>" \
  --json
```

Use status `progress`, `blocked`, `failed`, or `complete`.

### Complete

MCP: `work_complete`

CLI:

```bash
stacks checkin complete \
  --stack <namespace/name> \
  --session <session-id> \
  --summary "<result>" \
  --outcome success \
  --remaining "<remaining item 1>,<remaining item 2>" \
  --json
```

Use outcome `success`, `partial`, `failed`, or `cancelled`.

## Usage

MCP: `usage_record`

CLI:

```bash
stacks usage record \
  --stack <namespace/name> \
  --session <session-id> \
  --provider <provider> \
  --model <model> \
  --input <tokens> \
  --output <tokens> \
  --cached-input <tokens> \
  --reasoning <tokens> \
  --tool-calls <count> \
  --duration-ms <milliseconds> \
  --amount <money> \
  --currency USD \
  --cost-kind reported \
  --pricing-reference "<invoice or price snapshot>" \
  --json
```

Omit fields the client does not know. Whenever `amount` is present, include `costKind`:

- `reported`: provider/client billing data;
- `estimated`: calculated from a documented pricing snapshot;
- `allocated`: a shared charge assigned by an explicit rule.

Do not include raw prompts, completions, secrets, or full source payloads in usage events.

## Repository materialization

Use the CLI, not MCP, for the initial mutation surface:

```bash
stacks sync --stack <namespace/name> --dry-run
stacks sync --stack <namespace/name>
stacks sync --stack <namespace/name> --update
stacks lock --stack <namespace/name>
```

`--update` fetches. It must not merge, rebase, reset, clean, or discard dirty work.
