import catalogJson from '../../../docs/catalog.json';

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

export type DocumentationLifecycle =
  | 'current'
  | 'proposed'
  | 'decision'
  | 'archive';

export interface DocumentationEntry {
  id: string;
  title: string;
  summary: string;
  path: string;
  category: DocumentationCategory;
  lifecycle: DocumentationLifecycle;
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

export const documentationLifecycleLabels: Record<DocumentationLifecycle, string> = {
  current: 'Current',
  proposed: 'Proposed',
  decision: 'Decision record',
  archive: 'Archive',
};

interface DocumentationDescriptor {
  path: string;
  id: string;
  category: DocumentationCategory;
  lifecycle: DocumentationLifecycle;
  order: number;
  summary?: string;
}

const catalog = catalogJson as { schemaVersion: '0.1'; documents: DocumentationDescriptor[] };
const descriptors = new Map(catalog.documents.map((document) => [document.path, document]));

function repositoryPath(modulePath: string): string {
  return modulePath.replace(/^\.\.\/\.\.\/\.\.\//u, '');
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
    const descriptor = descriptors.get(path);
    if (!descriptor) throw new Error(`Documentation is missing lifecycle metadata: ${path}`);
    return {
      id: descriptor.id,
      title: firstHeading(markdown),
      summary: descriptor.summary ?? firstSummary(markdown),
      path,
      category: descriptor.category,
      lifecycle: descriptor.lifecycle,
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
