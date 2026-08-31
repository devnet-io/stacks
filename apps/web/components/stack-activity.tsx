'use client';

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  Clock3,
  Coins,
  FileClock,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActivityEvent,
  ActivityTurnDetail,
  ActivityTurnSummary,
  ActivityUsage,
  ActivityWorkDetail,
  ActivityWorkSummary,
  StackActivity as StackActivityData,
} from '../../../src/application/activity.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchActivity, fetchActivityTurn, fetchActivityWork } from '@/lib/stacks-api';

type ActivityLocation =
  | { page: 'work' | 'changes' }
  | { page: 'work-detail'; sessionId: string }
  | { page: 'turn-detail'; sessionId: string; turnId: string };

const PAGE_SIZE = 10;

export function StackActivity({ stack }: { stack?: string }) {
  const [data, setData] = useState<StackActivityData>();
  const [detail, setDetail] = useState<ActivityWorkDetail | ActivityTurnDetail>();
  const [location, setLocation] = useState<ActivityLocation>(() => activityLocation());
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!stack) return;
    setLoading(true);
    setError(undefined);
    try {
      const overview = await fetchActivity(stack, signal);
      setData(overview);
      if (location.page === 'work-detail') setDetail(await fetchActivityWork(stack, location.sessionId, signal));
      else if (location.page === 'turn-detail') setDetail(await fetchActivityTurn(stack, location.sessionId, location.turnId, signal));
      else setDetail(undefined);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [location, stack]);

  useEffect(() => {
    const readLocation = () => { setLocation(activityLocation()); setDetail(undefined); setPage(0); };
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const navigate = (next: ActivityLocation) => {
    setLocation(next);
    setDetail(undefined);
    setPage(0);
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'activity');
    url.searchParams.set('activity', next.page);
    if ('sessionId' in next) url.searchParams.set('session', next.sessionId);
    else url.searchParams.delete('session');
    if ('turnId' in next) url.searchParams.set('turn', next.turnId);
    else url.searchParams.delete('turn');
    window.history.pushState({}, '', url);
  };

  if (loading && !data) return <ActivitySkeleton />;
  if (error && !data) return <ActivityError error={error} retry={() => void load()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Logical work is grouped independently from agent chats. Each work item can span multiple turns, retries, or clarifications before it is completed.
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>
      {error && <ActivityError error={`${error} Showing the last successful snapshot.`} retry={() => void load()} compact />}
      {data.warnings.length > 0 && (
        <Alert><AlertCircle /><AlertTitle>Some events could not be read</AlertTitle><AlertDescription>{data.warnings.join(' ')}</AlertDescription></Alert>
      )}
      <Metrics data={data} />
      {data.summary.events === 0 ? <EmptyActivity /> : loading && (location.page === 'work-detail' || location.page === 'turn-detail') && !detail ? (
        <Skeleton className="h-[28rem]" />
      ) : location.page === 'work-detail' && detail && 'turns' in detail ? (
        <WorkDetail detail={detail} back={() => navigate({ page: 'work' })} openTurn={(turnId) => navigate({ page: 'turn-detail', sessionId: detail.work.sessionId, turnId })} />
      ) : location.page === 'turn-detail' && detail && 'turn' in detail ? (
        <TurnDetail detail={detail} back={() => navigate({ page: 'work-detail', sessionId: detail.work.sessionId })} />
      ) : (
        <ActivityIndex data={data} location={location.page === 'changes' ? 'changes' : 'work'} page={page} setPage={setPage} navigate={navigate} />
      )}
    </div>
  );
}

function activityLocation(): ActivityLocation {
  if (typeof window === 'undefined') return { page: 'work' };
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('activity');
  const sessionId = params.get('session');
  const turnId = params.get('turn');
  if (requested === 'turn-detail' && sessionId && turnId) return { page: 'turn-detail', sessionId, turnId };
  if (requested === 'work-detail' && sessionId) return { page: 'work-detail', sessionId };
  return { page: requested === 'changes' ? 'changes' : 'work' };
}

function ActivityIndex({ data, location, page, setPage, navigate }: {
  data: StackActivityData; location: 'work' | 'changes'; page: number; setPage(value: number): void; navigate(next: ActivityLocation): void;
}) {
  const items = location === 'work' ? data.work : data.recentChanges;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1" aria-label="Activity views">
          <ActivityTab active={location === 'work'} onClick={() => navigate({ page: 'work' })}>Work</ActivityTab>
          <ActivityTab active={location === 'changes'} onClick={() => navigate({ page: 'changes' })}>Stack changes</ActivityTab>
        </div>
        <p className="pb-3 text-xs text-muted-foreground">{items.length} recent {location === 'work' ? 'work items' : 'changes'}</p>
      </div>
      {location === 'work' ? <WorkList work={visible as ActivityWorkSummary[]} open={(sessionId) => navigate({ page: 'work-detail', sessionId })} /> : <ChangeList events={visible as ActivityEvent[]} />}
      {pageCount > 1 && <Pagination page={current} pages={pageCount} setPage={setPage} />}
    </section>
  );
}

function ActivityTab({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return <button type="button" aria-current={active ? 'page' : undefined} onClick={onClick} className={`border-b-2 px-3 pb-3 text-sm font-medium ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{children}</button>;
}

function WorkList({ work, open }: { work: ActivityWorkSummary[]; open(sessionId: string): void }) {
  if (!work.length) return <EmptyList title="No work recorded" detail="Agent work appears here after work_start." />;
  return <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
    {work.map((item) => (
      <button key={item.sessionId} type="button" onClick={() => open(item.sessionId)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5">
        <StatusDot status={item.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{item.title ?? 'Untitled work'}</p>
            {item.componentId && <Badge variant="outline">{item.componentId}</Badge>}
            {item.status === 'active' && <Badge>active</Badge>}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{item.resultSummary ?? (item.status === 'active' ? 'Work remains open' : 'No completion summary')}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs font-medium">{item.turnCount} turn{item.turnCount === 1 ? '' : 's'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.completedAt ?? item.startedAt)}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    ))}
  </div>;
}

function ChangeList({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <EmptyList title="No Stack changes" detail="Catalog and component configuration changes appear here." />;
  return <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
    {events.map((event) => <div key={event.id} className="flex gap-4 px-4 py-4 sm:px-5">
      <FileClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{eventLabel(event.type)}</p><p className="mt-1 text-sm text-muted-foreground">{event.summary ?? event.componentId ?? 'Stack event'}</p></div>
      <time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.timestamp)}</time>
    </div>)}
  </div>;
}

function WorkDetail({ detail, back, openTurn }: { detail: ActivityWorkDetail; back(): void; openTurn(turnId: string): void }) {
  const work = detail.work;
  return <section className="space-y-5">
    <Button variant="ghost" size="sm" onClick={back}><ArrowLeft /> Back to work</Button>
    <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><Badge variant={work.status === 'active' ? 'default' : 'secondary'}>{work.status}</Badge>{work.componentId && <Badge variant="outline">{work.componentId}</Badge>}</div><CardTitle className="mt-3 text-xl">{work.title ?? 'Untitled work'}</CardTitle><CardDescription>{work.resultSummary ?? 'This work item has not been completed.'}</CardDescription></CardHeader><CardContent><DetailGrid entries={[
      ['Started', formatDate(work.startedAt)], ['Completed', work.completedAt ? formatDate(work.completedAt) : 'Still active'], ['Turns', String(work.turnCount)], ['Tokens', formatNumber(work.usage.inputTokens + work.usage.outputTokens)], ['Work session ID', work.sessionId], ...(work.workId ? [['External work ID', work.workId] as [string, string]] : []),
    ]} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Turns</CardTitle><CardDescription>Each agent interaction or retry within this logical work item.</CardDescription></CardHeader><CardContent className="divide-y divide-border p-0">
      {detail.turns.length ? detail.turns.map((turn, index) => <button key={turn.turnId} type="button" onClick={() => openTurn(turn.turnId)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/45"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{detail.turns.length - index}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{turn.summary ?? (turn.status === 'active' ? 'Turn in progress' : 'No turn summary')}</p><p className="mt-1 text-xs text-muted-foreground">{turn.briefing?.mode ? `${turn.briefing.mode} briefing · ` : ''}{formatDate(turn.completedAt ?? turn.startedAt)}</p></div><Badge variant={turn.status === 'active' ? 'default' : 'outline'}>{turn.status}</Badge><ChevronRight className="size-4 text-muted-foreground" /></button>) : <div className="px-5 py-8 text-sm text-muted-foreground">No turns have started for this work item.</div>}
    </CardContent></Card>
  </section>;
}

function TurnDetail({ detail, back }: { detail: ActivityTurnDetail; back(): void }) {
  const turn = detail.turn;
  return <section className="space-y-5">
    <Button variant="ghost" size="sm" onClick={back}><ArrowLeft /> Back to work details</Button>
    <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><Badge variant={turn.status === 'active' ? 'default' : 'secondary'}>{turn.status}</Badge>{turn.briefing?.mode && <Badge variant="outline">{turn.briefing.mode} briefing</Badge>}</div><CardTitle className="mt-3 text-xl">{turn.summary ?? (turn.status === 'active' ? 'Turn in progress' : 'Turn details')}</CardTitle>{turn.nextStep && <CardDescription>Next: {turn.nextStep}</CardDescription>}</CardHeader><CardContent className="space-y-5"><DetailGrid entries={[
      ['Started', formatDate(turn.startedAt)], ['Completed', turn.completedAt ? formatDate(turn.completedAt) : 'Still active'], ['Changed paths', String(turn.changedPaths.length)], ['Tokens', formatNumber(turn.usage.inputTokens + turn.usage.outputTokens)], ['Turn ID', turn.turnId], ['Work session ID', detail.work.sessionId],
    ]} />
    {turn.briefing && <div><h3 className="text-sm font-semibold">Briefing</h3><DetailGrid entries={[
      ['Mode', turn.briefing.mode ?? 'Legacy turn'], ['Items', String(turn.briefing.items ?? 0)], ['Omissions', String(turn.briefing.omissions ?? 0)], ['Bytes', `${formatNumber(turn.briefing.bytes ?? 0)} / ${formatNumber(turn.briefing.budgetBytes ?? 0)}`], ['Digest', turn.briefing.digest ?? 'Unavailable'],
    ]} /></div>}
    {turn.changedPaths.length > 0 && <div><h3 className="text-sm font-semibold">Changed paths</h3><ul className="mt-2 space-y-1 rounded-lg bg-muted/50 p-3 font-mono text-xs">{turn.changedPaths.map((path) => <li key={path}>{path}</li>)}</ul></div>}
    </CardContent></Card>
  </section>;
}

function Metrics({ data }: { data: StackActivityData }) {
  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Activity summary">
    <Metric icon={<Clock3 />} label="Active work" value={formatNumber(data.summary.activeWork)} />
    <Metric icon={<CheckCircle2 />} label="Completed work" value={formatNumber(data.summary.completedWork)} />
    <Metric icon={<Activity />} label="Turns" value={formatNumber(data.summary.turns)} />
    <Metric icon={<Coins />} label="Tokens" value={formatNumber(data.summary.usage.inputTokens + data.summary.usage.outputTokens)} detail={formatCosts(data.summary.usage)} />
  </section>;
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return <Card size="sm"><CardHeader><CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] [&_svg]:size-4">{icon} {label}</CardDescription><CardTitle className="text-3xl">{value}</CardTitle>{detail && <CardDescription>{detail}</CardDescription>}</CardHeader></Card>;
}
function DetailGrid({ entries }: { entries: Array<[string, string]> }) {
  return <dl className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">{entries.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-all text-sm">{value}</dd></div>)}</dl>;
}
function StatusDot({ status }: { status: ActivityWorkSummary['status'] }) {
  return <span className={`size-2.5 shrink-0 rounded-full ${status === 'active' ? 'bg-primary' : status === 'failed' || status === 'cancelled' ? 'bg-destructive' : 'bg-emerald-500'}`} aria-label={status} />;
}
function Pagination({ page, pages, setPage }: { page: number; pages: number; setPage(value: number): void }) {
  return <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Page {page + 1} of {pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /> Previous</Button><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight /></Button></div></div>;
}
function EmptyActivity() { return <Card><CardContent className="py-16 text-center"><CircleDotDashed className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">No activity recorded yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Component changes and participating agent work will appear here.</p></CardContent></Card>; }
function EmptyList({ title, detail }: { title: string; detail: string }) { return <Card><CardContent className="py-12 text-center"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></CardContent></Card>; }
function ActivitySkeleton() { return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div><Skeleton className="h-[28rem]" /></div>; }
function ActivityError({ error, retry, compact = false }: { error: string; retry(): void; compact?: boolean }) { return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load Stack activity</AlertTitle><AlertDescription>{error}</AlertDescription>{!compact && <Button className="mt-3 w-fit" variant="outline" size="sm" onClick={retry}><RefreshCw /> Retry</Button>}</Alert>; }
function eventLabel(type: string): string { return ({ 'stack.created': 'Stack created', 'component.added': 'Component added', 'component.binding.changed': 'Component binding changed', 'component.configuration.changed': 'Component configuration changed' } as Record<string, string>)[type] ?? type; }
function formatNumber(value: number): string { return new Intl.NumberFormat().format(value); }
function formatDate(value?: string): string { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Time unavailable'; }
function formatCosts(usage: ActivityUsage): string | undefined { return usage.costs.length ? usage.costs.map((cost) => `${new Intl.NumberFormat(undefined, { style: 'currency', currency: cost.currency }).format(cost.amount)} ${cost.costKind}`).join(' · ') : undefined; }
