import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StackOverview } from "../src/application/overview.ts";
import type { StackIntegrations } from "../src/application/integrations.ts";
import type { StackGraph } from "../src/application/graph.ts";
import type { StackActivity } from "../src/application/activity.ts";
import { startWork } from "../src/core/events.ts";
import { loadStack } from "../src/core/manifest.ts";
import { startLocalApi } from "../src/http/server.ts";
import { addRegisteredComponent, createRegisteredStack } from "../src/core/catalog.ts";
import { browserOpenCommand, existingStacksWeb, findPackageRoot } from "../src/ui/launcher.ts";

test("global local API lists and explicitly selects registered Stacks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-global-http-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const component = path.join(root, "app");
  const rebound = path.join(root, "rebound-app");
  await mkdir(component, { recursive: true });
  await mkdir(rebound, { recursive: true });
  await createRegisteredStack("acme/one", directories);
  await createRegisteredStack("acme/two", directories);
  await addRegisteredComponent("acme/two", { id: "app", path: component }, directories);
  const api = await startLocalApi({ port: 0, catalogDirectories: directories });
  try {
    const catalog = await (await fetch(`${api.origin}/api/v0.1/stacks`)).json() as { stacks: Array<{ name: string }> };
    assert.deepEqual(catalog.stacks.map((stack) => stack.name), ["one", "two"]);
    const selected = await (await fetch(`${api.origin}/api/v0.1/overview?stack=acme%2Ftwo`)).json() as StackOverview;
    assert.equal(selected.stack.name, "two");
    assert.equal(selected.workspace.mode, "registered");
    assert.equal(selected.components[0]?.root, path.resolve(component));

    const created = await fetch(`${api.origin}/api/v0.1/stacks`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: api.origin }, body: JSON.stringify({ selector: "acme/three" }),
    });
    assert.equal(created.status, 201);
    assert.equal(((await created.json()) as { stack: { name: string } }).stack.name, "three");

    const added = await fetch(`${api.origin}/api/v0.1/components`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: api.origin },
      body: JSON.stringify({ stack: "acme/three", id: "app", path: component, kind: "product" }),
    });
    assert.equal(added.status, 201, await added.text());

    const bound = await fetch(`${api.origin}/api/v0.1/component-binding`, {
      method: "PUT", headers: { "Content-Type": "application/json", Origin: api.origin },
      body: JSON.stringify({ stack: "acme/three", componentId: "app", path: rebound }),
    });
    assert.equal(bound.status, 200, await bound.text());
    const managed = await (await fetch(`${api.origin}/api/v0.1/overview?stack=acme%2Fthree`)).json() as StackOverview;
    assert.equal(managed.components[0]?.root, path.resolve(rebound));

    const duplicate = await fetch(`${api.origin}/api/v0.1/stacks`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selector: "acme/three" }),
    });
    assert.equal(duplicate.status, 409);
    const hostile = await fetch(`${api.origin}/api/v0.1/stacks`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ selector: "acme/hostile" }),
    });
    assert.equal(hostile.status, 403);
  } finally { await api.close(); await rm(root, { recursive: true, force: true }); }
});

test("local overview API is Stack-scoped, versioned, read-only, and browser-accessible", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-http-"));
  const staticRoot = path.join(root, "web");
  await mkdir(staticRoot);
  await writeFile(path.join(staticRoot, "index.html"), "<!doctype html><title>Stacks test</title>\n", "utf8");
  await writeFile(path.join(staticRoot, "stacks-web.json"), '{"schemaVersion":"0.1","product":"stacks","role":"local-web"}\n', "utf8");
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

  const loaded = await loadStack(root);
  await startWork(loaded, { componentId: "ready", summary: "Test the Activity API" });

  const api = await startLocalApi({ root, port: 0, staticRoot, hostedMcp: { url: "https://mcp.example.test", bearerTokenEnvVar: "STACKS_MCP_TOKEN" } });
  try {
    const response = await fetch(`${api.origin}/api/v0.1/overview?root=ignored`, {
      headers: { Origin: "http://localhost:3210" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3210");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const overview = await response.json() as StackOverview;
    assert.equal(overview.schemaVersion, "0.1");
    assert.deepEqual(overview.stack, { id: "http-test-id", namespace: "tests", name: "http-test", version: "1.2.3" });
    assert.deepEqual(overview.summary, { components: 2, ready: 1, dirty: 0, missing: 1, issues: 0 });
    assert.deepEqual(overview.components.map((component) => [component.id, component.health]), [["ready", "ready"], ["missing", "missing"]]);
    assert.equal(overview.workspace.mode, "legacy-directory");
    assert.equal(overview.workspace.legacyRoot, root);
    assert.equal(overview.workspace.definitionPath, path.join(root, "stack.json"));
    assert.equal(await readText(path.join(root, "stack.json")), true);

    const page = await fetch(api.origin);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/u);
    assert.match(await page.text(), /Stacks test/u);
    const marker = await (await fetch(`${api.origin}/stacks-web.json`)).json() as { product: string };
    assert.equal(marker.product, "stacks");
    const traversal = await fetch(`${api.origin}/..%2Fstack.json`);
    assert.equal(traversal.status, 404);

    const integrationResponse = await fetch(`${api.origin}/api/v0.1/integrations?root=ignored`);
    assert.equal(integrationResponse.status, 200);
    const integrations = await integrationResponse.json() as StackIntegrations;
    assert.equal(integrations.stack.definitionPath, path.join(root, "stack.json"));
    assert.equal(integrations.mcp.local.transport, "stdio");
    assert.equal(integrations.mcp.hosted.url, "https://mcp.example.test/");
    assert.equal(integrations.mcp.hosted.bearerTokenEnvVar, "STACKS_MCP_TOKEN");

    const graphResponse = await fetch(`${api.origin}/api/v0.1/graph?root=ignored`);
    assert.equal(graphResponse.status, 200);
    const graph = await graphResponse.json() as StackGraph;
    assert.equal(graph.stack.id, "http-test-id");
    assert.deepEqual(graph.summary, { components: 2, edges: 0, capabilities: 0, unresolved: 0 });

    const activityResponse = await fetch(`${api.origin}/api/v0.1/activity?root=ignored`);
    assert.equal(activityResponse.status, 200);
    const activity = await activityResponse.json() as StackActivity;
    assert.equal(activity.stack.id, "http-test-id");
    assert.equal(activity.summary.activeSessions, 1);
    assert.equal(activity.recentEvents[0]?.summary, "Test the Activity API");

    const unknown = await fetch(`${api.origin}/api/v0.1/not-real`);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { schemaVersion: "0.1", error: "Not found." });

    const mutation = await fetch(`${api.origin}/api/v0.1/overview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(mutation.status, 405);
  } finally {
    await api.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("UI launcher resolves the checked-in web workspace", async () => {
  assert.equal(await findPackageRoot(), path.resolve("."));
});

test("UI launcher only reuses a compatible Stacks web client", async () => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url === "/stacks-web.json"
      ? { schemaVersion: "0.1", product: "stacks", role: "local-web" }
      : request.url === "/api/v0.1/health"
        ? { schemaVersion: "0.1", status: "ok" }
        : { product: "not-stacks" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    assert.equal(await existingStacksWeb(address.port), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("UI launcher does not reuse a stale frontend without a healthy same-origin API", async () => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.statusCode = request.url === "/stacks-web.json" ? 200 : 404;
    response.end(JSON.stringify(request.url === "/stacks-web.json"
      ? { schemaVersion: "0.1", product: "stacks", role: "local-web" }
      : { error: "Not found." }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    assert.equal(await existingStacksWeb(address.port), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("UI launcher opens the exact Stack URL without a shell on supported platforms", () => {
  const url = "http://localhost:3210/";
  assert.deepEqual(browserOpenCommand(url, "win32"), { command: "explorer.exe", args: [url] });
  assert.deepEqual(browserOpenCommand(url, "darwin"), { command: "open", args: [url] });
  assert.deepEqual(browserOpenCommand(url, "linux"), { command: "xdg-open", args: [url] });
  assert.equal(browserOpenCommand(url, "aix"), undefined);
});

async function readText(file: string): Promise<boolean> {
  const { readFile } = await import("node:fs/promises");
  return (await readFile(file, "utf8")).includes('"http-test-id"');
}
