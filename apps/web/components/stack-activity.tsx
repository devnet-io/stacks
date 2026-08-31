'use client';

import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDotDashed,
  Clock3,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  ActivityEvent,
  ActivitySession,
  StackActivity as StackActivityData,
} from '../../../src/application/activity.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchActivity } from '@/lib/stacks-api';

export function StackActivity({ stack }: { stack?: string }) {
  const [data, setData] = useState<StackActivityData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        setData(await fetchActivity(stack, signal));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [stack],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading && !data)
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[28rem]" />
      </div>
    );
  if (error && !data)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load Stack activity</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button
          className="mt-3 w-fit"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          <RefreshCw /> Retry
        </Button>
      </Alert>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Stack changes, agent check-ins, and usage recorded for this Stack.
          Event history is append-only; costs retain their reported, estimated,
          or allocated provenance.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>
            {error} Showing the last successful activity snapshot.
          </AlertDescription>
        </Alert>
      )}
      {data.warnings.length > 0 && (
        <Alert>
          <AlertCircle />
          <AlertTitle>Some events could not be read</AlertTitle>
          <AlertDescription>{data.warnings.join(' ')}</AlertDescription>
        </Alert>
      )}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Activity summary"
      >
        <Metric
          icon={<Activity />}
          label="Events"
          value={formatNumber(data.summary.events)}
        />
        <Metric
          icon={<Clock3 />}
          label="Active sessions"
          value={formatNumber(data.summary.activeSessions)}
        />
        <Metric
          icon={<CheckCircle2 />}
          label="Completed sessions"
          value={formatNumber(data.summary.completedSessions)}
        />
        <Metric
          icon={<Coins />}
          label="Tokens"
          value={formatNumber(
            data.summary.inputTokens + data.summary.outputTokens,
          )}
          detail={formatCosts(data)}
        />
      </section>
      {data.summary.events === 0 ? (
        <EmptyActivity />
      ) : (
        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
          <Sessions sessions={data.sessions} />
          <RecentEvents events={data.recentEvents} />
        </section>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] [&_svg]:size-4">
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
        {detail && <CardDescription>{detail}</CardDescription>}
      </CardHeader>
    </Card>
  );
}

function EmptyActivity() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <CircleDotDashed className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">No activity recorded yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Component changes appear automatically. Connected agents can also
          create work sessions and report progress and usage.
        </p>
      </CardContent>
    </Card>
  );
}

function Sessions({ sessions }: { sessions: ActivitySession[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work sessions</CardTitle>
        <CardDescription>
          Active work first, then the latest 100 completed sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length ? (
          sessions.map((session) => (
            <article
              key={session.sessionId}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={session.status === 'active' ? 'default' : 'secondary'}
                >
                  {session.status}
                </Badge>
                {session.componentId && (
                  <Badge variant="outline">{session.componentId}</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(session.completedAt ?? session.startedAt)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium">
                {session.summary ?? 'No summary provided'}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{session.turns} completed turn{session.turns === 1 ? '' : 's'}</span>
                {session.actor?.agent && (
                  <span className="inline-flex items-center gap-1">
                    <Bot className="size-3" /> {session.actor.agent}
                    {session.actor.model ? ` · ${session.actor.model}` : ''}
                  </span>
                )}
                {session.workId && <span>Work ID: {session.workId}</span>}
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No agent work sessions recorded yet. Stack management events still
            appear in the timeline.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentEvents({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent events</CardTitle>
        <CardDescription>Latest 100 append-only records.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < events.length - 1 && (
                <span className="absolute left-[7px] top-5 h-[calc(100%-1rem)] w-px bg-border" />
              )}
              <span className="relative mt-1.5 size-[15px] shrink-0 rounded-full border-4 border-background bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold">{eventLabel(event.type)}</p>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(event.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.summary ?? usageSummary(event) ?? event.componentId ?? 'Stack event'}
                </p>
                {(event.componentId || event.turnId || event.actor?.client || event.actor?.agent) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.componentId && <Badge variant="outline">{event.componentId}</Badge>}
                    {event.turnId && (
                      <Badge variant="outline" title={event.turnId}>Turn {event.turnId.slice(0, 8)}</Badge>
                    )}
                    {(event.actor?.agent || event.actor?.client) && (
                      <Badge variant="secondary">{event.actor.agent ?? event.actor.client}</Badge>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function usageSummary(event: ActivityEvent): string | undefined {
  if (event.type !== 'usage.recorded') return undefined;
  const tokens = (event.inputTokens ?? 0) + (event.outputTokens ?? 0);
  return `${event.provider ?? 'Unknown provider'} / ${event.model ?? 'unknown model'} · ${formatNumber(tokens)} tokens`;
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    'stack.created': 'Stack created',
    'component.added': 'Component added',
    'component.binding.changed': 'Component binding changed',
    'component.configuration.changed': 'Component configuration changed',
    'work.started': 'Work started',
    'turn.started': 'Turn started',
    'turn.completed': 'Turn completed',
    'work.completed': 'Work completed',
    'usage.recorded': 'Usage recorded',
  };
  return labels[type] ?? type;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value?: string): string {
  if (!value) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCosts(data: StackActivityData): string | undefined {
  if (data.summary.costs.length === 0) return undefined;
  return data.summary.costs
    .map(
      (cost) =>
        `${new Intl.NumberFormat(undefined, { style: 'currency', currency: cost.currency }).format(cost.amount)} ${cost.costKind}`,
    )
    .join(' · ');
}
