import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { STACKS_VERSION } from "../src/version.ts";

const cliPath = path.resolve("src/cli.ts");

function runJson(args: string[], expectedStatus = 0, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const execution = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args, "--json"], {
    cwd: path.resolve("."),
    encoding: "utf8",
    windowsHide: true,
    env,
  });
  assert.equal(execution.status, expectedStatus, execution.stderr || execution.stdout);
  assert.equal(execution.stderr, "");
  return JSON.parse(execution.stdout) as Record<string, unknown>;
}

test("global catalog CLI creates, binds, and inspects a Stack from any directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-global-cli-"));
  const component = path.join(root, "ordinary-project-location", "app");
  const env = { ...process.env, STACKS_CONFIG_HOME: path.join(root, "config", "stacks"), STACKS_STATE_HOME: path.join(root, "state", "stacks") };
  try {
    await mkdir(component, { recursive: true });
    const created = runJson(["stack", "create", "tests/global-cli"], 0, env);
    const identity = object(created.stack);
    assert.equal(identity.namespace, "tests");
    assert.equal(identity.name, "global-cli");

    const added = runJson(["component", "add", "tests/global-cli", "app", "--path", component, "--kind", "product"], 0, env);
    assert.equal(added.stack, "tests/global-cli");
    assert.equal(added.path, path.resolve(component));

    const components = runJson(["component", "list", "tests/global-cli"], 0, env);
    assert.equal(object(object((components.components as unknown[])[0]).component).id, "app");
    const inspected = runJson(["component", "get", "tests/global-cli", "app"], 0, env);
    assert.equal(object(inspected.component).kind, "product");
    const located = runJson(["locate", component], 0, env);
    assert.equal(object((located.memberships as unknown[])[0]).relativePath, ".");

    const listed = runJson(["stack", "list"], 0, env);
    assert.equal((listed.stacks as unknown[]).length, 1);
    const validated = runJson(["validate", "--stack", "tests/global-cli"], 0, env);
    assert.equal(validated.valid, true);
    const status = runJson(["status", "--stack", "tests/global-cli"], 0, env);
    assert.equal(object((status.components as unknown[])[0]).root, path.resolve(component));

    const globalStatus = runJson(["status"], 0, env);
    assert.equal(globalStatus.schemaVersion, "0.1");
    assert.equal((globalStatus.stacks as unknown[]).length, 1);
    assert.equal(object(object((globalStatus.stacks as unknown[])[0]).stack).name, "global-cli");

    const missingSelector = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "sync", "--dry-run"], {
      cwd: root, encoding: "utf8", windowsHide: true, env,
    });
    assert.equal(missingSelector.status, 1);
    assert.match(missingSelector.stderr, /Select a registered Stack with --stack/u);
    assert.doesNotMatch(missingSelector.stderr, /No Stack manifest found/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

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

    const doctor = runJson(["doctor", "--root", root]);
    assert.equal(doctor.schemaVersion, "0.1");
    assert.deepEqual(object(doctor.stack).id, identity.id);
    assert.equal(object(object(doctor.mcp).local).transport, "stdio");
    assert.ok((doctor.checks as Array<{ status: string }>).every((check) => check.status === "pass"));

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

test("CLI runs when its entrypoint is reached through an npm-style link", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-cli-link-"));
  const linkedPackage = path.join(root, "linked-package");
  const linked = path.join(linkedPackage, "src", "cli.ts");
  try {
    await symlink(path.resolve("."), linkedPackage, process.platform === "win32" ? "junction" : "dir");
    const execution = spawnSync(process.execPath, ["--experimental-strip-types", linked, "help"], { encoding: "utf8", windowsHide: true });
    assert.equal(execution.status, 0, execution.stderr);
    assert.match(execution.stdout, /^Stacks - portable/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("CLI help keeps routine commands concise and explains advanced commands", () => {
  const common = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "help"], { encoding: "utf8", windowsHide: true });
  assert.equal(common.status, 0, common.stderr);
  assert.match(common.stdout, /Common commands/u);
  assert.doesNotMatch(common.stdout, /stacks doctor/u);

  const all = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "help", "commands"], { encoding: "utf8", windowsHide: true });
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /doctor\s+Troubleshoot runtime/u);
  assert.doesNotMatch(all.stdout, /register|export/u);

  const status = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "help", "status"], { encoding: "utf8", windowsHide: true });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /Loading a Stack also validates its definition/u);
});

test("CLI reports the root package version", () => {
  const execution = spawnSync(process.execPath, ["--experimental-strip-types", cliPath, "--version"], { encoding: "utf8", windowsHide: true });
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.stdout.trim(), STACKS_VERSION);
});
