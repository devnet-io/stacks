import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { materializeContextBriefing } from "../src/core/briefing.ts";
import { resolveContext } from "../src/core/context.ts";
import { loadStack } from "../src/core/manifest.ts";

test("materializes task-sensitive context under a hard byte budget with explicit omissions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-briefing-"));
  const component = path.join(root, "product");
  const outside = path.join(root, "outside");
  try {
    await mkdir(component);
    await writeFile(path.join(component, "required.md"), "required rules\n", "utf8");
    await writeFile(path.join(component, "billing.md"), "billing guidance\n", "utf8");
    await writeFile(path.join(component, "profile.md"), "profile guidance\n", "utf8");
    await writeFile(path.join(component, "binary.dat"), Buffer.from([0, 1, 2]));
    await mkdir(outside);
    await writeFile(path.join(outside, "outside.md"), "outside\n", "utf8");
    await symlink(outside, path.join(component, "escape"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(path.join(root, "stack.json"), `${JSON.stringify({
      apiVersion: "stacks.dev/v0alpha1",
      kind: "Stack",
      metadata: { id: "briefing-test", namespace: "tests", name: "briefing" },
      components: [{
        id: "product",
        source: { type: "path", path: "product" },
        guidance: [
          { path: "required.md", strength: "required" },
          { path: "profile.md", strength: "preferred", tags: ["profile"] },
          { path: "billing.md", strength: "preferred", tags: ["billing"] },
          { path: "binary.dat", strength: "reference" },
          { path: "escape/outside.md", strength: "reference" },
          { path: "missing.md", strength: "reference" },
        ],
      }],
    }, null, 2)}\n`, "utf8");
    const stack = await loadStack(root);
    const plan = resolveContext(stack, "product", "Fix billing checkout");
    assert.deepEqual(plan.items.slice(0, 3).map((item) => item.path), ["required.md", "billing.md", "profile.md"]);
    assert.ok(plan.items.find((item) => item.path === "billing.md")!.taskScore > 0);

    const full = await materializeContextBriefing(stack, plan, { mode: "orientation", maxBytes: 128 });
    assert.deepEqual(full.items.slice(0, 3).map((item) => item.path), ["required.md", "billing.md", "profile.md"]);
    assert.ok(full.omissions.some((item) => item.path === "binary.dat" && item.reason === "binary"));
    assert.ok(full.omissions.some((item) => item.path === "escape/outside.md" && item.reason === "unsafe-path"));
    assert.ok(full.omissions.some((item) => item.path === "missing.md" && item.reason === "missing"));
    assert.match(full.digest, /^[a-f0-9]{64}$/u);

    const bounded = await materializeContextBriefing(stack, plan, { mode: "refresh", maxBytes: 8 });
    assert.equal(bounded.budget.usedBytes, 8);
    assert.equal(bounded.items[0]?.content, "required");
    assert.equal(bounded.items[0]?.truncated, true);
    assert.ok(bounded.omissions.some((item) => item.reason === "budget"));
    await assert.rejects(materializeContextBriefing(stack, plan, { maxBytes: 0 }), /from 1 through 262144/u);
    await assert.rejects(materializeContextBriefing(stack, plan, { maxBytes: 262145 }), /from 1 through 262144/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
