# ADR 0015: component IDs are stable while descriptive metadata is editable

## Status

Accepted and implemented.

## Decision

A component's `id` is its stable logical identity within one immutable Stack identity. The developer chooses it when adding the component. Stacks does not generate a second opaque component identifier, and it does not support renaming the ID after creation.

Bindings, capability relationships, component dependencies, requests, events, and work sessions refer to this ID. Renaming it in place would require an error-prone graph and history migration. Before a compatibility milestone, a mistaken ID can be corrected through an explicit remove-and-recreate workflow once component removal exists; Stacks must never silently rewrite historical identity.

Display name, description, kind, and access are editable portable metadata. A component's local directory remains separately editable through its machine binding. Source provenance is not bundled into metadata editing and may receive a dedicated validated operation if real workflows require it.

Capability requirements are required by default and may explicitly set `optional: true`. Missing or ambiguous required providers are context errors; optional ones are warnings. Both remain visible in structured context and Graph. Direct `dependsOn` relationships remain required in the current model rather than overloading their string representation with optionality.

## Consequences

- Human-readable component labels can evolve without breaking graph references or historical activity.
- CLI, MCP, HTTP, and Manage expose the same metadata-editing fields and immutable-ID boundary.
- The UI and Graph can explain required versus optional capability relationships consistently.
- Component ID renaming, source-provenance replacement, relationship removal, and optional direct dependencies are intentionally separate future operations.
