# Stacks documentation

Stacks documentation is organized by the kind of truth it records. Do not combine these categories in an unlabeled document.

Every Markdown document is registered once in `catalog.json` with a stable ID, navigation category, lifecycle (`current`, `proposed`, `decision`, or `archive`), and order. The repository quality gate fails when a document is uncataloged, a catalog entry is missing, IDs or paths repeat, lifecycle metadata is invalid, or a relative Markdown link is broken. The web UI consumes the same catalog and visibly warns when a reader is viewing proposed, decision-record, or archived material.

| Category | Source | Meaning |
| --- | --- | --- |
| Start here | [Getting started](getting-started.md) | Plain-language installation and first-Stack workflow for a developer new to Stacks. |
| Product definition | [Product](product.md) | What Stacks is and the commitments that define it. This is not a claim that every capability has shipped. |
| Current technical truth | [Architecture](architecture.md) and current subsystem guides | What repository evidence shows is implemented now, including limitations. |
| User documentation | [User guide](user-guide.md) | Common procedures that work against the current implementation. |
| Interface references | [CLI commands](cli-reference.md), [MCP server](mcp-reference.md), and [local HTTP API](http-reference.md) | Exhaustive current command, tool, resource, endpoint, input, output, side-effect, and example documentation. |
| Installation and deployment | [Current contract](deployment.md) | Copied package installation, runtime-derived instructions, and secret handling supported now. |
| Delivery plan | [Roadmap](08-roadmap.md) and [open questions](09-open-questions.md) | The ordered implementation sequence and unresolved product decisions. |
| Local MVP acceptance | [MVP acceptance workflow](mvp-acceptance.md) | The continuously exercised copied-install, three-component agent journey and its current limitations. |
| Architecture decisions | [ADR index](adr/README.md) | Accepted decisions that explain why the current architecture has its shape. |
| Change proposals | [RFC index](rfcs/README.md) | Proposed or accepted-but-not-yet-implemented direction. Acceptance is not implementation. |
| Delivery evidence | [Project status](project-status.md) | What is implemented, in progress, proposed, or blocked, with validation evidence. |
| Design archive | Numbered synthesis and design documents | Historical input and earlier design reasoning retained for context; current-state documents above take precedence. |

The archived [MVP agent workflow vision](11-mvp-agent-workflow-vision.md) preserves the design narrative that led to the current acceptance workflow; it is no longer the source for release claims.

When code, commands, schemas, runtime behavior, or operational assumptions change, update the corresponding current-state document and project status in the same change. When work implements an RFC, update current documentation before marking the RFC implemented. Preserve superseded RFCs as rationale rather than rewriting history.

Run `npm run docs:check` for the focused structural audit. The full test suite additionally compares implemented CLI, MCP, and HTTP surfaces with their current references. These checks prevent structural and interface drift; reviewers still own semantic relevance and should move superseded design material to `archive` rather than leaving it labeled current.

The local web workspace auto-discovers and renders every `docs/**/*.md` file in one grouped library, using `catalog.json` for lifecycle and navigation metadata. Markdown files remain the prose source of truth; frontend components must not duplicate canonical documentation prose. Each document and its second- or third-level headings have stable query-parameter deep links. Repository-relative Markdown links stay inside the library when their target is another canonical document.
