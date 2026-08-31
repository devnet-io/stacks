import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadStack } from "../src/core/manifest.ts";
import { completeTurn, completeWork, eventsLockPath, importUsage, readEvents, startTurn, startWork } from "../src/core/events.ts";
import { access } from "node:fs/promises";
import { buildUsageReport } from "../src/core/usage.ts";

async function makeStack(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-events-"));
  await mkdir(path.join(root, "app"));
  await writeFile(
    path.join(root, "stack.json"),
    `${JSON.stringify({
      apiVersion: "stacks.dev/v0alpha1",
      kind: "Stack",
      metadata: { id: "events-test-id", namespace: "tests", name: "events-test" },
      components: [{ id: "app", source: { type: "path", path: "app" } }],
    }, null, 2)}\n`,
  );
  return root;
}

test("records a complete check-in and usage lifecycle", async () => {
  const root = await makeStack();
  try {
    const stack = await loadStack(root);
    const started = await startWork(stack, {
      componentId: "app",
      summary: "Begin implementation",
      workId: "WU-1",
      actor: { agent: "codex", client: "codex-cli", model: "test-model" },
    });
    assert.ok(started.sessionId);
    assert.equal(started.stackId, "events-test-id");
    const turn = await startTurn(stack, {
      sessionId: started.sessionId!,
      context: { generatedAt: new Date().toISOString(), items: 2, warnings: 0, errors: 0 },
    });
    assert.ok(turn.turnId);
    const completed = await completeTurn(stack, {
      sessionId: started.sessionId!,
      turnId: turn.turnId!,
      summary: "Implemented first slice",
      changedPaths: ["src/a.ts"],
      nextStep: "Run tests",
      usage: {
        provider: "openai",
        model: "test-model",
        inputTokens: 100,
        outputTokens: 50,
        amount: 0.25,
        currency: "USD",
        costKind: "reported",
      },
    });
    assert.equal(completed.usage?.turnId, turn.turnId);
    await completeWork(stack, {
      sessionId: started.sessionId!,
      summary: "Finished implementation",
      outcome: "success",
    });

    const read = await readEvents(stack);
    assert.equal(read.events.length, 5);
    assert.deepEqual(read.events.map((event) => event.type), [
      "work.started",
      "turn.started",
      "turn.completed",
      "usage.recorded",
      "work.completed",
    ]);
    assert.ok(read.events.slice(1, 4).every((event) => event.turnId === turn.turnId));

    const report = await buildUsageReport(stack);
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0]!.inputTokens, 100);
    assert.equal(report.rows[0]!.outputTokens, 50);
    assert.equal(report.rows[0]!.amounts.USD, 0.25);
    assert.equal(report.rows[0]!.costKinds.reported, 1);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("enforces one open turn and imports delayed usage explicitly", async () => {
  const root = await makeStack();
  try {
    const stack = await loadStack(root);
    const session = await startWork(stack, { componentId: "app", summary: "Start" });
    const turn = await startTurn(stack, { sessionId: session.sessionId!, context: { generatedAt: new Date().toISOString(), items: 0, warnings: 0, errors: 0 } });
    await assert.rejects(startTurn(stack, { sessionId: session.sessionId!, context: { generatedAt: new Date().toISOString(), items: 0, warnings: 0, errors: 0 } }), /already has open turn/u);
    await assert.rejects(completeWork(stack, { sessionId: session.sessionId!, summary: "Too soon" }), /is open/u);
    await completeTurn(stack, { sessionId: session.sessionId!, turnId: turn.turnId!, summary: "Done" });
    await assert.rejects(completeTurn(stack, { sessionId: session.sessionId!, turnId: turn.turnId!, summary: "Duplicate" }), /already complete/u);
    const imported = await importUsage(stack, { turnId: turn.turnId!, usage: { provider: "openai", model: "delayed", outputTokens: 7 } });
    assert.equal(imported.sessionId, session.sessionId);
    assert.equal(imported.turnId, turn.turnId);
    assert.equal(imported.data.recording, "imported");
    await assert.rejects(importUsage(stack, { usage: { provider: "openai", model: "invalid", inputTokens: -1 } }), /non-negative/u);
    await assert.rejects(importUsage(stack, { usage: { provider: "openai", model: "invalid", amount: 1 } }), /costKind is required/u);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("serializes concurrent event writers without losing or corrupting records", async () => {
  const root = await makeStack();
  try {
    const stack = await loadStack(root);
    await Promise.all(Array.from({ length: 40 }, (_, index) => startWork(stack, {
      componentId: "app",
      summary: `Concurrent session ${index}`,
    })));
    const read = await readEvents(stack);
    assert.equal(read.events.length, 40);
    assert.equal(new Set(read.events.map((event) => event.id)).size, 40);
    assert.deepEqual(read.warnings, []);
    await assert.rejects(access(eventsLockPath(stack)), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
