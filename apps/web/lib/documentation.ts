import productMarkdown from '../../../docs/product.md?raw';
import architectureMarkdown from '../../../docs/architecture.md?raw';
import userGuideMarkdown from '../../../docs/user-guide.md?raw';
import roadmapMarkdown from '../../../docs/08-roadmap.md?raw';
import rfcIndexMarkdown from '../../../docs/rfcs/README.md?raw';
import portableRuntimeRfcMarkdown from '../../../docs/rfcs/0001-portable-runtime-and-hosted-adapters.md?raw';
import projectStatusMarkdown from '../../../docs/project-status.md?raw';

export type DocumentationCategory = 'product' | 'current' | 'rfc' | 'status';
export interface DocumentationEntry { id: string; title: string; summary: string; path: string; category: DocumentationCategory; markdown: string; }

export const documentation: DocumentationEntry[] = [
  { id: 'product', title: 'Product definition', summary: 'What Stacks is and the commitments that define it.', path: 'docs/product.md', category: 'product', markdown: productMarkdown },
  { id: 'architecture', title: 'Current architecture', summary: 'What this repository implements now, including limitations.', path: 'docs/architecture.md', category: 'current', markdown: architectureMarkdown },
  { id: 'user-guide', title: 'Using Stacks', summary: 'Current CLI, context, MCP, and local UI workflows.', path: 'docs/user-guide.md', category: 'current', markdown: userGuideMarkdown },
  { id: 'roadmap', title: 'Roadmap', summary: 'Sequenced milestones based on demonstrated product friction.', path: 'docs/08-roadmap.md', category: 'current', markdown: roadmapMarkdown },
  { id: 'rfc-index', title: 'RFC index', summary: 'Proposal lifecycle and the boundary between accepted design and implemented behavior.', path: 'docs/rfcs/README.md', category: 'rfc', markdown: rfcIndexMarkdown },
  { id: 'rfc-portable-runtime', title: 'RFC-0001 · Portable runtime', summary: 'Proposed local and hosted adapter boundaries.', path: 'docs/rfcs/0001-portable-runtime-and-hosted-adapters.md', category: 'rfc', markdown: portableRuntimeRfcMarkdown },
  { id: 'project-status', title: 'Project status', summary: 'Evidence-backed implemented, in-progress, and proposed state.', path: 'docs/project-status.md', category: 'status', markdown: projectStatusMarkdown },
];

export const documentGroups: Array<{ id: DocumentationCategory; label: string }> = [
  { id: 'product', label: 'Product' },
  { id: 'current', label: 'Current system & guides' },
  { id: 'rfc', label: 'RFCs · change proposals' },
  { id: 'status', label: 'Delivery state' },
];
