import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadStack } from "../src/core/manifest.ts";
import { completeTurn, completeWork, readEvents, recordUsage, startWork } from "../src/core/events.ts";
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
    await completeTurn(stack, {
      sessionId: started.sessionId!,
      summary: "Implemented first slice",
      changedPaths: ["src/a.ts"],
      nextStep: "Run tests",
    });
    await recordUsage(stack, {
      sessionId: started.sessionId!,
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
    await completeWork(stack, {
      sessionId: started.sessionId!,
      summary: "Finished implementation",
      outcome: "success",
    });

    const read = await readEvents(stack);
    assert.equal(read.events.length, 4);
    assert.deepEqual(read.events.map((event) => event.type), [
      "work.started",
      "turn.completed",
      "usage.recorded",
      "work.completed",
    ]);

    const report = await buildUsageReport(stack);
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0]!.inputTokens, 100);
    assert.equal(report.rows[0]!.outputTokens, 50);
    assert.equal(report.rows[0]!.amounts.USD, 0.25);
    assert.equal(report.rows[0]!.costKinds.reported, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
