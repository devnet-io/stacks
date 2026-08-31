import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalStacksApplication } from "../src/application/stacks-application.ts";
import { addRegisteredComponent } from "../src/core/catalog.ts";

test("StacksApplication owns catalog and status use-case orchestration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-application-"));
  const component = path.join(root, "components", "app");
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const application = createLocalStacksApplication({
    catalogDirectories: directories,
  });
  try {
    await mkdir(component, { recursive: true });
    await application.createStack("tests/application", { actor: { client: "test-client" } });
    await application.addComponent({ stack: "tests/application", id: "app", path: component, kind: "product", actor: { client: "test-client" } });

    const components = await application.listComponents("tests/application");
    assert.equal(components.components[0]?.component.id, "app");
    assert.equal(components.components[0]?.binding, path.resolve(component));
    assert.equal((await application.getComponent("tests/application", "app")).component.kind, "product");
    const memberships = await application.findMemberships(component);
    assert.equal(memberships.memberships[0]?.component.id, "app");

    const remote = path.join(root, "components", "remote");
    const rebound = path.join(root, "components", "remote-bound");
    await addRegisteredComponent("tests/application", { id: "remote", path: remote, git: "https://example.com/remote.git" }, directories);
    const bound = await application.bindComponent("tests/application", "remote", rebound, { materialize: false, actor: { client: "test-client" } });
    assert.equal(bound.sync.action, "clone");
    assert.equal(bound.sync.changed, false);
    assert.equal(existsSync(rebound), false);
    await application.bindComponent("tests/application", "remote", rebound, { materialize: false, actor: { client: "test-client" } });

    const activity = await application.getActivity({ stack: "tests/application" });
    assert.deepEqual(activity.recentEvents.map((event) => event.type), ["component.binding.changed", "component.added", "stack.created"]);
    assert.ok(activity.recentEvents.every((event) => event.actor?.client === "test-client"));

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
