import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStackActivity } from "../src/application/activity.ts";
import { completeTurn, completeWork, importUsage, recordComponentAdded, startTurn, startWork } from "../src/core/events.ts";
import { loadStack } from "../src/core/manifest.ts";

test("builds a bounded activity view with session and cost provenance", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-activity-"));
  try {
    await mkdir(path.join(root, "app"));
    await writeFile(path.join(root, "stack.json"), `${JSON.stringify({
      apiVersion: "stacks.dev/v0alpha1",
      kind: "Stack",
      metadata: { id: "activity-id", namespace: "tests", name: "activity" },
      components: [{ id: "app", source: { type: "path", path: "app" } }],
    })}\n`);
    const stack = await loadStack(root);
    await recordComponentAdded(stack, { componentId: "app", path: path.join(root, "app"), kind: "product", sourceType: "local", actor: { client: "stacks-test" } });
    const first = await startWork(stack, { componentId: "app", summary: "Start", actor: { agent: "codex", model: "model-a" } });
    const turn = await startTurn(stack, { sessionId: first.sessionId!, context: { generatedAt: new Date().toISOString(), items: 1, warnings: 0, errors: 0 } });
    await completeTurn(stack, { sessionId: first.sessionId!, turnId: turn.turnId!, summary: "Made progress", usage: { provider: "openai", model: "model-a", inputTokens: 120, outputTokens: 30, amount: 0.4, currency: "USD", costKind: "reported" } });
    await importUsage(stack, { sessionId: first.sessionId!, usage: { provider: "openai", model: "model-a", inputTokens: 80, outputTokens: 20, amount: 0.2, currency: "USD", costKind: "estimated" } });
    await completeWork(stack, { sessionId: first.sessionId!, summary: "Done", outcome: "success" });
    await startWork(stack, { componentId: "app", summary: "Still working" });

    const activity = await buildStackActivity(stack);
    assert.equal(activity.schemaVersion, "0.1");
    assert.equal(activity.summary.events, 8);
    assert.equal(activity.summary.activeSessions, 1);
    assert.equal(activity.summary.completedSessions, 1);
    assert.equal(activity.summary.inputTokens, 200);
    assert.equal(activity.summary.outputTokens, 50);
    assert.deepEqual(activity.summary.costs, [
      { amount: 0.2, currency: "USD", costKind: "estimated" },
      { amount: 0.4, currency: "USD", costKind: "reported" },
    ]);
    assert.equal(activity.sessions.find((session) => session.status === "success")?.turns, 1);
    assert.equal(activity.recentEvents[0]?.type, "work.started");
    assert.equal(activity.recentEvents.find((event) => event.type === "turn.started")?.turnId, turn.turnId);
    assert.equal(activity.recentEvents.find((event) => event.type === "component.added")?.actor?.client, "stacks-test");
    assert.equal(activity.sessionLimit, 100);
    assert.equal(activity.recentEventLimit, 100);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
