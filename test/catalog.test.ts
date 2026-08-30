import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addRegisteredComponent, createRegisteredStack, findRegisteredComponentMemberships, listRegisteredStacks, loadRegisteredStack, platformDirectories } from "../src/core/catalog.ts";
import { componentRoot, stateDirectory } from "../src/core/paths.ts";

test("platform directories are lowercase and follow native conventions", () => {
  const linux = platformDirectories("linux", {}, "/home/joe");
  assert.ok(linux.config.replaceAll("\\", "/").endsWith("/home/joe/.config/stacks"));
  assert.ok(linux.state.replaceAll("\\", "/").endsWith("/home/joe/.local/state/stacks"));
  const mac = platformDirectories("darwin", {}, "/Users/joe");
  assert.ok(mac.config.replaceAll("\\", "/").endsWith("/Users/joe/Library/Application Support/stacks"));
  assert.ok(mac.state.replaceAll("\\", "/").endsWith("/Users/joe/Library/Application Support/stacks/state"));
  const windows = platformDirectories("win32", { APPDATA: "C:\\Users\\Joe\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\Joe\\AppData\\Local" }, "C:\\Users\\Joe");
  assert.ok(windows.config.endsWith(path.join("Roaming", "stacks")));
  assert.ok(windows.state.endsWith(path.join("Local", "stacks")));
});

test("global catalog stores readable definitions and explicit component bindings", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-catalog-"));
  const directories = { config: path.join(root, "config", "stacks"), state: path.join(root, "state", "stacks") };
  const shared = path.join(root, "components", "shared-ui");
  await mkdir(shared, { recursive: true });
  try {
    await createRegisteredStack("devnet/platform", directories);
    await createRegisteredStack("devnet/internal-tools", directories);
    await addRegisteredComponent("devnet/platform", { id: "shared-ui", path: shared, kind: "library" }, directories);
    await addRegisteredComponent("devnet/internal-tools", { id: "shared-ui", path: shared, kind: "library" }, directories);
    const stacks = await listRegisteredStacks(directories);
    assert.deepEqual(stacks.map((entry) => `${entry.namespace}/${entry.name}`), ["devnet/internal-tools", "devnet/platform"]);
    const platform = await loadRegisteredStack("devnet/platform", directories);
    assert.equal(platform.registered, true);
    assert.equal(componentRoot(platform, platform.manifest.components[0]!), path.resolve(shared));
    assert.equal(stateDirectory(platform), path.join(directories.state, "stacks", platform.manifest.metadata.id));
    const definition = await readFile(platform.manifestPath, "utf8");
    assert.match(definition, /"type": "local"/u);
    assert.doesNotMatch(definition, /shared-ui[\\/]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("directory membership discovery returns every matching Stack without guessing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-memberships-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const shared = path.join(root, "shared");
  const nested = path.join(shared, "src", "feature");
  await mkdir(nested, { recursive: true });
  try {
    await createRegisteredStack("tests/first", directories);
    await createRegisteredStack("tests/second", directories);
    await addRegisteredComponent("tests/first", { id: "shared", path: shared }, directories);
    await addRegisteredComponent("tests/second", { id: "other-name", path: shared, kind: "library" }, directories);
    const memberships = await findRegisteredComponentMemberships(nested, directories);
    assert.deepEqual(memberships.map((item) => `${item.stack.namespace}/${item.stack.name}:${item.component.id}`), ["tests/first:shared", "tests/second:other-name"]);
    assert.ok(memberships.every((item) => item.relativePath === path.join("src", "feature")));
    assert.equal(memberships[0]?.component.kind, "component");
    assert.deepEqual(await findRegisteredComponentMemberships(root, directories), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("catalog mutations serialize across concurrent writers without losing components", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-catalog-concurrency-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  try {
    await Promise.all([mkdir(first), mkdir(second)]);
    await createRegisteredStack("tests/concurrent", directories);
    await Promise.all([
      addRegisteredComponent("tests/concurrent", { id: "first", path: first }, directories),
      addRegisteredComponent("tests/concurrent", { id: "second", path: second }, directories),
    ]);
    const stack = await loadRegisteredStack("tests/concurrent", directories);
    assert.deepEqual(stack.manifest.components.map((component) => component.id).sort(), ["first", "second"]);
    assert.equal(stack.bindings?.first, path.resolve(first));
    assert.equal(stack.bindings?.second, path.resolve(second));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
