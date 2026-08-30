'use client';

import { AlertCircle, CheckCircle2, CircleDotDashed, FolderGit2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ComponentHealth, StackOverview as StackOverviewData } from '../../../src/application/overview.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchOverview } from '@/lib/stacks-api';

export function StackOverview({ stack, onLoaded }: { stack?: string; onLoaded(data: StackOverviewData): void }) {
  const [data, setData] = useState<StackOverviewData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(undefined);
    try { const overview = await fetchOverview(stack, signal); setData(overview); onLoaded(overview); }
    catch (caught) { if (caught instanceof DOMException && caught.name === 'AbortError') return; setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [onLoaded, stack]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  if (loading && !data) return <OverviewSkeleton />;
  if (error && !data) return <Alert variant="destructive" className="max-w-3xl"><AlertCircle /><AlertTitle>Could not reach this Stack</AlertTitle><AlertDescription>Start the local control plane with <code>stacks ui</code>, then retry. {error}</AlertDescription><Button variant="outline" size="sm" className="mt-3 w-fit" onClick={() => void load()}><RefreshCw />Retry</Button></Alert>;
  if (!data) return null;
  const attention = data.summary.dirty + data.summary.missing + data.summary.issues;
  return <div className="space-y-7">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Stack health summary">
      <SummaryCard label="Components" value={String(data.summary.components)} detail="Registered in the active Stack" />
      <SummaryCard label="Ready" value={String(data.summary.ready)} detail="Present with no detected issues" tone="ready" />
      <SummaryCard label="Needs attention" value={String(attention)} detail={`${data.summary.dirty} dirty · ${data.summary.missing} missing · ${data.summary.issues} issues`} tone={attention ? 'attention' : 'ready'} />
      <SummaryCard label="Stack version" value={data.stack.version ?? 'Unversioned'} detail={`Contract ${data.schemaVersion}`} />
    </section>
    {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Refresh failed</AlertTitle><AlertDescription>{error} Showing the most recent successful result.</AlertDescription></Alert>}
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card><CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Components</CardTitle><CardDescription className="mt-1">Live filesystem and Git status. Refreshing never changes a component repository.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Refresh</Button></div></CardHeader><CardContent className="px-0">
        {data.components.length === 0 ? <div className="px-5 py-12 text-center"><CircleDotDashed className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">No components registered</p><p className="mt-1 text-sm text-muted-foreground">Use <code>stacks component add namespace/name component --path directory</code>, then refresh.</p></div> : <Table><TableHeader><TableRow><TableHead className="pl-5">Component</TableHead><TableHead>Health</TableHead><TableHead>Source</TableHead><TableHead>Revision</TableHead><TableHead className="pr-5">Access</TableHead></TableRow></TableHeader><TableBody>{data.components.map((component) => <TableRow key={component.id}><TableCell className="pl-5"><div className="font-medium">{component.name}</div><div className="mt-0.5 font-mono text-xs text-muted-foreground">{component.id}</div>{component.issues.map((issue) => <div key={issue} className="mt-1 max-w-xl whitespace-normal text-xs text-destructive">{issue}</div>)}</TableCell><TableCell><HealthBadge health={component.health} /></TableCell><TableCell><div className="flex items-center gap-1.5"><FolderGit2 className="size-3.5 text-muted-foreground" />{component.sourceType}</div></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{component.git?.commit?.slice(0, 12) ?? '—'}{component.git?.branch && <div className="mt-1 font-sans">{component.git.branch}</div>}</TableCell><TableCell className="pr-5">{component.access}</TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>
      <Card className="self-start"><CardHeader><CardTitle>{data.workspace.mode === 'registered' ? 'Storage' : 'Legacy workspace'}</CardTitle><CardDescription>{data.workspace.mode === 'registered' ? 'Readable definition, explicit component paths, and machine-local state.' : 'Directory-based compatibility mode.'}</CardDescription></CardHeader><CardContent className="space-y-4"><PathDetail label="Definition" value={data.workspace.definitionPath} />{data.workspace.legacyRoot && <PathDetail label="Stack root" value={data.workspace.legacyRoot} />}{data.workspace.legacyComponentDirectory && <PathDetail label="Default components" value={data.workspace.legacyComponentDirectory} />}{data.workspace.mode === 'registered' && <PathDetail label="Component locations" value="Explicit per component; repositories are not moved or claimed." />}<PathDetail label="Local state" value={data.workspace.stateDirectory} /></CardContent></Card>
    </section>
  </div>;
}

function OverviewSkeleton() { return <div className="space-y-7" aria-label="Loading Stack overview"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Card key={index}><CardHeader><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-9 w-16" /></CardHeader><CardContent><Skeleton className="h-3 w-40" /></CardContent></Card>)}</div><Card><CardHeader><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-72 max-w-full" /></CardHeader><CardContent className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</CardContent></Card></div>; }
function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'ready' | 'attention' }) { return <Card><CardHeader className="pb-1"><CardDescription className="text-xs font-semibold uppercase tracking-[.12em]">{label}</CardDescription><CardTitle className={`text-3xl font-semibold tracking-tight ${tone === 'ready' ? 'text-emerald-700' : tone === 'attention' ? 'text-amber-700' : ''}`}>{value}</CardTitle></CardHeader><CardContent><p className="text-xs leading-5 text-muted-foreground">{detail}</p></CardContent></Card>; }
function HealthBadge({ health }: { health: ComponentHealth }) { if (health === 'ready') return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800"><CheckCircle2 />Ready</Badge>; if (health === 'dirty') return <Badge variant="secondary" className="bg-amber-100 text-amber-900">Dirty</Badge>; if (health === 'missing') return <Badge variant="destructive">Missing</Badge>; return <Badge variant="destructive">Issue</Badge>; }
function PathDetail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono text-xs leading-5 text-foreground">{value}</p></div>; }
