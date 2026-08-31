# Get started with Stacks

Stacks gives related repositories and knowledge one shared, named map. It does not move those repositories, merge them, build them, or run agents.

## 1. Install the development build

```bash
git clone https://github.com/devnet-io/stacks.git
cd stacks
npm install
npm run install:local
stacks --help
stacks --version
```

The installer builds and packs a self-contained snapshot into npm's machine-level package storage. It does not link to the clone, so you may move or delete the clone afterward. Re-running it gracefully stops any registered Stacks UI process before replacement; run `stacks ui` again afterward if you want the UI running. `stacks --version` and the small application menu in the UI show the installed product version.

## 2. Create a Stack

You can run this from any directory; it does not create a sibling folder:

```bash
stacks stack create your-name/my-stack
```

The Stack is registered in the machine catalog under the lowercase platform application-data directories. Its definition is readable JSON, but the CLI is the normal management interface.

## 3. Attach existing components

Every component has an explicit local directory. Stacks does not require components to be children of a Stack folder.

```bash
stacks component add your-name/my-stack app --path /path/to/app --kind product
stacks component add your-name/my-stack standards --path /path/to/standards --kind knowledge
```

On Windows, use a normal Windows path:

```powershell
stacks component add your-name/my-stack app --path C:\Users\you\projects\app --kind product
```

To clone a Git repository into a location you choose:

```bash
stacks component add your-name/my-stack shared-ui \
  --git https://github.com/your-name/shared-ui.git \
  --path /path/to/shared-ui \
  --kind library
```

Local components must already exist. Git components may be cloned into a missing destination. The same directory may be attached to multiple Stacks; Stacks stores that mapping in its catalog and does not put a claim file in the repository.

## 4. Inspect and open it

```bash
stacks stack list
stacks status --stack your-name/my-stack
stacks ui
```

Loading a registered Stack validates its definition, so routine use does not require a separate validation command. `status` reports component paths and Git state without changing repositories.

The UI is global. It normally opens at `http://localhost:3210/`; if that port belongs to another application, Stacks selects the next free port and prints the URL. The packaged UI and local API share that one address, so there is no API URL to configure. Choose a Stack in the selector, then use Overview, Graph, Activity, Manage, Tools & agents, or Documentation. Activity shows Stack changes, configuration events, agent check-ins, work sessions, token usage, and provenance-labeled costs. Manage can create Stacks, add components, change bindings, and configure capability providers, consumer relationships, and component-relative guidance. No background service is required outside the time you use the UI.

## 5. Connect an agent

Connect Codex once:

```bash
codex mcp add stacks -- stacks mcp
```

Then fully quit and reopen Codex. Codex loads callable MCP tools when its host starts, so opening only a new task may retain an older registry after registration or an upgrade. Run `stacks doctor` to inspect the installed contract and use Codex's MCP settings or `/mcp` view to confirm that Stacks loaded.

This is a stdio MCP adapter. Codex launches it as a subprocess when needed and communicates over stdin/stdout, so there is no MCP URL, token, fixed port, or daemon for local use. The server supplies operating instructions during initialization; agents can also call `instructions_get` or read `stacks://instructions`, `stacks://reference/mcp`, and `stacks://reference/cli`. Start with `stack_memberships` for the current workspace. A direct `component` result identifies the current component. An `ancestor` result means the workspace contains descendant components, so choose the intended target explicitly; never guess among multiple results. After `work_start`, the first `turn_start` returns a bounded orientation briefing and later turns return compact refreshes. Review explicit omissions and close the returned `turnId` with `turn_complete`, including only telemetry the client actually knows.

For reliable repository-level activation, run this once inside each component where you want agents to consult Stacks automatically:

```bash
stacks agent install --path .
```

This adds only a delimited Stacks block to `AGENTS.md`; existing instructions remain owned by the repository. Use `stacks agent check --path .` to detect a missing or stale block and `stacks agent remove --path .` to remove only that block.

For direct CLI use:

```bash
stacks context app --stack your-name/my-stack --task "Describe the change I am about to make"
```

The command safely includes only declared regular text files, defaults to a 32 KiB hard content budget, and reports truncations or omissions. Use `--max-bytes` for a different budget; Stacks does not scan entire repositories.

## What is editable today?

The CLI, MCP, and Manage UI can configure the minimum context graph without editing catalog files directly. For example:

```bash
stacks component provide your-name/my-stack shared-ui ui.react.components --context docs/components.md --strength required
stacks component consume your-name/my-stack app ui.react.components --from shared-ui
stacks component guidance your-name/my-stack standards --path engineering.md --strength required
stacks context app --stack your-name/my-stack
```

These operations update readable portable definition data and never modify the referenced repository files. The current forms upsert one export per capability, one requirement per capability, and one guidance descriptor per path. Directory-based `stack.json` examples remain available as compatibility fixtures, but they are not the recommended setup for a new Stack.

To see whether the current directory is part of one or more Stacks:

```bash
stacks locate
```

Stacks returns every matching Stack and component instead of guessing. Cross-machine synchronization will be introduced with the planned Git-backed Collections workflow rather than an interim manual import/export interface.

Run `stacks help` for the short command list, `stacks help commands` for every command, or `stacks help <command>` for focused usage.
