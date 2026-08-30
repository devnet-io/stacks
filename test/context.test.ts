import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadStack } from "../src/core/manifest.ts";
import { resolveContext } from "../src/core/context.ts";
import { componentRoot } from "../src/core/paths.ts";

const exampleRoot = path.resolve("examples/foundation-stack");

test("resolves layered capability context with explanations", async () => {
  const stack = await loadStack(exampleRoot);
  const plan = resolveContext(stack, "product", "Build a paginated administration page");
  assert.deepEqual(plan.errors, []);
  const owners = new Set(plan.items.map((item) => item.componentId));
  assert.deepEqual(
    [...owners].sort(),
    ["$stack", "cloudflare-reference", "product", "standards", "ui-patterns", "ui-primitives"].sort(),
  );
  assert.ok(plan.items.some((item) => item.path === "docs/paginated-data-page.md"));
  assert.ok(plan.items.some((item) => item.path === "standards/agent-loop.md" && item.strength === "required"));
  assert.ok(plan.items.every((item) => item.reasons.length > 0));
  assert.equal(plan.task, "Build a paginated administration page");
});

test("reports an ambiguous implicit capability provider", async () => {
  const stack = await loadStack(exampleRoot);
  const copy = structuredClone(stack);
  copy.manifest.components.push({
    id: "other-primitives",
    kind: "library",
    source: { type: "path", path: "components/ui-primitives" },
    provides: [{ capability: "ui.react.primitives", context: [{ path: "README.md" }] }],
  });
  const patterns = copy.manifest.components.find((component) => component.id === "ui-patterns");
  assert.ok(patterns);
  const requirement = patterns.consumes?.find((item) => item.capability === "ui.react.primitives");
  assert.ok(requirement);
  delete requirement.from;
  const plan = resolveContext(copy, "product");
  assert.ok(plan.errors.some((error) => error.includes("Ambiguous providers")));
});

test("rejects a component path that escapes the Stack root", async () => {
  const stack = await loadStack(exampleRoot);
  const component = structuredClone(stack.manifest.components[0]!);
  component.source = { type: "path", path: "../outside" };
  assert.throws(() => componentRoot(stack, component), /escapes its allowed root/u);
});
