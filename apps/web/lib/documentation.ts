const markdownModules = import.meta.glob('../../../docs/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export type DocumentationCategory =
  | 'use'
  | 'current'
  | 'decisions'
  | 'archive';

export interface DocumentationEntry {
  id: string;
  title: string;
  summary: string;
  path: string;
  category: DocumentationCategory;
  markdown: string;
}

export const documentationCategories: Array<{
  id: DocumentationCategory;
  title: string;
}> = [
  { id: 'use', title: 'Use Stacks' },
  { id: 'current', title: 'Current system & delivery' },
  { id: 'decisions', title: 'Decisions & proposals' },
  { id: 'archive', title: 'Design archive' },
];

const descriptors: Record<
  string,
  { id: string; category: DocumentationCategory; summary?: string; order: number }
> = {
  'docs/getting-started.md': { id: 'getting-started', category: 'use', order: 10, summary: 'Install Stacks, create a Stack, add repositories, and open the UI.' },
  'docs/product.md': { id: 'product', category: 'use', order: 20, summary: 'The product definition, commitments, and boundaries.' },
  'docs/user-guide.md': { id: 'user-guide', category: 'use', order: 30, summary: 'Common Stack, context, UI, and agent workflows.' },
  'docs/cli-reference.md': { id: 'cli-reference', category: 'use', order: 40, summary: 'Every CLI command, option, side effect, output, and example.' },
  'docs/mcp-reference.md': { id: 'mcp-reference', category: 'use', order: 50, summary: 'Every MCP tool and resource, with inputs, outputs, and examples.' },
  'docs/http-reference.md': { id: 'http-reference', category: 'use', order: 60, summary: 'Current loopback endpoints, contracts, and safety boundaries.' },
  'docs/deployment.md': { id: 'deployment', category: 'use', order: 70, summary: 'Current installation, runtime replacement, and release contract.' },
  'docs/README.md': { id: 'documentation-policy', category: 'current', order: 10, summary: 'Documentation categories and the current-truth policy.' },
  'docs/architecture.md': { id: 'architecture', category: 'current', order: 20, summary: 'Implemented repository architecture and current limitations.' },
  'docs/07-agent-interfaces.md': { id: 'agent-interfaces', category: 'current', order: 30 },
  'docs/08-roadmap.md': { id: 'roadmap', category: 'current', order: 40, summary: 'Milestones and the agreed active implementation sequence.' },
  'docs/project-status.md': { id: 'project-status', category: 'current', order: 50, summary: 'Evidence-backed implemented, proposed, and validation state.' },
  'docs/09-open-questions.md': { id: 'open-questions', category: 'current', order: 60 },
  'docs/10-validation-and-handoff.md': { id: 'validation-and-handoff', category: 'current', order: 70 },
  'docs/rfcs/README.md': { id: 'rfc-index', category: 'decisions', order: 200 },
  'docs/rfcs/0001-portable-runtime-and-hosted-adapters.md': { id: 'rfc-portable-runtime', category: 'decisions', order: 210 },
  'docs/00-input-synthesis.md': { id: 'input-synthesis', category: 'archive', order: 10 },
  'docs/01-vision-and-boundaries.md': { id: 'vision-and-boundaries', category: 'archive', order: 20 },
  'docs/02-domain-model.md': { id: 'domain-model', category: 'archive', order: 30 },
  'docs/03-storage-and-layout.md': { id: 'storage-and-layout', category: 'archive', order: 40 },
  'docs/04-context-resolution.md': { id: 'context-resolution-design', category: 'archive', order: 50 },
  'docs/05-events-usage-and-analytics.md': { id: 'events-usage-design', category: 'archive', order: 60 },
  'docs/06-ingestion-and-evolution.md': { id: 'ingestion-and-evolution', category: 'archive', order: 70 },
  'docs/research-notes.md': { id: 'research-notes', category: 'archive', order: 80 },
};

function repositoryPath(modulePath: string): string {
  return modulePath.replace(/^\.\.\/\.\.\/\.\.\//u, '');
}

function defaultDescriptor(path: string) {
  const adr = path.match(/^docs\/adr\/(\d+)-/u);
  if (adr) return { id: `adr-${adr[1]}`, category: 'decisions' as const, order: Number(adr[1]) };
  const slug = path.replace(/^docs\//u, '').replace(/\.md$/u, '').replaceAll('/', '-').toLowerCase();
  return { id: slug, category: 'archive' as const, order: 1_000 };
}

function firstHeading(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? 'Untitled document';
}

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/[`*_>#]/gu, '')
    .trim();
}

function firstSummary(markdown: string): string {
  const paragraph = markdown
    .replace(/```[\s\S]*?```/gu, '')
    .split(/\n\s*\n/gu)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('#') && !part.startsWith('|') && !part.startsWith('- '));
  const value = plainText(paragraph ?? 'Canonical repository documentation.');
  return value.length > 150 ? `${value.slice(0, 147)}…` : value;
}

export const documentation: DocumentationEntry[] = Object.entries(
  markdownModules,
)
  .map(([modulePath, markdown]) => {
    const path = repositoryPath(modulePath);
    const descriptor = descriptors[path] ?? defaultDescriptor(path);
    return {
      id: descriptor.id,
      title: firstHeading(markdown),
      summary: descriptor.summary ?? firstSummary(markdown),
      path,
      category: descriptor.category,
      markdown,
      order: descriptor.order,
    };
  })
  .sort((left, right) => {
    const categoryDifference =
      documentationCategories.findIndex((category) => category.id === left.category) -
      documentationCategories.findIndex((category) => category.id === right.category);
    return categoryDifference || left.order - right.order || left.path.localeCompare(right.path);
  })
  .map(({ order: _order, ...document }) => document);

export function documentationEntry(id: string | null | undefined): DocumentationEntry | undefined {
  return documentation.find((document) => document.id === id);
}

export function resolveDocumentationLink(
  currentPath: string,
  href: string,
): { document: DocumentationEntry; heading?: string } | undefined {
  if (/^(?:[a-z]+:|\/)/iu.test(href)) return undefined;
  const [targetPath, fragment] = href.split('#', 2);
  if (!targetPath) {
    const current = documentation.find((document) => document.path === currentPath);
    return current ? { document: current, ...(fragment ? { heading: headingSlug(decodeURIComponent(fragment)) } : {}) } : undefined;
  }
  const base = currentPath.split('/').slice(0, -1);
  for (const segment of targetPath.replaceAll('\\', '/').split('/')) {
    if (segment === '..') base.pop();
    else if (segment !== '.') base.push(segment);
  }
  const resolved = base.join('/');
  const document = documentation.find((candidate) => candidate.path === resolved);
  return document ? { document, ...(fragment ? { heading: headingSlug(decodeURIComponent(fragment)) } : {}) } : undefined;
}

export interface DocumentationHeading {
  id: string;
  label: string;
  level: 2 | 3;
}

export function headingSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'section';
}

export function documentationHeadings(markdown: string): DocumentationHeading[] {
  const counts = new Map<string, number>();
  const headings: DocumentationHeading[] = [];
  for (const match of markdown.matchAll(/^(#{2,3})\s+(.+)$/gmu)) {
    const base = headingSlug(match[2]!);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    headings.push({ id: count ? `${base}-${count}` : base, label: plainText(match[2]!), level: match[1]!.length as 2 | 3 });
  }
  return headings;
}
