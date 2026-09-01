'use client';

import { AlertCircle, ArrowRight, Boxes, CircleDotDashed, GitBranch, Network, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StackGraph as StackGraphData, StackGraphEdge, StackGraphNode } from '../../../src/application/graph.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchGraph } from '@/lib/stacks-api';

interface PositionedNode extends StackGraphNode { x: number; y: number }

export function StackGraph({ stack }: { stack?: string }) {
  const [data, setData] = useState<StackGraphData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(undefined);
    try { const graph = await fetchGraph(stack, signal); setData(graph); setSelectedId((current) => current && graph.nodes.some((node) => node.id === current) ? current : graph.nodes[0]?.id); }
    catch (caught) { if (caught instanceof DOMException && caught.name === 'AbortError') return; setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [stack]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-20 w-full" /><Skeleton className="h-[34rem] w-full" /></div>;
  if (error && !data) return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load the Stack graph</AlertTitle><AlertDescription>{error}</AlertDescription><Button className="mt-3 w-fit" variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Retry</Button></Alert>;
  if (!data) return null;
  if (data.nodes.length === 0) return <Card><CardContent className="py-20 text-center"><CircleDotDashed className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">This Stack has no components</h2><p className="mt-2 text-sm text-muted-foreground">Add components to the manifest to build its composition graph.</p></CardContent></Card>;
  const selected = data.nodes.find((node) => node.id === selectedId) ?? data.nodes[0]!;
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Graph summary"><Metric label="Components" value={data.summary.components} /><Metric label="Relationships" value={data.summary.edges} /><Metric label="Capabilities" value={data.summary.capabilities} /><Metric label="Unresolved" value={data.summary.unresolved} attention={data.summary.unresolved > 0} /></section>
    {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Refresh failed</AlertTitle><AlertDescription>{error} Showing the last successful graph.</AlertDescription></Alert>}
    {data.unresolved.length > 0 && <Alert><TriangleAlert /><AlertTitle>{data.unresolved.length} unresolved capability requirement{data.unresolved.length === 1 ? '' : 's'}</AlertTitle><AlertDescription>{data.unresolved.map((item) => `${item.componentId}: ${item.capability} · ${item.optional ? 'optional' : 'required'} · ${item.reason}`).join(' · ')}</AlertDescription></Alert>}
    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card><CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle>Composition graph</CardTitle><CardDescription className="mt-1">Arrows flow from providers and dependencies toward their consumers.</CardDescription></div><div className="flex w-full gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a component" aria-label="Find a component" className="pl-9" /></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh graph"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div></div></CardHeader><CardContent className="p-0"><GraphCanvas data={data} query={query} selectedId={selected.id} onSelect={setSelectedId} /></CardContent></Card>
      <ComponentDetails node={selected} edges={data.edges} nodes={data.nodes} onSelect={setSelectedId} />
    </section>
  </div>;
}

function layout(nodes: StackGraphNode[], edges: StackGraphEdge[]): { nodes: PositionedNode[]; width: number; height: number } {
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) { outgoing.get(edge.from)?.push(edge.to); indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1); }
  const rank = new Map(nodes.map((node) => [node.id, 0]));
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id).sort();
  const visited = new Set<string>();
  while (queue.length) { const id = queue.shift()!; visited.add(id); for (const target of (outgoing.get(id) ?? []).sort()) { rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(id) ?? 0) + 1)); indegree.set(target, (indegree.get(target) ?? 1) - 1); if (indegree.get(target) === 0) { queue.push(target); queue.sort(); } } }
  const lastRank = Math.max(0, ...rank.values());
  for (const node of nodes) if (!visited.has(node.id)) rank.set(node.id, lastRank + 1);
  const layers = new Map<number, StackGraphNode[]>();
  for (const node of nodes) layers.set(rank.get(node.id) ?? 0, [...(layers.get(rank.get(node.id) ?? 0) ?? []), node]);
  const positioned: PositionedNode[] = [];
  for (const [column, layer] of [...layers].sort(([a], [b]) => a - b)) layer.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, row) => positioned.push({ ...node, x: 40 + column * 300, y: 40 + row * 150 }));
  return { nodes: positioned, width: Math.max(720, 80 + layers.size * 300), height: Math.max(410, 80 + Math.max(...[...layers.values()].map((layer) => layer.length)) * 150) };
}

function GraphCanvas({ data, query, selectedId, onSelect }: { data: StackGraphData; query: string; selectedId: string; onSelect(id: string): void }) {
  const graph = useMemo(() => layout(data.nodes, data.edges), [data]);
  const positions = new Map(graph.nodes.map((node) => [node.id, node]));
  const needle = query.trim().toLowerCase();
  const connected = new Set(data.edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).flatMap((edge) => [edge.from, edge.to])); connected.add(selectedId);
  return <div className="overflow-auto bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--border),transparent_15%)_1px,transparent_0)] bg-[size:22px_22px]" tabIndex={0} aria-label="Scrollable Stack composition graph"><svg width={graph.width} height={graph.height} viewBox={`0 0 ${graph.width} ${graph.height}`} role="group" aria-label={`${data.summary.components} components and ${data.summary.edges} relationships`}><defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" className="fill-slate-400" /></marker></defs>
    {data.edges.map((edge) => { const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return null; const active = edge.from === selectedId || edge.to === selectedId; const x1 = from.x + 220, y1 = from.y + 52, x2 = to.x, y2 = to.y + 52; return <g key={edge.id} className={active ? 'opacity-100' : 'opacity-40'}><path d={`M${x1} ${y1} C${x1 + 55} ${y1},${x2 - 55} ${y2},${x2} ${y2}`} fill="none" className={edge.relation === 'capability' ? 'stroke-primary' : 'stroke-slate-500'} strokeWidth={active ? 2.5 : 1.5} strokeDasharray={edge.optional ? '7 5' : undefined} markerEnd="url(#graph-arrow)" /><title>{edge.from} provides {edge.label} to {edge.to} · {edge.optional ? 'optional' : 'required'}</title></g>; })}
    {graph.nodes.map((node) => { const selected = node.id === selectedId; const matches = !needle || `${node.name} ${node.id} ${node.kind} ${node.provides.join(' ')}`.toLowerCase().includes(needle); const muted = needle ? !matches : !connected.has(node.id); return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.name}, ${node.kind}`} aria-pressed={selected} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }} className={`cursor-pointer outline-none transition-opacity ${muted ? 'opacity-35' : 'opacity-100'}`} transform={`translate(${node.x} ${node.y})`}><rect width="220" height="104" rx="14" className={selected ? 'fill-primary stroke-primary' : matches && needle ? 'fill-amber-50 stroke-amber-400' : 'fill-card stroke-border'} strokeWidth={selected ? 3 : 1.5} /><text x="18" y="29" className={`text-[11px] font-bold uppercase tracking-wider ${selected ? 'fill-primary-foreground/70' : 'fill-muted-foreground'}`}>{node.kind}</text><text x="18" y="55" className={`text-[15px] font-semibold ${selected ? 'fill-primary-foreground' : 'fill-foreground'}`}>{truncate(node.name, 24)}</text><text x="18" y="79" className={`text-[11px] font-mono ${selected ? 'fill-primary-foreground/75' : 'fill-muted-foreground'}`}>{truncate(node.id, 29)}</text><title>{node.name} · provides {node.provides.length} · consumes {node.consumes.length}</title></g>; })}
  </svg></div>;
}

function ComponentDetails({ node, edges, nodes, onSelect }: { node: StackGraphNode; edges: StackGraphEdge[]; nodes: StackGraphNode[]; onSelect(id: string): void }) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const incoming = edges.filter((edge) => edge.to === node.id);
  const outgoing = edges.filter((edge) => edge.from === node.id);
  return <Card className="xl:sticky xl:top-28"><CardHeader><div className="flex items-center gap-2"><Badge variant="secondary">{node.kind}</Badge><Badge variant="outline">{node.sourceType}</Badge><Badge variant="outline">{node.access}</Badge></div><CardTitle className="mt-2 text-lg">{node.name}</CardTitle><CardDescription className="font-mono text-xs">{node.id}</CardDescription></CardHeader><CardContent className="space-y-5">{node.description && <p className="text-sm leading-6 text-muted-foreground">{node.description}</p>}<CapabilityList icon={<Boxes />} label="Provides" values={node.provides} empty="No capabilities exported" /><CapabilityList icon={<Boxes />} label="Artifacts" values={node.artifacts.map((artifact) => `${artifact.ecosystem}:${artifact.name} · root ${artifact.path ?? '.'} · ${artifact.capability}`)} empty="No implementation artifacts declared" /><RequirementList values={node.requirements} /><Relations label="Receives from" edges={incoming} other={(edge) => byId.get(edge.from)} onSelect={onSelect} /><Relations label="Feeds into" edges={outgoing} other={(edge) => byId.get(edge.to)} onSelect={onSelect} /></CardContent></Card>;
}
function Relations({ label, edges, other, onSelect }: { label: string; edges: StackGraphEdge[]; other(edge: StackGraphEdge): StackGraphNode | undefined; onSelect(id: string): void }) { return <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground"><GitBranch className="size-3.5" />{label}</p>{edges.length ? <div className="space-y-1">{edges.map((edge) => { const node = other(edge); return <button type="button" key={edge.id} onClick={() => node && onSelect(node.id)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{node?.name ?? 'Unknown'}</span><span className="block truncate text-xs text-muted-foreground">{edge.label}</span><span className="mt-1 flex gap-1"><Badge variant="outline" className="text-[9px]">{edge.relation}</Badge><Badge variant={edge.optional ? 'secondary' : 'outline'} className="text-[9px]">{edge.optional ? 'optional' : 'required'}</Badge></span></span><ArrowRight className="size-3.5 text-muted-foreground" /></button>; })}</div> : <p className="text-xs text-muted-foreground">No relationships</p>}</div>; }
function RequirementList({ values }: { values: StackGraphNode['requirements'] }) { return <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground"><Network className="size-3.5" />Consumes</p>{values.length ? <div className="space-y-2">{values.map((value) => <div key={value.capability} className="rounded-md border p-2"><div className="flex flex-wrap items-center gap-1"><span className="min-w-0 flex-1 truncate font-mono text-xs">{value.capability}</span><Badge variant={value.optional ? 'secondary' : 'outline'} className="text-[9px]">{value.optional ? 'optional' : 'required'}</Badge></div><p className="mt-1 text-[10px] text-muted-foreground">{value.from ? `Provider: ${value.from}` : 'Provider inferred only when unique'}</p></div>)}</div> : <p className="text-xs text-muted-foreground">No capabilities required</p>}</div>; }
function CapabilityList({ icon, label, values, empty }: { icon: React.ReactNode; label: string; values: string[]; empty: string }) { return <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-muted-foreground"><span className="[&_svg]:size-3.5">{icon}</span>{label}</p>{values.length ? <div className="flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value} variant="outline" className="max-w-full truncate font-mono text-[10px]">{value}</Badge>)}</div> : <p className="text-xs text-muted-foreground">{empty}</p>}</div>; }
function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) { return <Card size="sm"><CardHeader><CardDescription className="text-xs font-semibold uppercase tracking-[.12em]">{label}</CardDescription><CardTitle className={`text-3xl ${attention ? 'text-amber-700' : ''}`}>{value}</CardTitle></CardHeader></Card>; }
function truncate(value: string, length: number) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }
