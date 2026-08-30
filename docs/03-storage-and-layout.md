# Storage and workspace layout

## Two classes of state

### Durable, reviewable state

Commit this when useful:

- `stack.json`
- `stack.lock.json`
- stack-owned docs and standards
- architecture decisions
- ingestion records and adoption proposals
- exported/sanitized activity summaries

### Local operational state

Ignore this by default:

- cloned external component repositories under `.stack-workspace/`
- `.stacks/events.jsonl`
- session pointers and temporary files
- indexes, caches, and future SQLite databases
- credentials and provider-specific telemetry payloads

This distinction preserves portability without turning normal agent activity into constant noisy commits.

## Default layout

```text
my-stack/
  stack.json
  stack.lock.json
  AGENTS.md
  docs/
  proposals/
  .stack-workspace/
    standards/.git/
    ui-primitives/.git/
    ui-patterns/.git/
    product-a/.git/
  .stacks/
    events.jsonl
    sessions/
    index.sqlite            # optional future derived index
```

A path-backed component may live inside the stack repository instead, which is useful for examples or a stack that is itself a monorepo.

## Why not Git submodules by default

Submodules are useful when a parent repository intentionally pins exact child commits as part of its source tree. Stacks also needs active, independently changing repositories, branch tracking, uncommitted work, and local overlays. Ordinary clones under an ignored workspace make that relationship less surprising.

Stacks can still snapshot observed commits in `stack.lock.json`. A future layout adapter may support submodules for stacks that genuinely want submodule semantics.

## Sync semantics

`stacks sync` is intentionally conservative:

- create the workspace directory;
- clone missing Git components;
- inspect existing components;
- with `--update`, fetch remotes but do not merge, rebase, reset, or clean;
- report remote mismatches and dirty state;
- never destroy local work.

A future explicit `stacks update` command may offer opt-in fast-forward behavior with a precise policy.

## Lock snapshots

`stack.lock.json` records observed source metadata such as remote URL, branch, commit, and dirty state. It is a reproducibility and review artifact, not a command to force every active repository to that state.

Reference/immutable components may later support enforceable pins. Active-development components generally need descriptive snapshots rather than coercive pins.

## SQLite policy

SQLite is appropriate for:

- indexing a large event stream;
- cached full-text search;
- precomputed usage aggregates;
- local concurrency and query performance.

It is not appropriate as the only home for manifests, standards, decisions, or adoption provenance. Any essential SQLite-held state needs a documented export format.
