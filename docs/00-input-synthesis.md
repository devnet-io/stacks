# Input synthesis: what the originating idea requires

This document re-evaluates the complete originating discussion and converts each idea into a product implication. It is intentionally explicit so that later implementation work does not collapse the concept into “a multi-repo checkout tool.”

## 1. A foundational, lightly structured development layer

**Input:** Stacks should enable a lightly structured approach to AI development and itself be built as ordinary code, potentially exposed through MCP and agent plugins/Skills.

**Implication:** The core must be useful as a filesystem project and CLI. MCP and Skills are first-class adapters but not the persistence or domain model. “Lightly structured” means a small number of durable concepts with extension fields, not an enterprise workflow schema.

## 2. Portable, versioned stack state

**Input:** A stack has state, may be associated with a GitHub repository, may use SQLite at most, and must be easy to store in a filesystem and check into a repository.

**Implication:** Human-readable files in a stack metadata repository are canonical. Local event streams and indexes may use JSONL and SQLite, but every essential declaration must be exportable and reviewable. The initial format is `stack.json`; YAML is an optional parser surface, not a separate semantic model.

## 3. Local workspace manager now; Vaultar remains separate

**Input:** The initial use is local agent development. A separate agent-orchestration system exists conceptually as Vaultar.

**Implication:** Stacks manages composition, context, knowledge access, and observability. It does not introduce runner scheduling, work-unit planning, or action orchestration. Vaultar may consume Stack manifests and events, while optional hosted Stacks access remains independently useful.

## 4. Independent component repositories

**Input:** A stack can contain a UI library, a standards/reference repository, and one or many products, each with its own GitHub repository and local checkout.

**Implication:** Components remain independent Git repositories. The stack metadata repository records where they belong and materializes them under an ignored workspace directory. Git submodules are not the default because they mix composition with commit pinning and make active multi-repository development awkward.

## 5. Standards and preferences are active context

**Input:** A mostly-Markdown repository can describe development standards, code structure and formatting preferences, and agentic-loop rules. Product agents should automatically know these and how to use shared libraries.

**Implication:** Knowledge repositories are ordinary components that provide guidance capabilities. Context exports are attached to capabilities and relationships, so a target agent receives the right standards and usage documentation. Required constraints, preferred conventions, and reference material remain distinguishable.

## 6. The Stack is glue, not the builder

**Input:** Individual agents may work independently or across components. The stack does not itself build the software.

**Implication:** Stacks supplies declarations and protocols. It may invoke Git to materialize repositories, but it does not own application builds, tests, CI, deployments, or agent execution. Components expose their own commands and knowledge.

## 7. Cross-stack progress tracking

**Input:** Agents should check in when starting, after completing a turn, and when completing work, so the stack can track overall progress.

**Implication:** Define an append-only event protocol with stable session identity, target components, optional external work identifiers, summaries, changed paths, outcomes, and next steps. The protocol must work through both CLI and MCP and tolerate multiple agent clients.

## 8. Usage, spend, and analytics

**Input:** The stack should track agentic usage, cost, and spend.

**Implication:** Usage events record provider, model, token categories, duration, tool calls, and monetary amounts. Cost provenance is mandatory: `reported`, `estimated`, or `allocated`. Analytics aggregate without assuming every client exposes the same measurements. Raw prompts and secrets are excluded by default.

## 9. Ingestion is more than import

**Input:** A discovered project may be added as a component, retained only as a reference, or inspected to improve existing libraries, standards, CI/CD references, Worker/Lambda patterns, utilities, and products.

**Implication:** Ingestion has explicit modes and phases: register, inspect, extract observations, propose adoption, approve, apply through normal development work, and record provenance. An ingested source is untrusted. Inspection does not execute it or treat its instructions as authority.

## 10. Each target has its own preferences

**Input:** New understanding from references can modify different children of the stack according to each child’s preferences.

**Implication:** Adoption proposals map findings to specific targets and cite each target’s applicable constraints/preferences. A lesson is not blindly copied everywhere. The same reference may produce a UI-library change, a standards change, a product-specific rejection, and no change to unrelated components.

## 11. The Stack is an evolving worldview

**Input:** The stack represents “our view of the world in terms of how to build software for agents.”

**Implication:** Knowledge, code, reference implementations, decisions, and provenance are peers in the composition graph. The stack is curated and evolves through reviewable changes. This is the defining idea; repository checkout is only enabling machinery.

## 12. Different ecosystems and internal structures

**Input:** One stack might be an npm workspace, while another may have a different format or internal structure.

**Implication:** The domain model is a graph of components and capabilities. Layout adapters may later map that graph onto npm workspaces, monorepos, external directories, remote-only references, or hardware projects. The initial directory/Git layout is one adapter, not the definition of Stack.

## 13. Increasing layers of abstraction

**Input:** A UI primitive library can feed a mid-tier library of paginated displays and editing forms, which then feeds large products.

**Implication:** Components declare namespaced capabilities they provide and consume. The graph can resolve transitive context and explain the chain. A product does not need every source file from every lower layer; it needs the exported usage, constraints, and selected implementation references associated with the consumed capabilities.

## 14. The stack may go all the way down

**Input:** The idea could extend toward assembly, instruction sets, FPGA/Verilog, only partly in jest.

**Implication:** Do not hard-code assumptions that components are npm packages, web apps, or even software. `kind` and capability names are extensible strings. The core operations—composition, context, provenance, status, and events—remain meaningful for lower-level engineering artifacts.

## Resulting definition

> A Stack is a portable, versioned graph of independently owned components, capabilities, guidance, and provenance that materializes a local workspace, supplies bounded task-relevant context to agents, and records their activity—while leaving actual planning and implementation to those agents or to a separate orchestrator.
