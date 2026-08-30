import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.resolve("src/cli.ts");

function runJson(args: string[], expectedStatus = 0): Record<string, unknown> {
  const execution = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args, "--json"], {
    cwd: path.resolve("."),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(execution.status, expectedStatus, execution.stderr || execution.stdout);
  assert.equal(execution.stderr, "");
  return JSON.parse(execution.stdout) as Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test("CLI JSON contracts cover the five-minute Stack lifecycle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-cli-json-"));
  try {
    const initialized = runJson(["init", "--namespace", "tests", "--name", "cli-json", "--root", root]);
    assert.equal(initialized.schemaVersion, "0.1");
    assert.equal(initialized.manifestPath, path.join(root, "stack.json"));
    const identity = object(initialized.stack);
    assert.equal(identity.namespace, "tests");
    assert.equal(identity.name, "cli-json");
    assert.equal(typeof identity.id, "string");

    await mkdir(path.join(root, "app"));
    await writeFile(path.join(root, "app", "README.md"), "# App\n", "utf8");
    const manifest = JSON.parse(await readFile(path.join(root, "stack.json"), "utf8")) as Record<string, unknown>;
    manifest.components = [{
      id: "app",
      kind: "product",
      source: { type: "path", path: "app" },
      guidance: [{ path: "README.md", strength: "required" }],
    }];
    await writeFile(path.join(root, "stack.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const validated = runJson(["validate", "--root", root]);
    assert.deepEqual(Object.keys(validated).sort(), ["errors", "manifestPath", "schemaVersion", "stack", "valid"]);
    assert.equal(validated.valid, true);
    assert.deepEqual(validated.stack, identity);

    const status = runJson(["status", "--root", root]);
    assert.deepEqual(Object.keys(status).sort(), ["components", "schemaVersion", "stack"]);
    assert.deepEqual(status.stack, identity);
    assert.equal((status.components as unknown[]).length, 1);

    const synced = runJson(["sync", "--root", root, "--dry-run"]);
    assert.deepEqual(Object.keys(synced).sort(), ["results", "schemaVersion", "stack"]);
    assert.equal(object((synced.results as unknown[])[0]).action, "inspect");

    const locked = runJson(["lock", "--root", root]);
    assert.deepEqual(Object.keys(locked).sort(), ["lockPath", "schemaVersion", "stack"]);
    const lock = JSON.parse(await readFile(String(locked.lockPath), "utf8")) as Record<string, unknown>;
    assert.equal(lock.stackId, identity.id);

    const context = runJson(["context", "app", "--task", "Evaluate the app", "--root", root]);
    assert.equal(context.schemaVersion, "0.1");
    assert.equal(context.stackId, identity.id);
    assert.equal(context.targetComponentId, "app");
    assert.equal((context.items as unknown[]).length, 1);

    const started = runJson(["checkin", "start", "--component", "app", "--summary", "Start evaluation", "--root", root]);
    assert.equal(started.schemaVersion, "0.1");
    assert.equal(started.stackId, identity.id);
    assert.equal(started.type, "work.started");
    assert.equal(typeof started.sessionId, "string");

    const usage = runJson([
      "usage", "record", "--session", String(started.sessionId), "--provider", "test-provider", "--model", "test-model",
      "--input", "10", "--output", "5", "--amount", "0.01", "--currency", "USD", "--cost-kind", "reported", "--root", root,
    ]);
    assert.equal(usage.type, "usage.recorded");
    assert.equal(object(usage.data).costKind, "reported");

    const report = runJson(["usage", "report", "--root", root]);
    assert.equal(report.schemaVersion, "0.1");
    assert.equal((report.rows as unknown[]).length, 1);

    await writeFile(path.join(root, "stack.json"), "{ invalid JSON\n", "utf8");
    const invalid = runJson(["validate", "--root", root], 2);
    assert.deepEqual(Object.keys(invalid).sort(), ["errors", "manifestPath", "schemaVersion", "valid"]);
    assert.equal(invalid.valid, false);
    assert.match(String((invalid.errors as unknown[])[0]), /^Unable to parse manifest:/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
