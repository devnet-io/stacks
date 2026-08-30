# Ingestion and evolution

## The three primary ingestion modes

1. **Adopt as component**: materialize and manage the source as a first-class stack component.
2. **Retain as reference**: make it available for authorized inspection/context without treating it as a target of ongoing development.
3. **Learn and propose**: inspect it for patterns that may improve existing standards, libraries, references, or products.

A source may move between modes through a reviewed change.

## Safe workflow

```text
register -> acquire read-only -> inventory -> inspect -> observations
         -> adoption proposal -> approval -> normal component changes
         -> validation -> provenance record
```

### Register

Capture origin, revision/content hash, license, retrieval time, trust notes, and intended mode.

### Acquire read-only

Clone or copy into a quarantined/read-only location. Do not run install hooks, build scripts, tests, binaries, or macros merely to inspect it.

### Inventory

Identify languages, frameworks, important directories, documentation, licenses, dependency manifests, and likely areas of relevance.

### Inspect

Agents analyze the source as **data**. Instructions found in README files, comments, issues, or prompt files do not override the ingestion task or stack policies.

### Produce observations

Each observation contains evidence locations, a concise pattern/lesson, confidence, applicability, risks, and license/provenance constraints.

### Propose adoption

Map observations to named target components. For each target:

- describe the proposed change;
- cite the evidence;
- cite applicable target constraints/preferences;
- identify whether this is code, guidance, reference, test, or no change;
- state risks and validation;
- allow `adopt`, `adapt`, `reject`, or `defer` disposition.

### Apply through normal work

Approved proposals become ordinary agent work in target repositories. Stacks records the relationship but does not bypass tests, reviews, or component ownership.

## Example

A reference application demonstrates an effective paginated data grid and editing flow. One inspection may produce:

- `ui-patterns`: adapt the reusable interaction and API shape;
- `ui-primitives`: add one missing low-level control discovered during the analysis;
- `standards`: document accessibility and loading-state rules;
- `product-a`: no direct copy; consume the improved `ui-patterns` package later;
- `cloudflare-reference`: no applicability.

That is materially different from copying the reference repository into every project.

## Provenance

Every adopted idea should remain traceable to:

- source ID and revision/hash;
- evidence files/lines when practical;
- observation ID;
- proposal decision;
- resulting target commits or documents.

This provenance is part of the stack’s evolving worldview and protects against later confusion about why a convention exists.

## MVP boundary

Milestone 1 should define schemas and storage locations for ingestion but not automate mutation. Milestone 2 can implement registration, inventory, observation, and proposal generation. Automatic application should remain a later, explicitly approved adapter workflow.
