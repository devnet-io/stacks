'use client';

import { Activity, BookOpen, Boxes, Cloud, Network, Search, TerminalSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarkdownDocument } from '@/components/markdown-document';
import { documentation, documentGroups } from '@/lib/documentation';

export default function Home() {
  const [selectedId, setSelectedId] = useState('product');
  const [query, setQuery] = useState('');
  const selected = documentation.find((document) => document.id === selectedId) ?? documentation[0]!;
  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documentation;
    return documentation.filter((document) => `${document.title} ${document.summary} ${document.markdown}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/8 bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--primary),transparent_65%)]"><Network className="size-5" /></div>
          <div><p className="text-sm font-semibold tracking-tight text-white">Stacks</p><p className="text-xs text-slate-400">Local control plane</p></div>
        </div>
        <nav className="mt-8 space-y-6" aria-label="Stack navigation">
          <NavGroup label="Workspace" items={[['Overview', Boxes], ['Graph', Network], ['Activity', Activity]]} />
          <NavGroup label="Reference" items={[['Documentation', BookOpen], ['CLI & MCP', TerminalSquare], ['Hosted adapter', Cloud]]} active="Documentation" />
        </nav>
        <div className="mt-auto rounded-xl border border-white/8 bg-white/4 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Current Stack</p>
          <p className="mt-2 text-sm font-semibold text-white">stacks-development</p>
          <p className="mt-1 text-xs text-slate-400">local / source checkout</p>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">local / stacks-development</p><h1 className="mt-1 text-lg font-semibold tracking-tight">Documentation library</h1></div>
            <Badge variant="outline" className="border-emerald-300/40 bg-emerald-100/60 text-emerald-800">Repository source</Badge>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:py-9">
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Stack summary">
            <SummaryCard label="Components" value="3" detail="Core, agent Skill, foundation example" />
            <SummaryCard label="Current milestone" value="1" detail="Usable local Stack" />
            <SummaryCard label="Documentation" value={`${documentation.length}`} detail="Product, current state, guides, RFCs" />
          </section>

          <section className="mt-7 grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]" aria-label="Documentation">
            <aside className="rounded-2xl border border-border bg-card p-3 xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
              <div className="relative mb-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation" aria-label="Search documentation" className="pl-9" /></div>
              <nav className="space-y-5" aria-label="Documentation documents">
                {documentGroups.map((group) => {
                  const documents = visibleDocuments.filter((document) => document.category === group.id);
                  if (!documents.length) return null;
                  return <div key={group.id}><p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">{group.label}</p><div className="space-y-1">{documents.map((document) => <button key={document.id} type="button" aria-current={selected.id === document.id ? 'page' : undefined} onClick={() => setSelectedId(document.id)} className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${selected.id === document.id ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><span className="block text-sm font-semibold">{document.title}</span><span className="mt-1 block text-xs leading-5 opacity-80">{document.summary}</span></button>)}</div></div>;
                })}
              </nav>
            </aside>
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant="secondary">{documentGroups.find((group) => group.id === selected.category)?.label}</Badge><span className="text-xs text-muted-foreground">Markdown source · {selected.path}</span></div>
              <MarkdownDocument markdown={selected.markdown} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavGroup({ label, items, active }: { label: string; items: Array<[string, typeof Boxes]>; active?: string }) {
  return <div><p className="px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">{label}</p><div className="mt-2 space-y-1">{items.map(([name, Icon]) => <button key={name} type="button" className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${name === active ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className="size-4" />{name}{name !== active && <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">Soon</span>}</button>)}</div></div>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card><CardHeader className="pb-1"><CardDescription className="text-xs font-semibold uppercase tracking-[.12em]">{label}</CardDescription><CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle></CardHeader><CardContent><p className="text-xs leading-5 text-muted-foreground">{detail}</p></CardContent></Card>;
}
