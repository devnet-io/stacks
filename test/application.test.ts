import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalStacksApplication } from "../src/application/stacks-application.ts";

test("StacksApplication owns catalog and status use-case orchestration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-application-"));
  const component = path.join(root, "components", "app");
  const application = createLocalStacksApplication({
    catalogDirectories: { config: path.join(root, "config"), state: path.join(root, "state") },
  });
  try {
    await mkdir(component, { recursive: true });
    await application.createStack("tests/application");
    await application.addComponent({ stack: "tests/application", id: "app", path: component, kind: "product" });

    const catalog = await application.getCatalogStatus();
    assert.equal(catalog.schemaVersion, "0.1");
    assert.equal(catalog.stacks.length, 1);
    assert.equal(catalog.stacks[0]?.stack.name, "application");
    assert.equal(catalog.stacks[0]?.components[0]?.root, path.resolve(component));

    const overview = await application.getOverview({ stack: "tests/application" });
    assert.equal(overview.workspace.mode, "registered");
    assert.equal(overview.summary.ready, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
