# Stacks documentation

Stacks documentation is organized by the kind of truth it records. Do not combine these categories in an unlabeled document.

| Category | Source | Meaning |
| --- | --- | --- |
| Start here | [Getting started](getting-started.md) | Plain-language installation and first-Stack workflow for a developer new to Stacks. |
| Product definition | [Product](product.md) | What Stacks is and the commitments that define it. This is not a claim that every capability has shipped. |
| Current technical truth | [Architecture](architecture.md) and current subsystem guides | What repository evidence shows is implemented now, including limitations. |
| User documentation | [User guide](user-guide.md) | Common procedures that work against the current implementation. |
| Interface references | [CLI commands](cli-reference.md), [MCP server](mcp-reference.md), and [local HTTP API](http-reference.md) | Exhaustive current command, tool, resource, endpoint, input, output, side-effect, and example documentation. |
| Installation and deployment | [Current contract](deployment.md) | Copied package installation, runtime-derived instructions, and secret handling supported now. |
| Change proposals | [RFC index](rfcs/README.md) | Proposed or accepted-but-not-yet-implemented direction. Acceptance is not implementation. |
| Delivery evidence | [Project status](project-status.md) | What is implemented, in progress, proposed, or blocked, with validation evidence. |

When code, commands, schemas, runtime behavior, or operational assumptions change, update the corresponding current-state document and project status in the same change. When work implements an RFC, update current documentation before marking the RFC implemented. Preserve superseded RFCs as rationale rather than rewriting history.

The local web workspace renders this Markdown library. Markdown files remain the source of truth; frontend components must not duplicate canonical documentation prose.
