# Foundation Stack example

This example uses path-backed components so every command works without network access. Replace each `source` with a Git source when declaring the first real Stack.

Try:

```bash
node --experimental-strip-types ../../src/cli.ts validate
node --experimental-strip-types ../../src/cli.ts context product
node --experimental-strip-types ../../src/cli.ts checkin start --component product --summary "Inspect product context" --agent codex --client codex-cli
```
