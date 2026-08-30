import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeStack } from "../src/core/init.ts";
import { loadStack } from "../src/core/manifest.ts";

test("initializes a namespaced Stack with stable identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-init-"));
  try {
    await initializeStack(root, "example-team", "product-stack");
    const stack = await loadStack(root);
    assert.match(stack.manifest.metadata.id, /^[0-9a-f-]{36}$/u);
    assert.equal(stack.manifest.metadata.namespace, "example-team");
    assert.equal(stack.manifest.metadata.name, "product-stack");
    const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
    assert.match(gitignore, /^\.stack-workspace\/$/mu);
    assert.match(gitignore, /^\.stacks\/$/mu);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
