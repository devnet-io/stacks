import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildStackGraph } from "../src/application/graph.ts";
import { loadStack } from "../src/core/manifest.ts";

test("builds a deterministic provider-to-consumer graph for the foundation Stack", async () => {
  const graph = buildStackGraph(await loadStack(path.resolve("examples/foundation-stack")));
  assert.equal(graph.schemaVersion, "0.1");
  assert.deepEqual(graph.summary, { components: 5, edges: 10, capabilities: 6, unresolved: 0 });
  assert.deepEqual(graph.nodes.map((node) => node.id), [...graph.nodes.map((node) => node.id)].sort());
  assert.ok(graph.edges.some((edge) => edge.from === "ui-primitives" && edge.to === "ui-patterns" && edge.label === "ui.react.primitives"));
  assert.ok(graph.edges.some((edge) => edge.from === "cloudflare-reference" && edge.to === "product" && edge.label === "platform.cloudflare.d1-patterns"));
  assert.ok(graph.nodes.find((node) => node.id === "product")?.requirements.every((requirement) => requirement.optional === false));
  assert.deepEqual(graph.unresolved, []);
});

test("reports ambiguous, missing, mismatched, and unknown capability providers", async () => {
  const stack = await loadStack(path.resolve("examples/foundation-stack"));
  const copy = structuredClone(stack);
  copy.manifest.components.push({ id: "other-standards", source: { type: "path", path: "components/standards" }, provides: [{ capability: "practice.software-development" }] });
  const product = copy.manifest.components.find((component) => component.id === "product")!;
  product.consumes = [
    { capability: "practice.software-development" },
    { capability: "missing.required" },
    { capability: "ui.react.primitives", from: "standards" },
    { capability: "anything", from: "unknown-component", optional: true },
  ];
  const graph = buildStackGraph(copy);
  assert.deepEqual(graph.unresolved.map((item) => item.reason).sort(), ["ambiguous-provider", "missing-provider", "provider-mismatch", "unknown-provider"].sort());
  assert.deepEqual(graph.unresolved.find((item) => item.reason === "ambiguous-provider")?.candidates, ["other-standards", "standards"]);
  assert.equal(graph.unresolved.find((item) => item.reason === "unknown-provider")?.optional, true);
  assert.equal(graph.nodes.find((node) => node.id === "product")?.requirements.find((item) => item.capability === "anything")?.optional, true);
});
