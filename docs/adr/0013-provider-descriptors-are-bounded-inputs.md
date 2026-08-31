# ADR 0013: provider descriptors are bounded component-owned inputs

- Status: accepted
- Date: 2026-08-31

## Context

Reusable components need a portable way to publish the capabilities and small usage resources they own. Repeating those exports in every Stack creates drift, but allowing a repository file to redefine Stack identity, consumer relationships, bindings, or policy would make untrusted component data authoritative over composition.

## Decision

A bound component may optionally publish `.stack/component.json`. Version `0.1` contains only `schemaVersion` and a bounded `provides` array using the existing capability-export and context-path shapes. It cannot declare component identity, local paths, consumers, dependencies, guidance, agent instructions, commands, or executable hooks.

Stacks reads the fixed file only inside an explicitly bound component root. The descriptor is limited to 64 KiB, 100 capabilities, and 20 context paths per capability. It is strict JSON, rejects unknown fields, duplicate capabilities, absolute or lexically escaping context paths, and descriptor symlinks that resolve outside the component root. Later context materialization performs its existing canonical-path, regular-text-file, and byte-budget checks.

The descriptor is a provider-owned base layer. An explicit Stack `provides` entry with the same capability replaces the complete descriptor entry. Consumer requirements remain Stack-owned and explicit; publishing a capability does not connect it to any consumer. Invalid or unreadable descriptors contribute nothing, remain visible through descriptor provenance and status diagnostics, and never invalidate or overwrite the durable Stack definition.

Descriptor changes are repository changes, not silent Stack-definition mutations and not automatic Stacks Activity events. Participating provider work records those changes through the normal work/turn protocol.

## Consequences

- Reusable providers can publish bounded self-description once in ordinary Git-readable data.
- A Stack can pin or replace provider claims without editing the component repository.
- Graph and context resolution use one effective view while `stack_get` preserves both the declared manifest and the composed effective manifest.
- Stacks gains no plugin execution, generalized discovery, consumer auto-wiring, or repository mutation behavior.
