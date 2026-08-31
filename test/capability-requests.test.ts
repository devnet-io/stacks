import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCapabilityRequestDetail, buildCapabilityRequestList, relevantCapabilityRequests } from "../src/application/capability-requests.ts";
import { createCapabilityRequest, readEvents, startWork, transitionCapabilityRequest } from "../src/core/events.ts";
import { loadStack } from "../src/core/manifest.ts";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-requests-"));
  await Promise.all([mkdir(path.join(root, "product")), mkdir(path.join(root, "ui"))]);
  await writeFile(path.join(root, "stack.json"), `${JSON.stringify({
    apiVersion: "stacks.dev/v0alpha1", kind: "Stack",
    metadata: { id: "request-test-id", namespace: "tests", name: "requests" },
    components: [
      { id: "product", source: { type: "path", path: "product" } },
      { id: "ui", source: { type: "path", path: "ui" } },
    ],
  }, null, 2)}\n`);
  return { root, stack: await loadStack(root) };
}

test("records role-checked capability requests as append-only transitions", async () => {
  const { root, stack } = await fixture();
  try {
    const work = await startWork(stack, { componentId: "product", summary: "Build admin dialogs" });
    const created = await createCapabilityRequest(stack, {
      requesterComponentId: "product", providerComponentId: "ui", sessionId: work.sessionId!,
      capability: "ui.dialog", reason: "The product must not introduce a parallel dialog.", acceptance: "Export an accessible dialog and usage guide.",
    });
    assert.ok(created.requestId);
    await assert.rejects(createCapabilityRequest(stack, {
      requesterComponentId: "ui", providerComponentId: "product", sessionId: work.sessionId!, capability: "wrong", reason: "wrong owner",
    }), /belongs to product/u);
    await assert.rejects(transitionCapabilityRequest(stack, {
      requestId: created.requestId!, componentId: "product", status: "provider-complete", summary: "Not the provider",
    }), /cannot transition/u);
    await transitionCapabilityRequest(stack, { requestId: created.requestId!, componentId: "ui", status: "in-progress", summary: "Provider started implementation." });
    await transitionCapabilityRequest(stack, { requestId: created.requestId!, componentId: "ui", status: "provider-complete", summary: "Dialog exported.", evidence: "ui@abc123 docs/dialog.md" });
    await transitionCapabilityRequest(stack, { requestId: created.requestId!, componentId: "product", status: "consumer-verified", summary: "Product integration passed.", evidence: "product@def456" });
    await assert.rejects(transitionCapabilityRequest(stack, { requestId: created.requestId!, componentId: "ui", status: "in-progress", summary: "Too late" }), /cannot transition from consumer-verified/u);

    const list = await buildCapabilityRequestList(stack);
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0]!.status, "consumer-verified");
    assert.equal(list.requests[0]!.latestEvidence, "product@def456");
    const detail = await buildCapabilityRequestDetail(stack, created.requestId!);
    assert.equal(detail.transitions.length, 3);
    assert.equal(detail.transitions[0]!.toStatus, "consumer-verified");
    assert.equal(detail.events.length, 4);
    assert.deepEqual(relevantCapabilityRequests(list.requests, "product"), []);
    const history = await readEvents(stack);
    assert.deepEqual(history.events.slice(1).map((event) => event.type), [
      "capability-request.created", "capability-request.transitioned", "capability-request.transitioned", "capability-request.transitioned",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
