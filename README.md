# Stacks

Stacks is a local-first, portable composition and context layer for software development. A Stack is a named graph of independent components—products, libraries, standards, reference implementations, tools, and knowledge—with explicit relationships and bounded guidance for people and agents.

Stacks is not a build system, package manager, task scheduler, or agent orchestrator. Component repositories keep their own locations and workflows. Stacks records what exists, how it relates, and what context matters.

## Try it

Install the development build once from this checkout:

```bash
npm install
npm run install:local
```

Create a globally registered Stack and attach an existing project directory:

```bash
stacks stack create your-name/my-stack
stacks component add your-name/my-stack app --path /path/to/app --kind product
stacks status --stack your-name/my-stack
stacks ui
```

On PowerShell or Command Prompt, use normal Windows paths without Unix-style single quotes:

```powershell
stacks component add your-name/my-stack app --path C:\Users\you\projects\app --kind product
```

`stacks ui` opens one local management interface for the machine catalog. Use the Stack selector to switch between registered Stacks; Activity shows agent work and usage, while Manage can create Stacks, add components, and change local bindings. The UI includes the same getting-started and reference documentation as this repository.

Connect Codex once for all registered Stacks:

```bash
codex mcp add stacks -- stacks mcp
```

Fully quit and reopen Codex after registration, and after installing a Stacks upgrade that changes MCP tools. Use `stacks doctor` to inspect the installed MCP contract.

The MCP adapter uses stdio: Codex launches it when needed, so it has no port or long-running daemon. It supplies agent instructions during initialization and exposes complete CLI/MCP reference resources. Stack-specific MCP tools require a `namespace/name` selector.

## Where data lives

There is no required Stack workspace directory. The global catalog uses lowercase platform-native application directories:

| Platform | Definitions and bindings | Operational state |
| --- | --- | --- |
| Linux | `$XDG_CONFIG_HOME/stacks` or `~/.config/stacks` | `$XDG_STATE_HOME/stacks` or `~/.local/state/stacks` |
| macOS | `~/Library/Application Support/stacks` | `~/Library/Application Support/stacks/state` |
| Windows | `%APPDATA%\stacks` | `%LOCALAPPDATA%\stacks` |

Stack definitions remain readable JSON. Machine-local bindings map each component ID to an explicit absolute path; they are separate because paths differ by computer. A directory may be attached to more than one Stack. Stacks does not write ownership markers into component repositories.

For a Git component, the destination is still explicit:

```bash
stacks component add your-name/my-stack standards \
  --git https://github.com/your-name/standards.git \
  --path /path/where/standards-should-live \
  --kind knowledge
```

If the directory is absent, Stacks clones there. If it exists, Stacks inspects it conservatively and never resets, cleans, or silently moves it.

Knowledge and engineering standards are ordinary components, usually with `kind: knowledge`. Their exported capabilities and guidance are what make them available through context resolution; they do not live in a magic Stack-owned folder.

## Everyday commands

```text
stacks stack create <namespace/name> [--json]
stacks stack list [--json]
stacks locate [directory] [--json]
stacks agent install --path .
stacks component list <namespace/name> [--json]
stacks component get <namespace/name> <id> [--json]
stacks component add <namespace/name> <id> --path <dir> [--git <url>] [--kind <kind>] [--name <name>] [--json]
stacks component bind <namespace/name> <id> --path <dir> [--json]
stacks status --stack <namespace/name> [--json]
stacks sync --stack <namespace/name> [--dry-run] [--update] [--json]
stacks context <target> --stack <namespace/name> [--task <text>] [--json]
stacks ui
stacks mcp
```

Run `stacks help commands` for the complete command surface, including event, usage, troubleshooting, and legacy commands. Registered Stacks are validated whenever they are loaded; `doctor` is reserved for explicit installation or adapter troubleshooting.

The checked-in root manifest and `examples/foundation-stack` remain directory-based fixtures for compatibility and dogfooding. Legacy `--root` commands still work, but new user Stacks should use the global catalog.

## Develop and verify

`npm run install:local` is idempotent: it builds a complete package, packs it, and installs that snapshot into npm's machine-level package storage. The installed CLI and built web UI do not link back to this checkout, so the clone may be moved or deleted afterward. Rerun the command when you want to install newer source changes. `npm run docs:check` audits documentation lifecycle coverage and relative links. `npm run check` includes that audit, initializes the packed MCP server and verifies its complete tool/resource contract, then starts the temporary packed web runtime. `npm run check:docker` repeats the gate in clean Node 22 Linux userspace.

Start with [Getting started](docs/getting-started.md), then see the [user guide](docs/user-guide.md), complete [CLI command reference](docs/cli-reference.md), complete [MCP server reference](docs/mcp-reference.md), [current architecture](docs/architecture.md), and [project status](docs/project-status.md).
