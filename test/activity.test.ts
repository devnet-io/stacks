import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildActivityTurnDetail, buildActivityWorkDetail, buildStackActivity } from "../src/application/activity.ts";
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
    const secondTurn = await startTurn(stack, { sessionId: first.sessionId!, context: { generatedAt: new Date().toISOString(), items: 1, warnings: 0, errors: 0, briefingDigest: "briefing-digest", briefingMode: "refresh", briefingItems: 1, briefingOmissions: 0, briefingBytes: 20, briefingBudgetBytes: 8192 } });
    await completeTurn(stack, { sessionId: first.sessionId!, turnId: secondTurn.turnId!, summary: "Verified the result", status: "complete", changedPaths: ["src/app.ts"], nextStep: "Ship it" });
    await importUsage(stack, { sessionId: first.sessionId!, usage: { provider: "openai", model: "model-a", inputTokens: 80, outputTokens: 20, amount: 0.2, currency: "USD", costKind: "estimated" } });
    await completeWork(stack, { sessionId: first.sessionId!, summary: "Done", outcome: "success" });
    await startWork(stack, { componentId: "app", summary: "Still working" });

    const activity = await buildStackActivity(stack);
    assert.equal(activity.schemaVersion, "0.1");
    assert.equal(activity.summary.events, 10);
    assert.equal(activity.summary.activeWork, 1);
    assert.equal(activity.summary.completedWork, 1);
    assert.equal(activity.summary.turns, 2);
    assert.equal(activity.summary.usage.inputTokens, 200);
    assert.equal(activity.summary.usage.outputTokens, 50);
    assert.deepEqual(activity.summary.usage.costs, [
      { amount: 0.2, currency: "USD", costKind: "estimated" },
      { amount: 0.4, currency: "USD", costKind: "reported" },
    ]);
    const completedWork = activity.work.find((item) => item.status === "success")!;
    assert.equal(completedWork.title, "Start");
    assert.equal(completedWork.resultSummary, "Done");
    assert.equal(completedWork.turnCount, 2);
    assert.equal(activity.recentChanges[0]?.type, "component.added");
    assert.equal(activity.recentChanges[0]?.actor?.client, "stacks-test");
    assert.equal(activity.workLimit, 50);
    assert.equal(activity.recentChangeLimit, 30);

    const workDetail = await buildActivityWorkDetail(stack, first.sessionId!);
    assert.deepEqual(workDetail.turns.map((item) => item.turnId), [secondTurn.turnId, turn.turnId]);
    assert.equal(workDetail.turns[0]?.briefing?.digest, "briefing-digest");
    assert.equal(workDetail.turns[0]?.changedPaths[0], "src/app.ts");
    const turnDetail = await buildActivityTurnDetail(stack, first.sessionId!, secondTurn.turnId!);
    assert.equal(turnDetail.turn.summary, "Verified the result");
    assert.equal(turnDetail.events.length, 2);
    await assert.rejects(buildActivityWorkDetail(stack, "missing"), /Unknown work session/u);
    await assert.rejects(buildActivityTurnDetail(stack, first.sessionId!, "missing"), /Unknown turn/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
