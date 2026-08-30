import assert from "node:assert/strict";
import test from "node:test";
import { validateManifest } from "../src/core/validation.ts";

const base = {
  apiVersion: "stacks.dev/v0alpha1",
  kind: "Stack",
  metadata: { id: "test-stack", namespace: "tests", name: "test" },
  components: [
    { id: "standards", source: { type: "path", path: "standards" } },
    {
      id: "app",
      source: { type: "path", path: "app" },
      dependsOn: ["standards"],
      consumes: [{ capability: "practice.dev", from: "standards" }],
    },
  ],
};

test("validates a minimal Stack manifest", () => {
  const result = validateManifest(base);
  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("reports duplicate and unknown component references", () => {
  const manifest = structuredClone(base);
  manifest.components.push({ id: "app", source: { type: "path", path: "other" } } as never);
  manifest.components[1]!.dependsOn = ["missing"];
  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Duplicate component id: app")));
  assert.ok(result.errors.some((error) => error.includes("unknown component missing")));
});

test("requires stable Stack identity and namespace", () => {
  const manifest = structuredClone(base) as unknown as { metadata: Record<string, unknown> };
  delete manifest.metadata["id"];
  delete manifest.metadata["namespace"];
  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("metadata.id")));
  assert.ok(result.errors.some((error) => error.includes("metadata.namespace")));
});
