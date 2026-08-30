# Stacks operation protocol

## Discovery and read operations

| Intent | MCP | CLI |
|---|---|---|
| Read effective Stack | `stack_get` or `stack://manifest` | inspect `stack.json`; `stacks validate` |
| Inspect component state | `stack_status` | `stacks status` |
| Resolve target context | `context_resolve` or `stack://context/{target}` | `stacks context <target> --task "..." --json` |
| Read one declaration | `stack://component/{id}` | inspect the matching manifest component |
| Aggregate usage | `usage_report` | `stacks usage report --json` |

## Work lifecycle

### Start

MCP: `work_start`

CLI:

```bash
stacks checkin start \
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
stacks sync --dry-run
stacks sync
stacks sync --update
stacks lock
```

`--update` fetches. It must not merge, rebase, reset, clean, or discard dirty work.
