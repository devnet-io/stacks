import assert from 'node:assert/strict';
import test from 'node:test';
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH, layoutStackGraph } from '../apps/web/lib/graph-layout.ts';
import type { StackGraphEdge, StackGraphNode } from '../src/application/graph.ts';

function node(id: string): StackGraphNode {
  return { id, name: id, kind: 'component', sourceType: 'path', access: 'read-write', provides: [], consumes: [], requirements: [], artifacts: [] };
}

test('lays out provider relationships from top to bottom and centers each layer', () => {
  const nodes = ['provider-b', 'consumer', 'provider-a'].map(node);
  const edges: StackGraphEdge[] = [
    { id: 'a', from: 'provider-a', to: 'consumer', relation: 'capability', label: 'capability.a', optional: false },
    { id: 'b', from: 'provider-b', to: 'consumer', relation: 'capability', label: 'capability.b', optional: true },
  ];

  const graph = layoutStackGraph(nodes, edges);
  const providerA = graph.nodes.find((item) => item.id === 'provider-a')!;
  const providerB = graph.nodes.find((item) => item.id === 'provider-b')!;
  const consumer = graph.nodes.find((item) => item.id === 'consumer')!;

  assert.equal(providerA.y, providerB.y);
  assert.ok(consumer.y >= providerA.y + GRAPH_NODE_HEIGHT);
  assert.equal(consumer.x + GRAPH_NODE_WIDTH / 2, graph.width / 2);
  assert.deepEqual(graph.nodes.map((item) => item.id), ['provider-a', 'provider-b', 'consumer']);
});

test('keeps disconnected and cyclic nodes in a deterministic final layer', () => {
  const nodes = ['z', 'a'].map(node);
  const edges: StackGraphEdge[] = [
    { id: 'a-z', from: 'a', to: 'z', relation: 'dependency', label: 'depends on', optional: false },
    { id: 'z-a', from: 'z', to: 'a', relation: 'dependency', label: 'depends on', optional: false },
  ];
  const graph = layoutStackGraph(nodes, edges);
  assert.deepEqual(graph.nodes.map((item) => item.id), ['a', 'z']);
  assert.equal(graph.nodes[0]!.y, graph.nodes[1]!.y);
});
