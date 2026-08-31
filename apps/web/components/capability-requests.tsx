import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { CapabilityRequestStatus } from '../../../src/core/types.ts';
import type { CapabilityRequestDetail, CapabilityRequestSummary } from '../../../src/application/capability-requests.ts';
import type { ActivityWorkSummary, StackActivity } from '../../../src/application/activity.ts';
import type { ComponentListOutput } from '../../../src/application/stacks-application.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { createCapabilityRequest, fetchActivity, fetchCapabilityRequest, fetchCapabilityRequests, fetchComponents, transitionCapabilityRequest } from '@/lib/stacks-api';

type Route = 'list' | 'create' | 'detail';
const PAGE_SIZE = 10;
const terminal = new Set<CapabilityRequestStatus>(['consumer-verified', 'rejected', 'superseded']);

export function CapabilityRequests({ stack }: { stack: string }) {
  const [route, setRoute] = useState<Route>(() => routeFromUrl());
  const [requestId, setRequestId] = useState(() => new URLSearchParams(window.location.search).get('request') ?? '');
  const [requests, setRequests] = useState<CapabilityRequestSummary[]>();
  const [components, setComponents] = useState<ComponentListOutput>();
  const [activity, setActivity] = useState<StackActivity>();
  const [detail, setDetail] = useState<CapabilityRequestDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [page, setPage] = useState(1);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const [requestList, componentList, work] = await Promise.all([fetchCapabilityRequests(stack), fetchComponents(stack), fetchActivity(stack)]);
      setRequests(requestList.requests); setComponents(componentList); setActivity(work);
      if (route === 'detail' && requestId) setDetail(await fetchCapabilityRequest(stack, requestId));
    } catch (caught) { setError(message(caught)); }
    finally { setLoading(false); }
  }, [requestId, route, stack]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const pop = () => { setRoute(routeFromUrl()); setRequestId(new URLSearchParams(window.location.search).get('request') ?? ''); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, []);

  const navigate = (next: Route, id?: string) => {
    const url = new URL(window.location.href); url.searchParams.set('requestView', next);
    if (id) url.searchParams.set('request', id); else url.searchParams.delete('request');
    window.history.pushState({}, '', url); setRoute(next); setRequestId(id ?? ''); setDetail(undefined);
  };

  if (loading && !requests) return <RequestSkeleton />;
  if (error && !requests) return <LoadError error={error} retry={load} />;
  if (!components || !activity || !requests) return null;
  if (route === 'create') return <CreateRequest stack={stack} components={components} work={activity.work} back={() => navigate('list')} saved={(id) => navigate('detail', id)} />;
  if (route === 'detail') {
    if (loading && !detail) return <RequestSkeleton />;
    if (error && !detail) return <LoadError error={error} retry={load} />;
    return detail ? <RequestDetail stack={stack} detail={detail} back={() => navigate('list')} changed={async () => { setDetail(await fetchCapabilityRequest(stack, detail.request.requestId)); const list = await fetchCapabilityRequests(stack); setRequests(list.requests); }} /> : null;
  }

  const visible = requests.filter((request) => showClosed || !terminal.has(request.status));
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const rows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="max-w-3xl text-sm leading-6 text-muted-foreground">Missing shared capabilities move through an explicit provider-complete and consumer-verified protocol. Stacks records the relationship and evidence; it does not assign or schedule work.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} />Refresh</Button><Button size="sm" onClick={() => navigate('create')}><Plus />New request</Button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Open" value={requests.filter((r) => !terminal.has(r.status)).length} /><Metric label="Provider complete" value={requests.filter((r) => r.status === 'provider-complete').length} /><Metric label="Verified" value={requests.filter((r) => r.status === 'consumer-verified').length} /></div>
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{visible.length} {showClosed ? 'total' : 'open'} request{visible.length === 1 ? '' : 's'}</p><Button variant="ghost" size="sm" onClick={() => { setShowClosed((value) => !value); setPage(1); }}>{showClosed ? 'Hide closed' : 'Show closed'}</Button></div>
    {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Refresh failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    {!rows.length ? <Card><CardContent className="py-12 text-center"><p className="font-medium">{showClosed ? 'No capability requests yet' : 'No open capability requests'}</p><p className="mt-1 text-sm text-muted-foreground">Create one only when active consumer work is blocked by a missing shared capability.</p></CardContent></Card> : <div className="space-y-3">{rows.map((request) => <button key={request.requestId} type="button" onClick={() => navigate('detail', request.requestId)} className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Status status={request.status} /><p className="font-medium">{request.capability}</p></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{request.reason}</p><p className="mt-3 text-xs text-muted-foreground">{request.requesterComponentId} <span aria-hidden>→</span> {request.providerComponentId} · updated {date(request.updatedAt)}</p></div><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>)}</div>}
    {pageCount > 1 ? <div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button></div> : null}
  </div>;
}

function CreateRequest({ stack, components, work, back, saved }: { stack: string; components: ComponentListOutput; work: ActivityWorkSummary[]; back(): void; saved(id: string): void }) {
  const ids = useMemo(() => components.components.map(({ component }) => component.id), [components]);
  const [requester, setRequester] = useState(ids[0] ?? '');
  const providers = useMemo(() => ids.filter((id) => id !== requester), [ids, requester]);
  const [provider, setProvider] = useState(providers[0] ?? '');
  const active = work.filter((item) => item.status === 'active' && item.componentId === requester);
  const [session, setSession] = useState(active[0]?.sessionId ?? '');
  const [capability, setCapability] = useState(''); const [reason, setReason] = useState(''); const [acceptance, setAcceptance] = useState('');
  const operation = useOperation();
  useEffect(() => { const nextProviders = ids.filter((id) => id !== requester); if (!nextProviders.includes(provider)) setProvider(nextProviders[0] ?? ''); const nextWork = work.filter((item) => item.status === 'active' && item.componentId === requester); if (!nextWork.some((item) => item.sessionId === session)) setSession(nextWork[0]?.sessionId ?? ''); }, [ids, provider, requester, session, work]);
  const submit = async (event: FormEvent) => { event.preventDefault(); operation.start(); try { const result = await createCapabilityRequest({ stack, requesterComponentId: requester, providerComponentId: provider, sessionId: session, capability: capability.trim(), reason: reason.trim(), acceptance: acceptance.trim() || undefined }); operation.succeed('Request created.'); saved(result.request.requestId); } catch (caught) { operation.fail(caught); } };
  return <div className="mx-auto max-w-3xl space-y-5"><Button variant="ghost" size="sm" onClick={back}><ArrowLeft />Back to requests</Button><Card><CardHeader><CardTitle>New capability request</CardTitle><CardDescription>Link a missing shared capability to active consumer work and the expected provider.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><Field label="Requesting component" htmlFor="requester"><Select id="requester" value={requester} onChange={setRequester} options={ids} /></Field><Field label="Expected provider" htmlFor="provider"><Select id="provider" value={provider} onChange={setProvider} options={providers} /></Field></div><Field label="Blocked logical work" htmlFor="session">{active.length ? <select id="session" className={selectClass} value={session} onChange={(event) => setSession(event.target.value)}>{active.map((item) => <option key={item.sessionId} value={item.sessionId}>{item.title}</option>)}</select> : <Alert><AlertCircle /><AlertTitle>No active work for {requester || 'this component'}</AlertTitle><AlertDescription>Start logical work through the agent lifecycle or CLI before recording a blocking capability request.</AlertDescription></Alert>}</Field><Field label="Capability" htmlFor="capability"><Input id="capability" required placeholder="ui.dialog" value={capability} onChange={(event) => setCapability(event.target.value)} /></Field><Field label="Why it is needed" htmlFor="reason"><Textarea id="reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why the consumer should not implement a local substitute." /></Field><Field label="Acceptance evidence" htmlFor="acceptance"><Textarea id="acceptance" value={acceptance} onChange={(event) => setAcceptance(event.target.value)} placeholder="Describe what the consumer needs to verify." /></Field><Button type="submit" disabled={operation.pending || !requester || !provider || !session || !capability.trim() || !reason.trim()}>{operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}Create request</Button><OperationMessage operation={operation} /></form></CardContent></Card></div>;
}

function RequestDetail({ stack, detail, back, changed }: { stack: string; detail: CapabilityRequestDetail; back(): void; changed(): Promise<void> }) {
  const request = detail.request; const [componentId, setComponentId] = useState(request.status === 'provider-complete' ? request.requesterComponentId : request.providerComponentId);
  const choices = transitionChoices(request.status, componentId === request.requesterComponentId ? 'requester' : 'provider');
  const [status, setStatus] = useState(choices[0]?.value ?? ''); const [summary, setSummary] = useState(''); const [evidence, setEvidence] = useState(''); const operation = useOperation();
  useEffect(() => { const next = transitionChoices(request.status, componentId === request.requesterComponentId ? 'requester' : 'provider'); setStatus(next[0]?.value ?? ''); }, [componentId, request.status]);
  const submit = async (event: FormEvent) => { event.preventDefault(); operation.start(); try { await transitionCapabilityRequest({ stack, requestId: request.requestId, componentId, status: status as Exclude<CapabilityRequestStatus, 'requested'>, summary: summary.trim(), evidence: evidence.trim() || undefined }); setSummary(''); setEvidence(''); await changed(); operation.succeed('Transition recorded.'); } catch (caught) { operation.fail(caught); } };
  return <div className="mx-auto max-w-5xl space-y-5"><Button variant="ghost" size="sm" onClick={back}><ArrowLeft />Back to requests</Button><Card><CardHeader><div className="flex flex-wrap items-center gap-2"><Status status={request.status} /><Badge variant="outline">{request.requesterComponentId} → {request.providerComponentId}</Badge></div><CardTitle className="pt-2">{request.capability}</CardTitle><CardDescription>{request.reason}</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Fact label="Created" value={date(request.createdAt)} /><Fact label="Updated" value={date(request.updatedAt)} /><Fact label="Request ID" value={request.requestId} mono /><Fact label="Blocked work" value={request.sessionId} mono /></div>{request.acceptance ? <div><p className="text-sm font-medium">Acceptance evidence</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{request.acceptance}</p></div> : null}</CardContent></Card>
    {!terminal.has(request.status) ? <Card><CardHeader><CardTitle>Record the next state</CardTitle><CardDescription>Transitions are append-only and role-checked. Completion by the provider is not verification by the consumer.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><Field label="Acting component" htmlFor="acting"><Select id="acting" value={componentId} onChange={setComponentId} options={[request.requesterComponentId, request.providerComponentId]} /></Field><Field label="Next state" htmlFor="next-status"><select id="next-status" className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></Field></div><Field label="Summary" htmlFor="transition-summary"><Textarea id="transition-summary" required value={summary} onChange={(event) => setSummary(event.target.value)} /></Field><Field label="Evidence or revision" htmlFor="transition-evidence"><Input id="transition-evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Commit, document, test result, or other evidence" /></Field><Button type="submit" disabled={operation.pending || !status || !summary.trim()}>{operation.pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Record transition</Button><OperationMessage operation={operation} /></form></CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Transition history</CardTitle><CardDescription>Newest state change first.</CardDescription></CardHeader><CardContent>{detail.transitions.length ? <ol className="space-y-4">{detail.transitions.map((transition) => <li key={transition.eventId} className="border-l-2 border-border pl-4"><div className="flex flex-wrap items-center gap-2"><Status status={transition.toStatus} /><span className="text-xs text-muted-foreground">{transition.componentId} · {date(transition.timestamp)}</span></div><p className="mt-2 text-sm">{transition.summary}</p>{transition.evidence ? <p className="mt-1 break-all text-xs text-muted-foreground">Evidence: {transition.evidence}</p> : null}</li>)}</ol> : <p className="text-sm text-muted-foreground">No transitions have been recorded.</p>}</CardContent></Card></div>;
}

function transitionChoices(status: CapabilityRequestStatus, role: 'requester' | 'provider') {
  if (role === 'requester') {
    if (status === 'provider-complete') return [{ value: 'consumer-verified', label: 'Verify capability' }, { value: 'in-progress', label: 'Request more provider work' }, { value: 'superseded', label: 'Supersede request' }];
    if (status === 'requested' || status === 'in-progress') return [{ value: 'superseded', label: 'Supersede request' }, { value: 'rejected', label: 'Reject request' }];
  } else if (status === 'requested') return [{ value: 'in-progress', label: 'Start provider work' }, { value: 'provider-complete', label: 'Report provider complete' }, { value: 'rejected', label: 'Reject request' }];
  else if (status === 'in-progress') return [{ value: 'provider-complete', label: 'Report provider complete' }, { value: 'rejected', label: 'Reject request' }];
  else if (status === 'provider-complete') return [{ value: 'in-progress', label: 'Resume provider work' }, { value: 'rejected', label: 'Reject request' }];
  return [];
}

function routeFromUrl(): Route { const value = new URLSearchParams(window.location.search).get('requestView'); return value === 'create' || value === 'detail' ? value : 'list'; }
function Status({ status }: { status: CapabilityRequestStatus }) { return <Badge variant={status === 'consumer-verified' ? 'default' : status === 'provider-complete' ? 'secondary' : status === 'rejected' || status === 'superseded' ? 'outline' : 'secondary'}>{status.replace('-', ' ')}</Badge>; }
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="py-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>; }
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p></div>; }
function Select({ id, value, onChange, options }: { id: string; value: string; onChange(value: string): void; options: string[] }) { return <select id={id} className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
const selectClass = 'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm';
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) { return <div><Label className="mb-1.5" htmlFor={htmlFor}>{label}</Label>{children}</div>; }
function useOperation() { const [pending, setPending] = useState(false); const [success, setSuccess] = useState<string>(); const [error, setError] = useState<string>(); return { pending, success, error, start() { setPending(true); setSuccess(undefined); setError(undefined); }, succeed(value: string) { setPending(false); setSuccess(value); }, fail(caught: unknown) { setPending(false); setError(message(caught)); } }; }
function OperationMessage({ operation }: { operation: ReturnType<typeof useOperation> }) { if (operation.error) return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not save</AlertTitle><AlertDescription>{operation.error}</AlertDescription></Alert>; if (operation.success) return <Alert><CheckCircle2 /><AlertTitle>Saved</AlertTitle><AlertDescription>{operation.success}</AlertDescription></Alert>; return null; }
function LoadError({ error, retry }: { error: string; retry(): Promise<void> }) { return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load capability requests</AlertTitle><AlertDescription>{error}</AlertDescription><Button variant="outline" size="sm" className="mt-3" onClick={() => void retry()}><RefreshCw />Retry</Button></Alert>; }
function RequestSkeleton() { return <div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-28 w-full rounded-xl" />)}</div>; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
