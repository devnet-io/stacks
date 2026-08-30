# Get started with Stacks

Stacks gives related repositories and knowledge one shared, named map. It does not move those repositories, merge them, build them, or run agents.

## 1. Install the development build

```bash
git clone https://github.com/devnet-io/stacks.git
cd stacks
npm install
npm run install:local
stacks --help
```

The installer builds and packs a self-contained snapshot into npm's machine-level package storage. It does not link to the clone, so you may move or delete the clone afterward. Run the command again only when you want to install a newer snapshot of Stacks.

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

The UI is global. It normally opens at `http://localhost:3210/`; if that port belongs to another application, Stacks selects the next free port and prints the URL. The packaged UI and local API share that one address, so there is no API URL to configure. Choose a Stack in the selector, then use Overview, Graph, Activity, Manage, Tools & agents, or Documentation. Activity shows agent check-ins, work sessions, token usage, and provenance-labeled costs. Manage can create Stacks, add components, and change bindings. No background service is required outside the time you use the UI.

## 5. Connect an agent

Connect Codex once:

```bash
codex mcp add stacks -- stacks mcp
```

This is a stdio MCP adapter. Codex launches it as a subprocess when needed and communicates over stdin/stdout, so there is no MCP URL, token, fixed port, or daemon for local use. The server supplies operating instructions during initialization; agents can also call `instructions_get` or read `stacks://instructions`, `stacks://reference/mcp`, and `stacks://reference/cli`. Tools such as `stack_status` and `context_resolve` take a Stack selector.

For direct CLI use:

```bash
stacks context app --stack your-name/my-stack --task "Describe the change I am about to make"
```

## What is editable today?

The CLI and Manage UI create Stacks and attach components. Capability exports, requirements, guidance, and richer metadata are still edited in the readable definition file shown by Overview. The UI does not yet provide those richer definition forms. Directory-based `stack.json` examples remain available as compatibility fixtures, but they are not the recommended setup for a new Stack.

To version or move a definition, export it, commit or transfer that JSON, register it on another machine, then bind each component to that machine's directory:

```bash
stacks stack export your-name/my-stack --to my-stack.json
stacks stack register my-stack.json
stacks component bind your-name/my-stack app --path /path/on/this/machine/app
```

The immutable Stack ID survives this process; absolute component paths do not travel in the definition.

Run `stacks help` for the short command list, `stacks help commands` for every command, or `stacks help <command>` for focused usage.
