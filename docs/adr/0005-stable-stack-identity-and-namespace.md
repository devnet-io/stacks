# ADR-0005: Stable Stack identity and readable namespace

Status: Accepted and implemented

## Context

The spike used `metadata.name` as the event and context `stackId`. Names are editable and collide across people and organizations. Local and future hosted adapters need identity that survives moves, renames, and registration in different environments.

## Decision

Every manifest requires:

- `metadata.id`: immutable opaque machine identity;
- `metadata.namespace`: portable readable grouping;
- `metadata.name`: readable Stack name within the namespace.

The readable reference is `namespace/name`. Events, locks, context plans, and structured adapter output use `metadata.id` as `stackId`. A future hosted tenant or account is authorization scope and does not replace the portable namespace.

## Consequences

Existing pre-release manifests must add an ID and namespace. `stacks init` generates the ID and requires an explicit namespace. Moving a Stack does not change identity. Renaming it changes its readable address but not event ownership.
