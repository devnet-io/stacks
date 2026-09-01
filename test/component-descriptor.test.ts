import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalStacksApplication } from "../src/application/stacks-application.ts";

test("composes validated provider descriptors under explicit Stack overlays", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-component-descriptor-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const ui = path.join(root, "ui");
  const product = path.join(root, "product");
  const application = new LocalStacksApplication({ catalogDirectories: directories });
  try {
    await Promise.all([mkdir(path.join(ui, ".stack"), { recursive: true }), mkdir(product, { recursive: true })]);
    await writeFile(path.join(ui, "descriptor-dialog.md"), "# Descriptor dialog\n", "utf8");
    await writeFile(path.join(ui, "stack-button.md"), "# Stack button\n", "utf8");
    await writeFile(path.join(ui, ".stack", "component.json"), JSON.stringify({
      schemaVersion: "0.1",
      provides: [
        { capability: "ui.button", context: [{ path: "descriptor-button.md" }] },
        { capability: "ui.dialog", description: "Shared accessible dialog", context: [{ path: "descriptor-dialog.md", strength: "preferred" }], artifact: { ecosystem: "npm", name: "@tests/ui", path: "." } },
      ],
    }), "utf8");
    await application.createStack("tests/descriptors");
    await application.addComponent({ stack: "tests/descriptors", id: "ui", path: ui, kind: "library" });
    await application.addComponent({ stack: "tests/descriptors", id: "product", path: product, kind: "product" });
    await application.configureCapabilityExport("tests/descriptors", "ui", { capability: "ui.button", context: [{ path: "stack-button.md", strength: "required" }] });
    await application.configureCapabilityRequirement("tests/descriptors", "product", { capability: "ui.button", from: "ui" });
    await application.configureCapabilityRequirement("tests/descriptors", "product", { capability: "ui.dialog", from: "ui" });

    const inspected = await application.getComponent("tests/descriptors", "ui");
    assert.equal(inspected.descriptor.status, "valid");
    assert.deepEqual(inspected.descriptor.appliedCapabilities, ["ui.dialog"]);
    assert.deepEqual(inspected.descriptor.overriddenCapabilities, ["ui.button"]);
    assert.deepEqual(inspected.component.provides?.map((item) => [item.capability, item.context?.[0]?.path]), [
      ["ui.dialog", "descriptor-dialog.md"],
      ["ui.button", "stack-button.md"],
    ]);
    const definition = await application.getStack({ stack: "tests/descriptors" });
    assert.deepEqual(definition.manifest.components.find((item) => item.id === "ui")?.provides?.map((item) => item.capability), ["ui.button"]);
    assert.deepEqual(definition.effectiveManifest.components.find((item) => item.id === "ui")?.provides?.map((item) => item.capability), ["ui.dialog", "ui.button"]);
    const graph = await application.getGraph({ stack: "tests/descriptors" });
    assert.deepEqual(graph.nodes.find((item) => item.id === "ui")?.provides, ["ui.button", "ui.dialog"]);
    assert.deepEqual(graph.nodes.find((item) => item.id === "ui")?.artifacts, [{ capability: "ui.dialog", ecosystem: "npm", name: "@tests/ui" }]);
    const context = await application.resolveContext({ stack: "tests/descriptors" }, "product", "Use the shared dialog");
    assert.ok(context.items.some((item) => item.path === "descriptor-dialog.md" && item.componentId === "ui"));
    assert.ok(context.items.some((item) => item.path === "stack-button.md" && item.componentId === "ui"));
    assert.deepEqual(context.artifactGuidance.map((item) => [item.capability, item.artifact.name, item.localFallback?.dependencySpecifier]), [["ui.dialog", "@tests/ui", "file:../ui"]]);
    assert.deepEqual(context.artifactGuidance[0]?.strategyOrder, ["existing-project-configuration", "workspace", "registry", "local-file"]);

    await writeFile(path.join(ui, ".stack", "component.json"), JSON.stringify({ schemaVersion: "0.1", provides: [{ capability: "ui.bad", context: [{ path: "../escape.md" }] }], consumes: [] }), "utf8");
    const invalid = await application.getComponent("tests/descriptors", "ui");
    assert.equal(invalid.descriptor.status, "invalid");
    assert.match(invalid.descriptor.errors.join(" "), /consumes is not supported/u);
    assert.match(invalid.descriptor.errors.join(" "), /escapes its allowed root/u);
    assert.deepEqual(invalid.component.provides?.map((item) => item.capability), ["ui.button"]);
    assert.equal((await application.validateStack({ stack: "tests/descriptors" })).valid, false);
    const invalidContext = await application.resolveContext({ stack: "tests/descriptors" }, "product");
    assert.ok(invalidContext.warnings.some((warning) => warning.includes("descriptor invalid")));
    assert.ok((await application.getStatus({ stack: "tests/descriptors" })).components.find((item) => item.id === "ui")?.issues.some((issue) => issue.includes("descriptor invalid")));

    await writeFile(path.join(ui, ".stack", "component.json"), "x".repeat(65_537), "utf8");
    const oversized = await application.getComponent("tests/descriptors", "ui");
    assert.equal(oversized.descriptor.status, "invalid");
    assert.match(oversized.descriptor.errors[0] ?? "", /exceeds the 65536-byte limit/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
