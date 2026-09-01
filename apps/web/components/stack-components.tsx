'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDotDashed,
  GitBranch,
  List,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  ComponentHealth,
  StackOverview as StackOverviewData,
} from '../../../src/application/overview.ts';
import type {
  StackGraph as StackGraphData,
  StackGraphEdge,
  StackGraphNode,
} from '../../../src/application/graph.ts';
import type { ComponentListOutput } from '../../../src/application/stacks-application.ts';
import { StackGraphCanvas } from '@/components/stack-graph';
import {
  ComponentManagementPanel,
  StackAddPanel,
} from '@/components/stack-management';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchComponents, fetchGraph, fetchOverview } from '@/lib/stacks-api';

type ComponentView = 'list' | 'graph';
type WorkspaceMode = 'explore' | 'edit' | 'add';

export function StackComponents({
  stack,
  onOverviewLoaded,
  onCatalogChanged,
}: {
  stack: string;
  onOverviewLoaded(data: StackOverviewData): void;
  onCatalogChanged(stack?: string): Promise<void>;
}) {
  const [view, setView] = useState<ComponentView>('graph');
  const [mode, setMode] = useState<WorkspaceMode>('explore');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [overview, setOverview] = useState<StackOverviewData>();
  const [graph, setGraph] = useState<StackGraphData>();
  const [components, setComponents] = useState<ComponentListOutput>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        const [nextOverview, nextGraph, nextComponents] = await Promise.all([
          fetchOverview(stack, signal),
          fetchGraph(stack, signal),
          fetchComponents(stack, signal),
        ]);
        setOverview(nextOverview);
        setGraph(nextGraph);
        setComponents(nextComponents);
        onOverviewLoaded(nextOverview);
        setSelectedId((current) =>
          current && nextGraph.nodes.some((node) => node.id === current)
            ? current
            : nextGraph.nodes[0]?.id,
        );
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError')
          return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [onOverviewLoaded, stack],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const changed = async () => {
    await load();
    await onCatalogChanged(stack);
  };

  if (mode === 'edit' && selectedId)
    return (
      <ComponentManagementPanel
        stack={stack}
        componentId={selectedId}
        onBack={() => setMode('explore')}
        onChanged={changed}
      />
    );
  if (mode === 'add')
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <WorkspaceBack onClick={() => setMode('explore')} label="Components" />
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Add to this Stack
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Attach an existing component directory or create another Stack.
          </p>
        </div>
        <StackAddPanel
          stack={stack}
          onCatalogChanged={async (nextStack) => {
            await onCatalogChanged(nextStack);
            if (!nextStack || nextStack === stack) {
              await load();
              setMode('explore');
            }
          }}
        />
      </div>
    );
  if (loading && !overview) return <ExplorerSkeleton />;
  if (error && !overview)
    return (
      <Alert variant="destructive" className="max-w-3xl">
        <AlertCircle />
        <AlertTitle>Could not load Components</AlertTitle>
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
  if (!overview || !graph || !components) return null;

  const selected = graph.nodes.find((node) => node.id === selectedId);
  const health = overview.components.find((item) => item.id === selectedId);
  const needle = query.trim().toLowerCase();
  const visibleNodes = needle
    ? graph.nodes.filter((node) =>
        `${node.name} ${node.id} ${node.kind} ${node.provides.join(' ')} ${node.consumes.join(' ')}`
          .toLowerCase()
          .includes(needle),
      )
    : graph.nodes;
  const attention =
    overview.summary.dirty + overview.summary.missing + overview.summary.issues;

  return (
    <div className="space-y-5">
      <section
        className="flex flex-wrap items-end justify-between gap-4"
        aria-label="Components workspace controls"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{overview.summary.components} components</span>
            <span aria-hidden="true">·</span>
            <span>{graph.summary.edges} relationships</span>
            <span aria-hidden="true">·</span>
            <span className={attention ? 'text-amber-700' : 'text-emerald-700'}>
              {attention
                ? `${attention} need attention`
                : 'All components ready'}
            </span>
            {graph.summary.unresolved > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700">
                  {graph.summary.unresolved} unresolved
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a component in either view. Your selection and details stay
            with you when the view changes.
          </p>
        </div>
        <Button onClick={() => setMode('add')}>
          <Plus /> Add component
        </Button>
      </section>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>
            {error} Showing the last successful result.
          </AlertDescription>
        </Alert>
      ) : null}
      {graph.unresolved.length > 0 ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Unresolved component relationships</AlertTitle>
          <AlertDescription>
            {graph.unresolved
              .map((item) => `${item.componentId}: ${item.capability}`)
              .join(' · ')}
          </AlertDescription>
        </Alert>
      ) : null}
      <section
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
        aria-label="Component explorer"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 p-3">
          <div
            className="flex items-center rounded-lg border bg-background p-1"
            aria-label="Component view"
          >
            <ViewButton
              active={view === 'graph'}
              onClick={() => setView('graph')}
            >
              <Network /> Graph
            </ViewButton>
            <ViewButton
              active={view === 'list'}
              onClick={() => setView('list')}
            >
              <List /> List
            </ViewButton>
          </div>
          <div className="flex min-w-0 flex-1 justify-end gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find by name, ID, or capability"
                aria-label="Find a component"
                className="bg-background pl-9"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh Components"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
        <div className="grid min-h-[38rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="min-w-0 border-b 2xl:border-b-0 2xl:border-r">
            <CompactComponentSummary
              node={selected}
              health={health?.health}
              onEdit={() => setMode('edit')}
            />
            {graph.nodes.length === 0 ? (
              <EmptyComponents />
            ) : view === 'graph' ? (
              <div className="min-h-[38rem] overflow-hidden">
                <StackGraphCanvas
                  data={graph}
                  query={query}
                  selectedId={selected?.id ?? graph.nodes[0]!.id}
                  onSelect={setSelectedId}
                />
              </div>
            ) : (
              <ComponentList
                nodes={visibleNodes}
                overview={overview}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
          <div className="hidden 2xl:block">
            <ComponentSummary
              node={selected}
              health={health?.health}
              root={health?.root}
              edges={graph.edges}
              nodes={graph.nodes}
              onSelect={setSelectedId}
              onEdit={() => setMode('edit')}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function CompactComponentSummary({
  node,
  health,
  onEdit,
}: {
  node?: StackGraphNode;
  health?: ComponentHealth;
  onEdit(): void;
}) {
  if (!node) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/10 px-4 py-3 2xl:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{node.name}</span>
            <Badge variant="secondary">{node.kind}</Badge>
            <HealthBadge health={health ?? 'issue'} />
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {node.id} · {node.provides.length} provides · {node.consumes.length}{' '}
            consumes
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onEdit}>
        <Pencil /> Edit details
      </Button>
    </div>
  );
}

function ComponentList({
  nodes,
  overview,
  selectedId,
  onSelect,
}: {
  nodes: StackGraphNode[];
  overview: StackOverviewData;
  selectedId?: string;
  onSelect(id: string): void;
}) {
  if (!nodes.length)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        No components match this search.
      </p>
    );
  return (
    <div className="divide-y" role="list" aria-label="Components">
      {nodes.map((node) => {
        const status = overview.components.find((item) => item.id === node.id);
        const selected = node.id === selectedId;
        return (
          <button
            key={node.id}
            type="button"
            role="listitem"
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(node.id)}
            className={`grid w-full gap-3 px-5 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1.5fr)_8rem_9rem_2rem] sm:items-center ${selected ? 'bg-primary/[.07]' : 'hover:bg-muted/50'}`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{node.name}</span>
              <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                {node.id}
              </span>
            </span>
            <span>
              <HealthBadge health={status?.health ?? 'issue'} />
            </span>
            <span className="text-xs text-muted-foreground">
              {node.provides.length} provides · {node.consumes.length} consumes
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function ComponentSummary({
  node,
  health,
  root,
  edges,
  nodes,
  onSelect,
  onEdit,
}: {
  node?: StackGraphNode;
  health?: ComponentHealth;
  root?: string;
  edges: StackGraphEdge[];
  nodes: StackGraphNode[];
  onSelect(id: string): void;
  onEdit(): void;
}) {
  if (!node)
    return (
      <aside className="grid place-items-center p-8 text-center">
        <div>
          <CircleDotDashed className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Select a component</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Details appear here without covering the explorer.
          </p>
        </div>
      </aside>
    );
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const incoming = edges.filter((edge) => edge.to === node.id);
  const outgoing = edges.filter((edge) => edge.from === node.id);
  return (
    <aside
      className="bg-muted/10 p-5 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
      aria-label={`${node.name} details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{node.kind}</Badge>
            <HealthBadge health={health ?? 'issue'} />
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">
            {node.name}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {node.id}
          </p>
        </div>
        <Button size="sm" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
      </div>
      {node.description ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {node.description}
        </p>
      ) : null}
      {root ? (
        <p className="mt-4 break-all rounded-lg border bg-background p-3 font-mono text-[11px] leading-5 text-muted-foreground">
          {root}
        </p>
      ) : null}
      <SummarySection
        title="Provides"
        icon={<Boxes />}
        values={node.provides}
        empty="No capabilities provided"
      />
      <SummarySection
        title="Consumes"
        icon={<Network />}
        values={node.requirements.map(
          (item) => `${item.capability}${item.optional ? ' · optional' : ''}`,
        )}
        empty="No capabilities consumed"
      />
      <RelationSection
        title="Receives from"
        edges={incoming}
        other={(edge) => byId.get(edge.from)}
        onSelect={onSelect}
      />
      <RelationSection
        title="Feeds into"
        edges={outgoing}
        other={(edge) => byId.get(edge.to)}
        onSelect={onSelect}
      />
    </aside>
  );
}

function SummarySection({
  title,
  icon,
  values,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  values: string[];
  empty: string;
}) {
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
        <span className="[&_svg]:size-3.5">{icon}</span>
        {title}
      </h3>
      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge
              key={value}
              variant="outline"
              className="max-w-full truncate font-mono text-[10px]"
            >
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
function RelationSection({
  title,
  edges,
  other,
  onSelect,
}: {
  title: string;
  edges: StackGraphEdge[];
  other(edge: StackGraphEdge): StackGraphNode | undefined;
  onSelect(id: string): void;
}) {
  return (
    <section className="mt-6 border-t pt-5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">
        <GitBranch className="size-3.5" />
        {title}
      </h3>
      {edges.length ? (
        <div className="mt-2 space-y-1">
          {edges.map((edge) => {
            const related = other(edge);
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => related && onSelect(related.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-background"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {related?.name ?? 'Unknown'}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {edge.label}
                  </span>
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No relationships</p>
      )}
    </section>
  );
}
function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      aria-pressed={active}
      onClick={onClick}
      className={active ? 'bg-background shadow-sm' : undefined}
    >
      {children}
    </Button>
  );
}
function WorkspaceBack({ onClick, label }: { onClick(): void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit"
      onClick={onClick}
    >
      <ArrowLeft /> Back to {label}
    </Button>
  );
}
function HealthBadge({ health }: { health: ComponentHealth }) {
  if (health === 'ready')
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
        <CheckCircle2 /> Ready
      </Badge>
    );
  if (health === 'dirty')
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-900">
        Dirty
      </Badge>
    );
  if (health === 'missing') return <Badge variant="destructive">Missing</Badge>;
  return <Badge variant="destructive">Issue</Badge>;
}
function EmptyComponents() {
  return (
    <div className="grid min-h-[38rem] place-items-center p-8 text-center">
      <div>
        <CircleDotDashed className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">
          This Stack has no components
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use Add component to attach an existing directory.
        </p>
      </div>
    </div>
  );
}
function ExplorerSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading Components">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-[42rem] w-full rounded-2xl" />
    </div>
  );
}
