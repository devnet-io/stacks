# Stacks documentation

Stacks documentation is organized by the kind of truth it records. Do not combine these categories in an unlabeled document.

| Category | Source | Meaning |
| --- | --- | --- |
| Product definition | [Product](product.md) | What Stacks is and the commitments that define it. This is not a claim that every capability has shipped. |
| Current technical truth | [Architecture](architecture.md) and current subsystem guides | What repository evidence shows is implemented now, including limitations. |
| User documentation | [Using Stacks](user-guide.md) | Commands and procedures that work against the current implementation. |
| Change proposals | [RFC index](rfcs/README.md) | Proposed or accepted-but-not-yet-implemented direction. Acceptance is not implementation. |
| Delivery evidence | [Project status](project-status.md) | What is implemented, in progress, proposed, or blocked, with validation evidence. |

When code, commands, schemas, runtime behavior, or operational assumptions change, update the corresponding current-state document and project status in the same change. When work implements an RFC, update current documentation before marking the RFC implemented. Preserve superseded RFCs as rationale rather than rewriting history.

The local web workspace renders this Markdown library. Markdown files remain the source of truth; frontend components must not duplicate canonical documentation prose.
