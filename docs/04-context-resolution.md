# Context resolution

## Goal

An agent working on `product` should receive the relevant standards, usage guides, patterns, and references from the components it depends on—without loading every repository.

## Initial deterministic algorithm

Given a target component:

1. For legacy directory manifests, add stack-wide guidance. Registered Stacks model shared guidance as a knowledge component.
2. Add the target component’s own guidance.
3. Follow explicit `dependsOn` edges and add the depended-on component guidance.
4. For each capability requirement:
   - use the explicit `from` provider when specified;
   - otherwise require exactly one provider;
   - report a missing or ambiguous provider instead of guessing.
5. Add context paths exported for the matching capability.
6. Add relevant provider guidance.
7. Recursively resolve the provider’s own requirements.
8. Deduplicate items, sort by strength/priority/component/path, and report the selection reason and chain.

The current prototype produces a **context plan**. It does not concatenate file contents.

## Example chain

```text
product
  consumes ui.react.application-patterns from ui-patterns
    ui-patterns consumes ui.react.primitives from ui-primitives
      ui-primitives consumes practice.software-development from standards
```

The plan can therefore include:

- product-specific constraints;
- UI-pattern usage and implementation docs;
- primitive control API and composition rules;
- shared development standards;
- Cloudflare Worker/D1 reference patterns if the product explicitly consumes them.

## Why capabilities instead of only repository dependencies

A repository dependency says that code or artifacts are linked. A capability requirement says what knowledge or behavior matters to the target. The relationship can exist even when no package is imported—for example, a product consuming CI/CD standards or a reference architecture.

## Context path safety

A registered context path must resolve within its explicitly bound owning component root. Legacy directory manifests may additionally resolve stack-wide guidance inside their manifest root.

Readers must resolve real paths and reject symlink/path traversal escapes before returning file contents through MCP. Globs are plans, not permission to read outside the root.

## Bounded materialization (next step)

A future materializer should accept a byte/token budget and use this order:

1. required guidance;
2. target-local instructions;
3. direct capability exports;
4. transitive capability exports;
5. preferred guidance;
6. references and examples.

It should emit omissions and truncations explicitly. Semantic retrieval may rank within a declared export, but should not silently search unrelated repositories or erase provenance.

## Task-specific selection

The CLI accepts a task string now so the result shape will not need to change. The prototype records it but does not pretend to understand it. Later implementations may combine:

- declared tags and `when` conditions;
- changed paths;
- component-defined context selectors;
- deterministic keyword rules;
- optional semantic ranking within authorized paths.
