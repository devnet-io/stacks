import {
  BookOpen,
  Activity,
  Boxes,
  Network,
  Search,
  Settings2,
  TerminalSquare,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StackOverview as StackOverviewData } from '../../../src/application/overview.ts';
import { MarkdownDocument } from '@/components/markdown-document';
import { StackOverview } from '@/components/stack-overview';
import { CliMcp } from '@/components/cli-mcp';
import { StackGraph } from '@/components/stack-graph';
import { StackManagement } from '@/components/stack-management';
import { StackActivity } from '@/components/stack-activity';
import { AppMenu } from '@/components/app-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  documentation,
  documentationCategories,
  documentationEntry,
  documentationHeadings,
  documentationLifecycleLabels,
  resolveDocumentationLink,
} from '@/lib/documentation';
import {
  fetchOverview,
  fetchStacks,
  type RegisteredStack,
} from '@/lib/stacks-api';

type Section =
  | 'overview'
  | 'graph'
  | 'activity'
  | 'management'
  | 'documentation'
  | 'integrations';

const navigation = [
  { name: 'Overview', icon: Boxes, section: 'overview' },
  { name: 'Graph', icon: Network, section: 'graph' },
  { name: 'Activity', icon: Activity, section: 'activity' },
  { name: 'Manage', icon: Settings2, section: 'management' },
  { name: 'Tools & agents', icon: TerminalSquare, section: 'integrations' },
  { name: 'Documentation', icon: BookOpen, section: 'documentation' },
] as const;

export default function Home() {
  const [section, setSection] = useState<Section>(() => sectionFromUrl());
  const [overview, setOverview] = useState<StackOverviewData>();
  const [stacks, setStacks] = useState<RegisteredStack[]>([]);
  const [selectedStack, setSelectedStack] = useState<string>();
  const onOverviewLoaded = useCallback(
    (value: StackOverviewData) => setOverview(value),
    [],
  );
  const loadCatalog = useCallback(
    async (preferred?: string, signal?: AbortSignal) => {
      const { stacks: registered } = await fetchStacks(signal);
      setStacks(registered);
      const requested = new URLSearchParams(window.location.search).get(
        'stack',
      );
      const wanted = preferred ?? requested;
      const selected =
        registered.find(
          (stack) =>
            stack.id === wanted ||
            `${stack.namespace}/${stack.name}` === wanted,
        ) ?? registered[0];
      const value = selected
        ? `${selected.namespace}/${selected.name}`
        : undefined;
      setSelectedStack(value);
      const url = new URL(window.location.href);
      if (value) url.searchParams.set('stack', value);
      else url.searchParams.delete('stack');
      window.history.replaceState({}, '', url);
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(undefined, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [loadCatalog]);
  useEffect(() => {
    const readLocation = () => setSection(sectionFromUrl());
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, []);
  useEffect(() => {
    if (!selectedStack) {
      setOverview(undefined);
      return;
    }
    const controller = new AbortController();
    void fetchOverview(selectedStack, controller.signal)
      .then(setOverview)
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedStack]);
  const selectStack = (value: string) => {
    setSelectedStack(value || undefined);
    setOverview(undefined);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('stack', value);
    else url.searchParams.delete('stack');
    window.history.replaceState({}, '', url);
  };
  const selectSection = (destination: Section) => {
    setSection(destination);
    const url = new URL(window.location.href);
    url.searchParams.set('view', destination);
    window.history.pushState({}, '', url);
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/[.08] bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--primary),transparent_65%)]">
            <Network className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">
              Stacks
            </p>
            <p className="text-xs text-slate-400">Local control plane</p>
          </div>
        </div>
        <div className="mt-6 px-2">
          <label
            htmlFor="stack-selector"
            className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-600"
          >
            Current Stack
          </label>
          {stacks.length ? (
            <select
              id="stack-selector"
              value={selectedStack ?? ''}
              onChange={(event) => selectStack(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-white/[.08] bg-white/[.025] px-2 py-1.5 text-xs text-slate-300 outline-none hover:border-white/[.15] focus:border-primary/60"
            >
              {stacks.map((stack) => (
                <option
                  key={stack.id}
                  value={`${stack.namespace}/${stack.name}`}
                >
                  {stack.namespace}/{stack.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              No registered Stacks
            </p>
          )}
        </div>
        <nav className="mt-5 space-y-1" aria-label="Stack navigation">
          {navigation.map(({ name, icon: Icon, section: destination }) => (
            <button
              key={destination}
              type="button"
              onClick={() => selectSection(destination)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${destination === section ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon className="size-4" />
              {name}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[.06] pt-3">
          <AppMenu />
        </div>
      </aside>
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-[1500px] items-start justify-between gap-3">
            <div><h1 className="text-lg font-semibold tracking-tight">
              {section === 'overview'
                ? 'Overview'
                : section === 'graph'
                  ? 'Graph'
                  : section === 'activity'
                    ? 'Activity'
                  : section === 'management'
                    ? 'Manage'
                    : section === 'documentation'
                      ? 'Documentation'
                      : 'Tools & agents'}
            </h1>
            {overview && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {overview.stack.namespace}/{overview.stack.name}
              </p>
            )}</div>
            <div className="lg:hidden"><AppMenu compact /></div>
          </div>
        </header>
        <nav
          className="flex gap-2 overflow-x-auto border-b border-border bg-card px-5 py-2 lg:hidden"
          aria-label="Mobile Stack navigation"
        >
          {navigation.map(({ name, section: destination }) => (
            <button
              key={destination}
              type="button"
              onClick={() => selectSection(destination)}
              aria-current={section === destination ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${section === destination ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:py-9">
          {section === 'documentation' ? (
            <DocumentationLibrary />
          ) : section === 'management' ? (
            <StackManagement
              stack={selectedStack}
              onCatalogChanged={async (stack) => loadCatalog(stack)}
            />
          ) : !selectedStack ? (
            <NoStack />
          ) : section === 'overview' ? (
            <StackOverview stack={selectedStack} onLoaded={onOverviewLoaded} />
          ) : section === 'graph' ? (
            <StackGraph stack={selectedStack} />
          ) : section === 'activity' ? (
            <StackActivity stack={selectedStack} />
          ) : (
            <CliMcp stack={selectedStack} />
          )}
        </div>
      </main>
    </div>
  );
}

function sectionFromUrl(): Section {
  if (typeof window === 'undefined') return 'documentation';
  const requested = new URLSearchParams(window.location.search).get('view');
  return navigation.some((item) => item.section === requested)
    ? (requested as Section)
    : 'documentation';
}

function NoStack() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8">
      <Badge variant="secondary">No Stack selected</Badge>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
        Create your first Stack
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        A Stack is a named graph of components and knowledge. Create one
        globally, attach existing project directories, then return here.
      </p>
      <pre className="mt-5 overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-sm leading-7 text-slate-100">
        <code>{`stacks stack create your-name/my-stack\nstacks component add your-name/my-stack app --path .`}</code>
      </pre>
    </section>
  );
}

function DocumentationLibrary() {
  const initialDocument = () =>
    documentationEntry(
      new URLSearchParams(window.location.search).get('document'),
    )?.id ?? 'getting-started';
  const [selectedId, setSelectedId] = useState(initialDocument);
  const [selectedHeading, setSelectedHeading] = useState(
    () => new URLSearchParams(window.location.search).get('heading') ?? '',
  );
  const [query, setQuery] = useState('');
  const selected =
    documentation.find((document) => document.id === selectedId) ??
    documentation[0]!;
  const headings = useMemo(
    () => documentationHeadings(selected.markdown),
    [selected.markdown],
  );
  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? documentation.filter((document) =>
          `${document.title} ${document.summary} ${document.markdown}`
            .toLowerCase()
            .includes(needle),
        )
      : documentation;
  }, [query]);
  useEffect(() => {
    const readLocation = () => {
      setSelectedId(initialDocument());
      setSelectedHeading(
        new URLSearchParams(window.location.search).get('heading') ?? '',
      );
    };
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, []);
  useEffect(() => {
    if (!selectedHeading) return;
    requestAnimationFrame(() =>
      document
        .getElementById(selectedHeading)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [selected.id, selectedHeading]);
  const updateDocumentationUrl = (documentId: string, heading = '') => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'documentation');
    url.searchParams.set('document', documentId);
    if (heading) url.searchParams.set('heading', heading);
    else url.searchParams.delete('heading');
    window.history.pushState({}, '', url);
  };
  const selectDocument = (documentId: string, heading = '') => {
    setSelectedId(documentId);
    setSelectedHeading(heading);
    updateDocumentationUrl(documentId, heading);
    requestAnimationFrame(() =>
      document
        .getElementById('documentation-content')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const selectHeading = (heading: string) => {
    setSelectedHeading(heading);
    updateDocumentationUrl(selected.id, heading);
    requestAnimationFrame(() =>
      document
        .getElementById(heading)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const followLink = (href: string) => {
    const target = resolveDocumentationLink(selected.path, href);
    if (!target) return false;
    selectDocument(target.document.id, target.heading ?? '');
    return true;
  };
  return (
    <section
      className="grid items-start gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]"
      aria-label="Documentation"
    >
      <aside className="rounded-2xl border border-border bg-card p-3 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documentation"
            aria-label="Search documentation"
            className="pl-9"
          />
        </div>
        <nav className="space-y-5" aria-label="Documentation documents">
          {documentationCategories.map((category) => {
            const documents = visibleDocuments.filter(
              (document) => document.category === category.id,
            );
            if (!documents.length) return null;
            return (
              <section key={category.id}>
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground/65">
                  {category.title}
                </p>
                <div className="space-y-1">
                  {documents.map((entry) => (
                    <div key={entry.id}>
                      <button
                        type="button"
                        aria-expanded={
                          selected.id === entry.id ? true : undefined
                        }
                        aria-current={
                          selected.id === entry.id ? 'page' : undefined
                        }
                        onClick={() => selectDocument(entry.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${selected.id === entry.id ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                      >
                        {entry.title}
                      </button>
                      {selected.id === entry.id && headings.length > 0 && !query && (
                        <div className="ml-3 mt-1 space-y-0.5 border-l border-border pl-2">
                          {headings.map((heading) => (
                            <button
                              type="button"
                              key={heading.id}
                              aria-current={
                                selectedHeading === heading.id
                                  ? 'location'
                                  : undefined
                              }
                              onClick={() => selectHeading(heading.id)}
                              className={`block w-full rounded-md py-1.5 pr-2 text-left text-xs leading-4 hover:bg-muted hover:text-foreground ${heading.level === 3 ? 'pl-5' : 'pl-2'} ${selectedHeading === heading.id ? 'bg-muted font-semibold text-primary' : 'text-muted-foreground'}`}
                            >
                              {heading.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      </aside>
      <div id="documentation-content" className="min-w-0 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={selected.lifecycle === 'current' ? 'secondary' : 'outline'}>
              {documentationLifecycleLabels[selected.lifecycle]}
            </Badge>
            {selected.path}
          </span>
          <span>{documentation.length} canonical documents</span>
        </div>
        {selected.lifecycle !== 'current' && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {selected.lifecycle === 'proposed'
              ? 'This document describes a proposal or open question, not implemented product behavior.'
              : selected.lifecycle === 'decision'
                ? 'This record explains an accepted decision. Current architecture documentation remains authoritative for implemented behavior.'
                : 'This document is retained as historical design input. Current product, architecture, and interface documentation take precedence.'}
          </div>
        )}
        <MarkdownDocument markdown={selected.markdown} onLink={followLink} />
      </div>
    </section>
  );
}
