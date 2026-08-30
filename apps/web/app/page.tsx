'use client';

import { Activity, BookOpen, Boxes, Cloud, Network, Search, TerminalSquare } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { StackOverview as StackOverviewData } from '../../../src/application/overview.ts';
import { MarkdownDocument } from '@/components/markdown-document';
import { StackOverview } from '@/components/stack-overview';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { documentation, documentGroups } from '@/lib/documentation';

type Section = 'overview' | 'documentation';

export default function Home() {
  const [section, setSection] = useState<Section>('overview');
  const [overview, setOverview] = useState<StackOverviewData>();
  const onOverviewLoaded = useCallback((value: StackOverviewData) => setOverview(value), []);
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/8 bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--primary),transparent_65%)]"><Network className="size-5" /></div><div><p className="text-sm font-semibold tracking-tight text-white">Stacks</p><p className="text-xs text-slate-400">Local control plane</p></div></div>
      <nav className="mt-8 space-y-6" aria-label="Stack navigation">
        <NavGroup label="Workspace" items={[{ name: 'Overview', icon: Boxes, section: 'overview' }, { name: 'Graph', icon: Network }, { name: 'Activity', icon: Activity }]} active={section} onSelect={setSection} />
        <NavGroup label="Reference" items={[{ name: 'Documentation', icon: BookOpen, section: 'documentation' }, { name: 'CLI & MCP', icon: TerminalSquare }, { name: 'Hosted adapter', icon: Cloud }]} active={section} onSelect={setSection} />
      </nav>
      <div className="mt-auto rounded-xl border border-white/8 bg-white/4 p-3"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Current Stack</p><p className="mt-2 text-sm font-semibold text-white">{overview?.stack.name ?? 'Connecting…'}</p><p className="mt-1 text-xs text-slate-400">{overview ? `${overview.stack.namespace} / local` : 'local control plane'}</p></div>
    </aside>
    <main className="lg:pl-72">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 px-5 py-4 backdrop-blur-xl sm:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{overview ? `${overview.stack.namespace} / ${overview.stack.name}` : 'local Stack'}</p><h1 className="mt-1 text-lg font-semibold tracking-tight">{section === 'overview' ? 'Stack overview' : 'Documentation library'}</h1></div><Badge variant="outline" className="border-emerald-300/40 bg-emerald-100/60 text-emerald-800">{section === 'overview' ? 'Live local data' : 'Repository source'}</Badge></div></header>
      <nav className="flex gap-2 border-b border-border bg-card px-5 py-2 lg:hidden" aria-label="Mobile Stack navigation"><button type="button" onClick={() => setSection('overview')} aria-current={section === 'overview' ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${section === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Overview</button><button type="button" onClick={() => setSection('documentation')} aria-current={section === 'documentation' ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${section === 'documentation' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Documentation</button></nav>
      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:py-9">{section === 'overview' ? <StackOverview onLoaded={onOverviewLoaded} /> : <DocumentationLibrary />}</div>
    </main>
  </div>;
}

function DocumentationLibrary() {
  const [selectedId, setSelectedId] = useState('product');
  const [query, setQuery] = useState('');
  const selected = documentation.find((document) => document.id === selectedId) ?? documentation[0]!;
  const visibleDocuments = useMemo(() => { const needle = query.trim().toLowerCase(); return needle ? documentation.filter((document) => `${document.title} ${document.summary} ${document.markdown}`.toLowerCase().includes(needle)) : documentation; }, [query]);
  return <section className="grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]" aria-label="Documentation"><aside className="rounded-2xl border border-border bg-card p-3 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto"><div className="relative mb-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" aria-label="Search documentation" className="pl-9" /></div><nav className="space-y-5" aria-label="Documentation documents">{documentGroups.map((group) => { const documents = visibleDocuments.filter((document) => document.category === group.id); if (!documents.length) return null; return <div key={group.id}><p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">{group.label}</p><div className="space-y-1">{documents.map((document) => <button key={document.id} type="button" aria-current={selected.id === document.id ? 'page' : undefined} onClick={() => setSelectedId(document.id)} className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${selected.id === document.id ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><span className="block text-sm font-semibold">{document.title}</span><span className="mt-1 block text-xs leading-5 opacity-80">{document.summary}</span></button>)}</div></div>; })}</nav></aside><div className="min-w-0"><div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant="secondary">{documentGroups.find((group) => group.id === selected.category)?.label}</Badge><span className="text-xs text-muted-foreground">Markdown source · {selected.path}</span></div><MarkdownDocument markdown={selected.markdown} /></div></section>;
}

function NavGroup({ label, items, active, onSelect }: { label: string; items: Array<{ name: string; icon: typeof Boxes; section?: Section }>; active: Section; onSelect(section: Section): void }) {
  return <div><p className="px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</p><div className="mt-2 space-y-1">{items.map(({ name, icon: Icon, section }) => <button key={name} type="button" disabled={!section} onClick={() => section && onSelect(section)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium disabled:opacity-100 ${section === active ? 'bg-primary text-primary-foreground' : section ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500'}`}><Icon className="size-4" />{name}{!section && <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">Soon</span>}</button>)}</div></div>;
}
