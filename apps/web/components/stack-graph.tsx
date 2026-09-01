'use client';

import {
  AlertCircle,
  CircleDotDashed,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StackGraph as StackGraphData } from '../../../src/application/graph.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  layoutStackGraph,
} from '@/lib/graph-layout';
import { fetchGraph } from '@/lib/stacks-api';

export function StackGraph({
  stack,
  onSelectComponent,
}: {
  stack?: string;
  onSelectComponent?(componentId: string): void;
}) {
  const [data, setData] = useState<StackGraphData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        const graph = await fetchGraph(stack, signal);
        setData(graph);
        setSelectedId((current) =>
          current && graph.nodes.some((node) => node.id === current)
            ? current
            : graph.nodes[0]?.id,
        );
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError')
          return;
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
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[34rem] w-full" />
      </div>
    );
  if (error && !data)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load the Stack graph</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button
          className="mt-3 w-fit"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          <RefreshCw />
          Retry
        </Button>
      </Alert>
    );
  if (!data) return null;
  if (data.nodes.length === 0)
    return (
      <Card>
        <CardContent className="py-20 text-center">
          <CircleDotDashed className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">
            This Stack has no components
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add components to the manifest to build its composition graph.
          </p>
        </CardContent>
      </Card>
    );
  const selected =
    data.nodes.find((node) => node.id === selectedId) ?? data.nodes[0]!;
  return (
    <div className="space-y-6">
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Graph summary"
      >
        <Metric label="Components" value={data.summary.components} />
        <Metric label="Relationships" value={data.summary.edges} />
        <Metric label="Capabilities" value={data.summary.capabilities} />
        <Metric
          label="Unresolved"
          value={data.summary.unresolved}
          attention={data.summary.unresolved > 0}
        />
      </section>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>
            {error} Showing the last successful graph.
          </AlertDescription>
        </Alert>
      )}
      {data.unresolved.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>
            {data.unresolved.length} unresolved capability requirement
            {data.unresolved.length === 1 ? '' : 's'}
          </AlertTitle>
          <AlertDescription>
            {data.unresolved
              .map(
                (item) =>
                  `${item.componentId}: ${item.capability} · ${item.optional ? 'optional' : 'required'} · ${item.reason}`,
              )
              .join(' · ')}
          </AlertDescription>
        </Alert>
      )}
      <section className="space-y-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Composition graph</CardTitle>
                <CardDescription className="mt-1">
                  Read from top to bottom. Select any component to inspect or
                  edit it without leaving the graph.
                </CardDescription>
                <GraphLegend />
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a component"
                    aria-label="Find a component"
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh graph"
                >
                  <RefreshCw className={loading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <GraphCanvas
              data={data}
              query={query}
              selectedId={selected.id}
              onSelect={(id) => {
                setSelectedId(id);
                onSelectComponent?.(id);
              }}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function GraphCanvas({
  data,
  query,
  selectedId,
  onSelect,
}: {
  data: StackGraphData;
  query: string;
  selectedId: string;
  onSelect(id: string): void;
}) {
  const graph = useMemo(() => layoutStackGraph(data.nodes, data.edges), [data]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element)
      element.scrollLeft = Math.max(
        0,
        (element.scrollWidth - element.clientWidth) / 2,
      );
  }, [graph.width]);
  const positions = new Map(graph.nodes.map((node) => [node.id, node]));
  const needle = query.trim().toLowerCase();
  const connected = new Set(
    data.edges
      .filter((edge) => edge.from === selectedId || edge.to === selectedId)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  connected.add(selectedId);
  return (
    <div
      ref={scroller}
      className="overflow-auto bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--border),transparent_15%)_1px,transparent_0)] bg-[size:22px_22px]"
      tabIndex={0}
      aria-label="Scrollable top-down Stack composition graph"
    >
      <svg
        className="mx-auto block"
        width={graph.width}
        height={graph.height}
        viewBox={`0 0 ${graph.width} ${graph.height}`}
        role="group"
        aria-label={`${data.summary.components} components and ${data.summary.edges} relationships`}
      >
        <defs>
          <marker
            id="graph-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="fill-slate-400" />
          </marker>
        </defs>
        {data.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const active = edge.from === selectedId || edge.to === selectedId;
          const x1 = from.x + GRAPH_NODE_WIDTH / 2,
            y1 = from.y + GRAPH_NODE_HEIGHT,
            x2 = to.x + GRAPH_NODE_WIDTH / 2,
            y2 = to.y;
          const middle = y1 + (y2 - y1) / 2;
          const title =
            edge.relation === 'capability'
              ? `${edge.from} provides ${edge.label} to ${edge.to}`
              : `${edge.to} depends on ${edge.from}`;
          return (
            <g key={edge.id} className={active ? 'opacity-100' : 'opacity-35'}>
              <path
                d={`M${x1} ${y1} C${x1} ${middle},${x2} ${middle},${x2} ${y2}`}
                fill="none"
                className={
                  edge.relation === 'capability'
                    ? 'stroke-primary'
                    : 'stroke-slate-500'
                }
                strokeWidth={active ? 2.5 : 1.5}
                strokeDasharray={edge.optional ? '7 5' : undefined}
                markerEnd="url(#graph-arrow)"
              />
              <title>
                {title} · {edge.optional ? 'optional' : 'required'}
              </title>
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const selected = node.id === selectedId;
          const matches =
            !needle ||
            `${node.name} ${node.id} ${node.kind} ${node.provides.join(' ')}`
              .toLowerCase()
              .includes(needle);
          const muted = needle ? !matches : !connected.has(node.id);
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.name}, ${node.kind}`}
              aria-pressed={selected}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
              className={`cursor-pointer outline-none transition-opacity ${muted ? 'opacity-35' : 'opacity-100'}`}
              transform={`translate(${node.x} ${node.y})`}
            >
              <rect
                width={GRAPH_NODE_WIDTH}
                height={GRAPH_NODE_HEIGHT}
                rx="14"
                className={
                  selected
                    ? 'fill-primary stroke-primary'
                    : matches && needle
                      ? 'fill-amber-50 stroke-amber-400'
                      : 'fill-card stroke-border'
                }
                strokeWidth={selected ? 3 : 1.5}
              />
              <text
                x="18"
                y="29"
                className={`text-[11px] font-bold uppercase tracking-wider ${selected ? 'fill-primary-foreground/70' : 'fill-muted-foreground'}`}
              >
                {node.kind}
              </text>
              <text
                x="18"
                y="55"
                className={`text-[15px] font-semibold ${selected ? 'fill-primary-foreground' : 'fill-foreground'}`}
              >
                {truncate(node.name, 24)}
              </text>
              <text
                x="18"
                y="79"
                className={`text-[11px] font-mono ${selected ? 'fill-primary-foreground/75' : 'fill-muted-foreground'}`}
              >
                {truncate(node.id, 29)}
              </text>
              <title>
                {node.name} · provides {node.provides.length} · consumes{' '}
                {node.consumes.length}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GraphLegend() {
  return (
    <div
      className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"
      aria-label="Relationship legend"
    >
      <LegendLine className="border-primary" label="Capability" />
      <LegendLine className="border-slate-500" label="Dependency" />
      <LegendLine className="border-dashed border-slate-500" label="Optional" />
    </div>
  );
}
function LegendLine({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-6 border-t-2 ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-[.12em]">
          {label}
        </CardDescription>
        <CardTitle className={`text-3xl ${attention ? 'text-amber-700' : ''}`}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
