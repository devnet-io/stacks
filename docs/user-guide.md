# Using Stacks

This guide documents commands available in the current source checkout. A globally published package and `stacks ui` command are not available yet.

## Run from source

```bash
npm install
npm run check
node --experimental-strip-types src/cli.ts validate --root examples/foundation-stack
node --experimental-strip-types src/cli.ts context product --root examples/foundation-stack
```

The CLI searches upward for `stack.json`, so `--root` is optional when the current directory is already inside a Stack.

## Structured output contract

Pass `--json` to any CLI operation when another program or agent will consume the result. Structured output is written to stdout as one JSON document; diagnostics and failures use stderr. Each current output includes `schemaVersion: "0.1"`.

The management commands use these stable top-level shapes:

| Command | Top-level fields |
| --- | --- |
| `init --json` | `schemaVersion`, `stack`, `manifestPath` |
| `validate --json` | `schemaVersion`, optional `stack`, `manifestPath`, `valid`, `errors`; exits `2` when invalid |
| `status --json` | `schemaVersion`, `stack`, `components` |
| `sync --json` | `schemaVersion`, `stack`, `results` |
| `lock --json` | `schemaVersion`, `stack`, `lockPath` |

`stack` is `{ "id", "namespace", "name" }`: automation should persist the immutable `id` and display `namespace/name`. `context --json` returns the versioned context-plan DTO; check-in and usage-record operations return the versioned event DTO; `usage report --json` returns the versioned usage-report DTO. Local paths are absolute where the result describes this machine's materialized workspace.

Validation syntax and structural failures remain JSON documents on stdout when `--json` is selected, so callers can inspect `errors` even though the process exits `2`. These shapes are exercised end to end by `test/cli-json.test.ts`. Add a new schema version before making an incompatible change; do not silently repurpose fields within version `0.1`.

## Declare a Stack

```bash
node --experimental-strip-types src/cli.ts init --namespace my-team --name my-stack --root ../my-stack
```

Edit the generated `stack.json`, add components and capability relationships, then run `validate`, `sync --dry-run`, `sync`, `status`, and `context <target>`.

## Use MCP locally

The current MCP server is scoped to one Stack:

```bash
node --experimental-strip-types src/cli.ts mcp --root /path/to/stack
```

Configure an MCP host to launch that command for the Stack. A hosted Streamable HTTP MCP adapter is proposed but not implemented.

## View the local web workspace

Start the complete local control plane for the Stack containing the current directory:

```bash
npm run dev:web
```

Equivalently, run the CLI directly and select a Stack root:

```bash
node --experimental-strip-types src/cli.ts ui --root /path/to/stack
```

The command starts a read-only local API on `127.0.0.1:3210` and the web client on `localhost:3000`, then prints the exact URL. Use `--api-port` and `--port` to change those ports. `--api-only` is available for frontend development. Both servers remain bound to loopback; requests cannot select a different Stack root.

The Overview section shows live component readiness, dirty/missing/issue counts, revisions, access mode, and resolved workspace paths. Refresh is read-only. It includes loading, disconnected, stale-refresh, empty Stack, and populated states. The Documentation section continues to render canonical repository Markdown. Graph, Activity, CLI & MCP, and Hosted Adapter remain visibly unavailable rather than exposing partial behavior.

### Local HTTP contract

`GET /api/v0.1/overview` returns the contract in `schemas/http-overview.schema.json`. `GET /api/v0.1/health` reports API availability. Other methods are rejected, responses are not cached, and browser access is granted only to loopback HTTP origins. The API is scoped when the process starts; query parameters cannot redirect it to arbitrary filesystem paths.

## Documentation contract

Product, current architecture, user guides, RFCs, and delivery evidence are labeled separately. The web UI renders canonical Markdown from `docs/`; do not maintain a second copy of documentation in UI components.
