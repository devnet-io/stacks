import type { StackGraphEdge, StackGraphNode } from '../../../src/application/graph.ts';

export const GRAPH_NODE_WIDTH = 224;
export const GRAPH_NODE_HEIGHT = 104;

export interface PositionedGraphNode extends StackGraphNode {
  x: number;
  y: number;
}

export interface StackGraphLayout {
  nodes: PositionedGraphNode[];
  width: number;
  height: number;
}

export function layoutStackGraph(nodes: StackGraphNode[], edges: StackGraphEdge[]): StackGraphLayout {
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const rank = new Map(nodes.map((node) => [node.id, 0]));
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id).sort();
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    visited.add(id);
    for (const target of (outgoing.get(id) ?? []).sort()) {
      rank.set(target, Math.max(rank.get(target) ?? 0, (rank.get(id) ?? 0) + 1));
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) {
        queue.push(target);
        queue.sort();
      }
    }
  }

  const lastRank = Math.max(0, ...rank.values());
  for (const node of nodes) if (!visited.has(node.id)) rank.set(node.id, lastRank + 1);

  const layers = new Map<number, StackGraphNode[]>();
  for (const node of nodes) {
    const nodeRank = rank.get(node.id) ?? 0;
    layers.set(nodeRank, [...(layers.get(nodeRank) ?? []), node]);
  }

  const horizontalGap = 48;
  const verticalGap = 96;
  const horizontalPadding = 48;
  const verticalPadding = 48;
  const orderedLayers = [...layers].sort(([a], [b]) => a - b);
  const widestLayer = Math.max(1, ...orderedLayers.map(([, layer]) => layer.length));
  const contentWidth = widestLayer * GRAPH_NODE_WIDTH + Math.max(0, widestLayer - 1) * horizontalGap;
  const width = Math.max(720, contentWidth + horizontalPadding * 2);
  const positioned: PositionedGraphNode[] = [];

  for (const [layerIndex, [, layer]] of orderedLayers.entries()) {
    layer.sort((a, b) => a.id.localeCompare(b.id));
    const layerWidth = layer.length * GRAPH_NODE_WIDTH + Math.max(0, layer.length - 1) * horizontalGap;
    const startX = (width - layerWidth) / 2;
    layer.forEach((node, column) => positioned.push({
      ...node,
      x: startX + column * (GRAPH_NODE_WIDTH + horizontalGap),
      y: verticalPadding + layerIndex * (GRAPH_NODE_HEIGHT + verticalGap),
    }));
  }

  const height = Math.max(360, verticalPadding * 2 + orderedLayers.length * GRAPH_NODE_HEIGHT + Math.max(0, orderedLayers.length - 1) * verticalGap);
  return { nodes: positioned, width, height };
}
