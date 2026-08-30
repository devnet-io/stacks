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

During repository development:

```bash
npm run dev:web
```

The first UI slice renders the Stacks documentation library. Live component management, context inspection, activity, and an installed `stacks ui` launcher remain in progress.

## Documentation contract

Product, current architecture, user guides, RFCs, and delivery evidence are labeled separately. The web UI renders canonical Markdown from `docs/`; do not maintain a second copy of documentation in UI components.
