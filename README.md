# Stacks

Stacks is a portable, versioned composition and context layer for agent-assisted development.

A **Stack** is not merely a list of repositories and it is not a build system. It is an evolving, curated declaration of:

- what components belong to a body of work;
- what each component provides and consumes;
- which standards, preferences, examples, and implementation knowledge should guide agents;
- how local repositories are materialized;
- what agents are doing across the stack;
- how usage, cost, provenance, and adoption decisions are recorded.

The long-term idea is a stack that captures a particular view of how software should be built, from product repositories through reusable application patterns, primitive UI controls, infrastructure reference implementations, and eventually any lower layer worth making explicit. The model intentionally does not assume every stack is an npm workspace—or even that every component is software.

## The key separation

The Git-backed stack repository is the durable control plane. It contains the manifest, knowledge, policies, provenance, proposals, and optional lock snapshots.

Materialized component repositories and high-volume operational state are local by default:

```text
stack-repository/
  stack.json                  # portable declaration
  stack.lock.json             # optional reproducibility snapshot
  docs/                       # stack-owned knowledge and decisions
  proposals/                  # reviewed ingestion/adoption proposals
  .stack-workspace/           # cloned component repositories; ignored
  .stacks/                    # local events, sessions, indexes; ignored
```

SQLite is permitted later as a local index or cache. It should not become the only representation of the stack.

## What this starter includes

This archive is both a product brief and an executable seed:

- a deliberately small TypeScript core and CLI;
- a versioned `stack.json` manifest format plus JSON Schemas;
- safe component status and clone/fetch primitives;
- capability-based context resolution;
- append-only agent check-ins and usage events;
- an MCP stdio adapter using the 2026 MCP TypeScript SDK v2 surface;
- a reusable `stacks-workspace` agent Skill;
- an example foundational stack with standards, UI primitives, application patterns, Cloudflare references, and a product;
- a staged Codex implementation brief and acceptance criteria.

The repository also declares itself in the root [`stack.json`](stack.json). Resolving context for `stacks-core` therefore exercises the same component/capability model that the project is building; the implementation, agent Skill, and foundational example are not disconnected artifacts.

The code is an architectural spike, not a production release. Its purpose is to make the first decisions concrete enough for Codex to test, improve, and replace deliberately.

## Start here

```bash
npm install
npm test
npm run dev:web
npm run demo:self
npm run demo:validate
npm run demo:context
```

Then give Codex [`CODEX_START_HERE.md`](CODEX_START_HERE.md) as its initial brief. Codex also reads [`AGENTS.md`](AGENTS.md) automatically when operating in the repository.

The CLI can run directly on Node 22+ without a build for commands that do not require optional integrations:

```bash
node --experimental-strip-types src/cli.ts help
node --experimental-strip-types src/cli.ts validate --root examples/foundation-stack
node --experimental-strip-types src/cli.ts context product --root examples/foundation-stack
```

After a build:

```bash
node dist/cli.js init --namespace my-team --name my-first-stack --root ../my-first-stack
node dist/cli.js validate --root ../my-first-stack
node dist/cli.js mcp --root ../my-first-stack
```

## Declare a first Stack in about five minutes

The initializer creates a portable metadata repository without assuming an ecosystem:

```bash
node --experimental-strip-types src/cli.ts init \
  --namespace my-team \
  --name my-first-stack \
  --root ../my-first-stack
```

Create or clone the real component repositories, then edit `../my-first-stack/stack.json`. A minimal useful declaration looks like this:

```json
{
  "apiVersion": "stacks.dev/v0alpha1",
  "kind": "Stack",
  "metadata": {
    "id": "generate-with-stacks-init",
    "namespace": "my-team",
    "name": "my-first-stack",
    "description": "The standards, shared layers, references, and products I build together."
  },
  "workspace": {
    "directory": ".stack-workspace",
    "stateDirectory": ".stacks"
  },
  "context": {
    "always": [
      {
        "path": "STACK_GUIDE.md",
        "strength": "required",
        "priority": 1200
      }
    ]
  },
  "components": [
    {
      "id": "standards",
      "kind": "knowledge",
      "source": { "type": "git", "url": "git@github.com:you/standards.git" },
      "provides": [
        {
          "capability": "practice.software-development",
          "context": [{ "path": "README.md", "strength": "required" }]
        }
      ]
    },
    {
      "id": "product",
      "kind": "product",
      "source": { "type": "git", "url": "git@github.com:you/product.git" },
      "consumes": [
        { "capability": "practice.software-development", "from": "standards" }
      ],
      "guidance": [
        { "path": "AGENTS.md", "strength": "required", "priority": 1100 }
      ]
    }
  ]
}
```

Add `STACK_GUIDE.md`, then exercise the declaration before asking an agent to work:

```bash
node --experimental-strip-types src/cli.ts validate --root ../my-first-stack
node --experimental-strip-types src/cli.ts sync --root ../my-first-stack --dry-run
node --experimental-strip-types src/cli.ts sync --root ../my-first-stack
node --experimental-strip-types src/cli.ts status --root ../my-first-stack
node --experimental-strip-types src/cli.ts context product \
  --task "Describe the first product change" \
  --root ../my-first-stack
```

The Git URLs above are placeholders. For an immediately runnable declaration, copy and modify [`examples/foundation-stack`](examples/foundation-stack); the automated suite loads that exact example, verifies every component path, and resolves all context selected for its `product` component.

## Initial command surface

```text
stacks init --namespace <namespace> --name <name> [--root <dir>]
stacks validate [--root <dir>] [--json]
stacks status [--root <dir>] [--json]
stacks sync [--root <dir>] [--dry-run] [--update]
stacks lock [--root <dir>]
stacks context <target-component> [--task <text>] [--json]
stacks checkin start --component <id> --summary <text> [...]
stacks checkin turn --session <id> --summary <text> [...]
stacks checkin complete --session <id> --summary <text> [...]
stacks usage record --session <id> --provider <name> --model <name> [...]
stacks usage report [--root <dir>] [--json]
stacks mcp [--root <dir>]
```

## Product boundary

Stacks should remain useful even when no autonomous agent runtime is present. It supplies the environment, context graph, and observability protocol. It does not choose the next task, schedule agents, manage cloud runners, or replace the project management model.

That boundary is intentional. A separate agent orchestration system such as **Vaultar** can consume Stacks as a local/portable substrate. Optional hosted Stacks access may expose documentation, snapshots, and remote MCP without turning Stacks into Vaultar.

## Repository map

- [`docs/00-input-synthesis.md`](docs/00-input-synthesis.md): every major idea from the originating discussion and how it is represented.
- [`docs/README.md`](docs/README.md): documentation truth policy and index.
- [`docs/product.md`](docs/product.md): durable product definition.
- [`docs/architecture.md`](docs/architecture.md): current implemented architecture and limitations.
- [`docs/user-guide.md`](docs/user-guide.md): commands and procedures that work now.
- [`docs/project-status.md`](docs/project-status.md): evidence-backed delivery state.
- [`docs/01-vision-and-boundaries.md`](docs/01-vision-and-boundaries.md): product definition and non-goals.
- [`docs/02-domain-model.md`](docs/02-domain-model.md): entities, graph, and lifecycle.
- [`docs/03-storage-and-layout.md`](docs/03-storage-and-layout.md): Git, worktrees, local state, and lock snapshots.
- [`docs/04-context-resolution.md`](docs/04-context-resolution.md): how agents receive bounded, relevant context.
- [`docs/05-events-usage-and-analytics.md`](docs/05-events-usage-and-analytics.md): check-ins, cost, and analytics.
- [`docs/06-ingestion-and-evolution.md`](docs/06-ingestion-and-evolution.md): safe ingestion and cross-stack learning.
- [`docs/07-agent-interfaces.md`](docs/07-agent-interfaces.md): CLI, MCP, Skills, and Codex.
- [`docs/08-roadmap.md`](docs/08-roadmap.md): staged implementation plan.
- [`docs/09-open-questions.md`](docs/09-open-questions.md): decisions intentionally deferred.
- [`docs/10-validation-and-handoff.md`](docs/10-validation-and-handoff.md): verification performed on this starter and the remaining environment-dependent checks.
