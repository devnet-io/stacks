import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveContext } from "../src/core/context.ts";
import { loadStack } from "../src/core/manifest.ts";
import { resolveComponentDescriptors } from "../src/core/component-descriptor.ts";
import { getComponentStatuses } from "../src/core/status.ts";

test("the foundational example is complete and resolves every declared context path", async () => {
  const stack = await loadStack(path.resolve("examples/foundation-stack"));
  const statuses = getComponentStatuses(stack);
  assert.ok(statuses.every((status) => status.exists));
  assert.ok(statuses.every((status) => status.issues.length === 0));

  const plan = resolveContext(stack, "product", "Build a paginated data editing screen");
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.warnings, []);
  assert.ok(plan.items.length >= 10);
  assert.ok(plan.items.every((item) => item.exists), plan.items.filter((item) => !item.exists).map((item) => item.absolutePath).join("\n"));
});

test("the Stacks repository dogfoods its manifest and resolves implementation context", async () => {
  const stack = await loadStack(path.resolve("."));
  const described = await resolveComponentDescriptors(stack);
  assert.equal(described.reports["stacks-core"]?.status, "valid");
  assert.deepEqual(described.reports["stacks-core"]?.appliedCapabilities, ["protocol.stacks.mcp"]);
  assert.deepEqual(described.reports["stacks-core"]?.overriddenCapabilities, ["tool.stacks.core"]);
  assert.equal(stack.manifest.metadata.name, "stacks-development");

  const plan = resolveContext(stack, "stacks-core", "Complete Milestone 1");
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.warnings, []);
  assert.ok(plan.items.every((item) => item.exists), plan.items.filter((item) => !item.exists).map((item) => item.absolutePath).join("\n"));

  const owners = new Set(plan.items.map((item) => item.componentId));
  assert.deepEqual(
    [...owners].sort(),
    ["$stack", "foundation-example", "stacks-agent-skill", "stacks-core"].sort(),
  );
});
