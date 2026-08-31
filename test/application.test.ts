import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    const knowledge = path.join(root, "components", "knowledge");
    await mkdir(knowledge, { recursive: true });
    await writeFile(path.join(knowledge, "engineering.md"), "# Engineering rules\n", "utf8");
    await application.addComponent({ stack: "tests/application", id: "knowledge", path: knowledge, kind: "knowledge", actor: { client: "test-client" } });
    await application.configureCapabilityExport("tests/application", "knowledge", {
      capability: "practice.engineering",
      context: [{ path: "engineering.md", strength: "required" }],
    }, { actor: { client: "test-client" } });
    await application.configureCapabilityExport("tests/application", "knowledge", {
      capability: "practice.engineering",
      context: [{ path: "engineering.md", strength: "required" }],
    }, { actor: { client: "test-client" } });
    await application.configureCapabilityRequirement("tests/application", "app", {
      capability: "practice.engineering", from: "knowledge",
    }, { actor: { client: "test-client" } });
    await application.configureGuidance("tests/application", "app", {
      path: "AGENTS.md", strength: "preferred",
    }, { actor: { client: "test-client" } });

    const components = await application.listComponents("tests/application");
    assert.equal(components.components[0]?.component.id, "app");
    assert.equal(components.components[0]?.binding, path.resolve(component));
    assert.equal((await application.getComponent("tests/application", "app")).component.kind, "product");
    const memberships = await application.findMemberships(component);
    assert.equal(memberships.resolution, "component");
    assert.equal(memberships.memberships[0]?.component.id, "app");
    const ancestorMemberships = await application.findMemberships(path.join(root, "components"));
    assert.equal(ancestorMemberships.resolution, "ancestor");
    assert.deepEqual(ancestorMemberships.memberships.map((item) => item.component.id), ["app", "knowledge"]);
    const context = await application.resolveContext({ stack: "tests/application" }, "app", "Follow shared engineering rules");
    assert.deepEqual(context.items.map((item) => [item.componentId, item.path, item.exists]), [
      ["knowledge", "engineering.md", true],
      ["app", "AGENTS.md", false],
    ]);
    assert.equal(context.briefing.items[0]?.content, "# Engineering rules\n");
    assert.equal(context.briefing.omissions[0]?.reason, "missing");

    const remote = path.join(root, "components", "remote");
    const rebound = path.join(root, "components", "remote-bound");
    await addRegisteredComponent("tests/application", { id: "remote", path: remote, git: "https://example.com/remote.git" }, directories);
    const bound = await application.bindComponent("tests/application", "remote", rebound, { materialize: false, actor: { client: "test-client" } });
    assert.equal(bound.sync.action, "clone");
    assert.equal(bound.sync.changed, false);
    assert.equal(existsSync(rebound), false);
    await application.bindComponent("tests/application", "remote", rebound, { materialize: false, actor: { client: "test-client" } });

    const activity = await application.getActivity({ stack: "tests/application" });
    assert.deepEqual(activity.recentChanges.map((event) => event.type), [
      "component.binding.changed",
      "component.configuration.changed",
      "component.configuration.changed",
      "component.configuration.changed",
      "component.added",
      "component.added",
      "stack.created",
    ]);
    assert.ok(activity.recentChanges.every((event) => event.actor?.client === "test-client"));

    const catalog = await application.getCatalogStatus();
    assert.equal(catalog.schemaVersion, "0.1");
    assert.equal(catalog.stacks.length, 1);
    assert.equal(catalog.stacks[0]?.stack.name, "application");
    assert.equal(catalog.stacks[0]?.components.find((item) => item.id === "app")?.root, path.resolve(component));

    const overview = await application.getOverview({ stack: "tests/application" });
    assert.equal(overview.workspace.mode, "registered");
    assert.equal(overview.summary.ready, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
