import { AlertCircle, Check, CheckCircle2, Clipboard, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { StackIntegrations } from '../../../src/application/integrations.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchIntegrations } from '@/lib/stacks-api';

export function CliMcp({ stack }: { stack?: string }) {
  const [data, setData] = useState<StackIntegrations>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(undefined);
    try { setData(await fetchIntegrations(stack, signal)); }
    catch (caught) { if (caught instanceof DOMException && caught.name === 'AbortError') return; setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [stack]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  if (loading && !data) return <div className="space-y-5"><Skeleton className="h-28 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (error && !data) return <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load tool settings</AlertTitle><AlertDescription>{error}</AlertDescription><Button className="mt-3 w-fit" variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Retry</Button></Alert>;
  if (!data) return null;

  return <div className="space-y-5">
    {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Refresh failed</AlertTitle><AlertDescription>{error} Showing the last successful result.</AlertDescription></Alert>}
    <Card><CardHeader className="border-b"><CardTitle>Agent connections</CardTitle><CardDescription>Connect tools to the machine-level Stacks adapter. Stack-specific requests identify <span className="font-mono">{data.stack.namespace}/{data.stack.name}</span>.</CardDescription></CardHeader><CardContent>
      <Tabs defaultValue="codex" className="gap-5"><TabsList aria-label="Agent connection type"><TabsTrigger value="codex">Codex</TabsTrigger><TabsTrigger value="hosted">Hosted MCP</TabsTrigger></TabsList>
        <TabsContent value="codex" className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">Run this once. Codex starts the stdio adapter when it needs it; there is no MCP URL, token, or background service for local use.</p><Command title="Add the Stacks MCP server" value={data.mcp.local.codexAddCommand} /><details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Manual configuration</summary><div className="mt-4"><Command title="Codex configuration" value={data.mcp.local.codexToml} multiline /></div></details><p className="text-xs leading-5 text-muted-foreground"><a className="inline-flex items-center gap-1 text-primary hover:underline" href={data.mcp.officialCodexDocumentation} target="_blank" rel="noreferrer">Codex MCP documentation <ExternalLink className="size-3" /></a></p></TabsContent>
        <TabsContent value="hosted" className="space-y-5">{data.mcp.hosted.status === 'configured' ? <><Alert><CheckCircle2 /><AlertTitle>Hosted MCP configured</AlertTitle><AlertDescription>Authorized remote tools can use this endpoint. Secret values are not displayed.</AlertDescription></Alert><Detail label="MCP URL" value={data.mcp.hosted.url ?? '—'} /><Detail label="Token environment variable" value={data.mcp.hosted.bearerTokenEnvVar ?? 'None'} /></> : <Alert><TriangleAlert /><AlertTitle>Not configured</AlertTitle><AlertDescription>This installation currently exposes only the local stdio adapter.</AlertDescription></Alert>}</TabsContent>
      </Tabs>
    </CardContent></Card>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-2 break-all rounded-lg bg-slate-950 p-4 font-mono text-sm text-slate-100">{value}</p></div>; }
function Command({ title, value, multiline = false }: { title: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  return <div><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-muted-foreground">{title}</p><Button type="button" variant="ghost" size="xs" onClick={() => void copy()} aria-label={`Copy ${title}`}>{copied ? <Check /> : <Clipboard />}{copied ? 'Copied' : 'Copy'}</Button></div><pre className={`overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-[13px] leading-6 text-slate-100 ${multiline ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}><code>{value}</code></pre></div>;
}
