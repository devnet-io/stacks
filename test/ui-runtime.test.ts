import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startLocalApi, type LocalApiHandle } from "../src/http/server.ts";
import { createUiRuntimeToken, registerUiRuntime, stopRunningUiProcesses } from "../src/ui/runtime.ts";

test("registered UI runtimes require their token and stop gracefully", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-ui-runtime-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const token = createUiRuntimeToken();
  let api: LocalApiHandle | undefined;
  let unregister: (() => Promise<void>) | undefined;
  let resolveStopped: () => void = () => {};
  const stopped = new Promise<void>((resolve) => { resolveStopped = resolve; });
  try {
    api = await startLocalApi({
      port: 0,
      catalogDirectories: directories,
      runtimeControl: {
        token,
        onShutdownRequested: () => {
          setImmediate(() => void (async () => {
            await api?.close();
            await unregister?.();
            resolveStopped();
          })());
        },
      },
    });
    unregister = await registerUiRuntime(api.origin, token, directories);
    const rejected = await fetch(`${api.origin}/api/v0.1/runtime/shutdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Stacks-Runtime-Token": "wrong-token" },
      body: "{}",
    });
    assert.equal(rejected.status, 403);

    const result = await stopRunningUiProcesses(directories);
    await stopped;
    assert.deepEqual(result, { stopped: 1, stale: 0, warnings: [] });
    api = undefined;
    unregister = undefined;
  } finally {
    await api?.close().catch(() => undefined);
    await unregister?.().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("runtime registration can replace a stale record for a reused process ID", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-ui-stale-runtime-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const token = createUiRuntimeToken();
  try {
    await registerUiRuntime("http://127.0.0.1:3210", createUiRuntimeToken(), directories);
    const secondCleanup = await registerUiRuntime("http://127.0.0.1:3211", token, directories);
    const record = JSON.parse(await readFile(path.join(directories.state, "runtime", "ui", `${process.pid}.json`), "utf8")) as { origin: string; token: string };
    assert.equal(record.origin, "http://127.0.0.1:3211");
    assert.equal(record.token, token);
    await secondCleanup();
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
