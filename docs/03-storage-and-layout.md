# Storage and component layout

## Platform locations

Stacks uses lowercase platform-native application directories:

| Platform | Config | State |
| --- | --- | --- |
| Linux | `$XDG_CONFIG_HOME/stacks` or `~/.config/stacks` | `$XDG_STATE_HOME/stacks` or `~/.local/state/stacks` |
| macOS | `~/Library/Application Support/stacks` | `~/Library/Application Support/stacks/state` |
| Windows | `%APPDATA%\stacks` | `%LOCALAPPDATA%\stacks` |

`STACKS_CONFIG_HOME` and `STACKS_STATE_HOME` provide explicit overrides for tests or controlled deployments.

## Data classes

The config directory contains a catalog, readable definitions, and machine-local component bindings. Definitions contain identity, graph relationships, and context declarations. Bindings map component IDs to absolute directories and are separate because machines arrange repositories differently.

The state directory contains append-only events, observed lock snapshots, caches, and future indexes. Credentials do not belong in either committed definitions or rendered UI data.

## No required Stack directory

A Stack is a registered graph, not a parent directory. A developer may choose this layout:

```text
projects/
  product/
  shared-ui/
  engineering-standards/
```

or put those repositories anywhere else. Each registration supplies its actual path. Git components also require a destination path; Stacks never invents a hidden checkout location. The same directory may participate in multiple Stacks, and Stacks records no ownership marker inside it.

Knowledge, rules, and standards are normal components—often `kind: knowledge`—and may be independent Git repositories or existing local directories. Their capabilities and exported resources determine how agents see them.

## Git and lock semantics

`stacks component add ... --git <url> --path <dir>` clones only when the explicit destination is absent. Existing repositories are inspected. `sync --update` may fetch but does not merge, rebase, reset, clean, or move work.

Lock files are observations of remote, branch, commit, and dirty state. They are not checkout enforcement.

## Legacy directory manifests

Relative path sources, `workspace.directory`, `.stack-workspace`, `.stacks`, and root-level lock files remain supported for checked-in examples and older Stack manifests. They are compatibility behavior, not the default architecture for newly registered Stacks.
