import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StackOverview } from "../src/application/overview.ts";
import { startLocalApi } from "../src/http/server.ts";
import { findPackageRoot } from "../src/ui/launcher.ts";

test("local overview API is Stack-scoped, versioned, read-only, and browser-accessible", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-http-"));
  await mkdir(path.join(root, "ready"));
  await writeFile(path.join(root, "stack.json"), `${JSON.stringify({
    apiVersion: "stacks.dev/v0alpha1",
    kind: "Stack",
    metadata: { id: "http-test-id", namespace: "tests", name: "http-test", version: "1.2.3" },
    workspace: { directory: ".stack-workspace", stateDirectory: ".stacks" },
    components: [
      { id: "ready", name: "Ready component", source: { type: "path", path: "ready" } },
      { id: "missing", source: { type: "path", path: "missing" } },
    ],
  }, null, 2)}\n`, "utf8");

  const api = await startLocalApi({ root, port: 0 });
  try {
    const response = await fetch(`${api.origin}/api/v0.1/overview?root=ignored`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const overview = await response.json() as StackOverview;
    assert.equal(overview.schemaVersion, "0.1");
    assert.deepEqual(overview.stack, { id: "http-test-id", namespace: "tests", name: "http-test", version: "1.2.3" });
    assert.deepEqual(overview.summary, { components: 2, ready: 1, dirty: 0, missing: 1, issues: 0 });
    assert.deepEqual(overview.components.map((component) => [component.id, component.health]), [["ready", "ready"], ["missing", "missing"]]);
    assert.equal(overview.workspace.root, root);
    assert.equal(await readText(path.join(root, "stack.json")), true);

    const unknown = await fetch(`${api.origin}/api/v0.1/not-real`);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { schemaVersion: "0.1", error: "Not found." });

    const mutation = await fetch(`${api.origin}/api/v0.1/overview`, { method: "POST" });
    assert.equal(mutation.status, 405);
  } finally {
    await api.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("UI launcher resolves the checked-in web workspace", async () => {
  assert.equal(await findPackageRoot(), path.resolve("."));
});

async function readText(file: string): Promise<boolean> {
  const { readFile } = await import("node:fs/promises");
  return (await readFile(file, "utf8")).includes('"http-test-id"');
}
