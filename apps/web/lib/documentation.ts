import gettingStartedMarkdown from '../../../docs/getting-started.md?raw';
import productMarkdown from '../../../docs/product.md?raw';
import architectureMarkdown from '../../../docs/architecture.md?raw';
import userGuideMarkdown from '../../../docs/user-guide.md?raw';
import cliReferenceMarkdown from '../../../docs/cli-reference.md?raw';
import mcpReferenceMarkdown from '../../../docs/mcp-reference.md?raw';
import httpReferenceMarkdown from '../../../docs/http-reference.md?raw';
import deploymentMarkdown from '../../../docs/deployment.md?raw';
import roadmapMarkdown from '../../../docs/08-roadmap.md?raw';
import rfcIndexMarkdown from '../../../docs/rfcs/README.md?raw';
import portableRuntimeRfcMarkdown from '../../../docs/rfcs/0001-portable-runtime-and-hosted-adapters.md?raw';
import projectStatusMarkdown from '../../../docs/project-status.md?raw';

export interface DocumentationEntry { id: string; title: string; summary: string; path: string; markdown: string; }

export const documentation: DocumentationEntry[] = [
  { id: 'getting-started', title: 'Get started', summary: 'Install Stacks, create a Stack, add repositories, and open the UI.', path: 'docs/getting-started.md', markdown: gettingStartedMarkdown },
  { id: 'product', title: 'What is a Stack?', summary: 'The product idea, its purpose, and its boundaries.', path: 'docs/product.md', markdown: productMarkdown },
  { id: 'user-guide', title: 'User guide', summary: 'Common Stack, context, UI, and agent workflows.', path: 'docs/user-guide.md', markdown: userGuideMarkdown },
  { id: 'cli-reference', title: 'CLI command reference', summary: 'Every command, option, side effect, output, and example.', path: 'docs/cli-reference.md', markdown: cliReferenceMarkdown },
  { id: 'mcp-reference', title: 'MCP server reference', summary: 'Every MCP tool and resource, with inputs, outputs, side effects, and examples.', path: 'docs/mcp-reference.md', markdown: mcpReferenceMarkdown },
  { id: 'http-reference', title: 'Local API reference', summary: 'Current loopback read and management endpoints, contracts, and safety boundaries.', path: 'docs/http-reference.md', markdown: httpReferenceMarkdown },
  { id: 'architecture', title: 'Architecture', summary: 'What this repository implements now, including limitations.', path: 'docs/architecture.md', markdown: architectureMarkdown },
  { id: 'deployment', title: 'Installation', summary: 'How the current local installation works and what is not published yet.', path: 'docs/deployment.md', markdown: deploymentMarkdown },
  { id: 'roadmap', title: 'Roadmap', summary: 'Sequenced milestones based on demonstrated product friction.', path: 'docs/08-roadmap.md', markdown: roadmapMarkdown },
  { id: 'rfc-index', title: 'RFCs', summary: 'Proposal lifecycle and the boundary between accepted design and implemented behavior.', path: 'docs/rfcs/README.md', markdown: rfcIndexMarkdown },
  { id: 'rfc-portable-runtime', title: 'RFC-0001 · Portable runtime', summary: 'Proposed local and hosted adapter boundaries.', path: 'docs/rfcs/0001-portable-runtime-and-hosted-adapters.md', markdown: portableRuntimeRfcMarkdown },
  { id: 'project-status', title: 'Project status', summary: 'Evidence-backed implemented, in-progress, and proposed state.', path: 'docs/project-status.md', markdown: projectStatusMarkdown },
];
