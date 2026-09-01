# ADR 0014: capabilities may identify consumable artifacts

## Status

Accepted and implemented.

## Decision

A capability export may include an optional portable artifact identity: an extensible ecosystem name, artifact name, and component-relative artifact root. The first interpreted ecosystem is `npm`. The declaration says which package carries a capability; it does not select a registry, workspace layout, package manager, or installation command.

When a target consumes that capability, context resolution returns artifact guidance with the provider binding, resolved artifact root, and—only for npm-compatible packages—a machine-local `file:` dependency candidate derived from the consumer and provider bindings. The guidance orders strategies explicitly:

1. preserve established project configuration;
2. follow an existing workspace convention when provider and consumer participate in it;
3. use the organization's configured registry when applicable; and
4. use the derived local file dependency only as a development fallback.

Stacks does not edit a consumer manifest, invoke a package manager, run lifecycle scripts, publish packages, or decide whether independently bound repositories form a workspace. Agents and developers inspect the repositories and apply their normal tooling and authorization.

Provider-owned `.stack/component.json` files and explicit Stack capability exports use the same artifact shape. Existing complete-entry precedence remains unchanged: an explicit Stack export replaces the descriptor export for the same capability, including its artifact metadata.

## Consequences

- An agent can connect a capability to a real package without Stacks becoming a package manager.
- Arbitrary component directory layouts remain valid; machine paths stay outside portable definitions.
- npm, pnpm, Yarn, and Bun can all consume the `file:` candidate, but their copy/link and lifecycle behavior differs. Stacks describes the dependency and leaves execution to the detected project tool.
- Registry publication, package versions, non-npm ecosystems, and automatic workspace discovery remain later adapter work driven by real demand.
