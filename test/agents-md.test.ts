import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { manageAgentsMd, STACKS_AGENTS_END, STACKS_AGENTS_START } from "../src/agent/agents-md.ts";

test("AGENTS.md activation preserves user instructions and is idempotent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-agents-md-"));
  const target = path.join(root, "AGENTS.md");
  const userInstructions = "# Repository instructions\r\n\r\nKeep this text.\r\n";
  try {
    await writeFile(target, userInstructions, "utf8");
    assert.equal((await manageAgentsMd(root, "check")).status, "absent");
    const installed = await manageAgentsMd(root, "install");
    assert.equal(installed.changed, true);
    const content = await readFile(target, "utf8");
    assert.ok(content.startsWith(userInstructions));
    assert.match(content, /Use the Stacks MCP `stack_memberships` tool/u);
    assert.match(content, /call `turn_start`/u);
    assert.equal((await manageAgentsMd(root, "check")).status, "current");
    assert.equal((await manageAgentsMd(root, "install")).changed, false);
    assert.equal(await readFile(target, "utf8"), content);

    await writeFile(target, content.replace("Before material work", "Before old work"), "utf8");
    assert.equal((await manageAgentsMd(root, "check")).status, "stale");
    assert.equal((await manageAgentsMd(root, "install")).status, "current");
    assert.match(await readFile(target, "utf8"), /Keep this text/u);

    const removed = await manageAgentsMd(root, "remove");
    assert.equal(removed.changed, true);
    assert.equal(removed.status, "absent");
    const remaining = await readFile(target, "utf8");
    assert.ok(remaining.startsWith(userInstructions));
    assert.match(remaining, /Keep this text/u);
    assert.doesNotMatch(remaining, /stacks:agent-instructions/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AGENTS.md activation refuses malformed managed markers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-agents-malformed-"));
  try {
    await writeFile(path.join(root, "AGENTS.md"), `${STACKS_AGENTS_START}\nmissing end\n`, "utf8");
    await assert.rejects(() => manageAgentsMd(root, "install"), /malformed or repeated/u);
    await writeFile(path.join(root, "AGENTS.md"), `${STACKS_AGENTS_END}\n`, "utf8");
    await assert.rejects(() => manageAgentsMd(root, "remove"), /malformed or repeated/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AGENTS.md activation can be printed without writing", async () => {
  const root = path.join(os.tmpdir(), `stacks-agents-print-${Date.now()}`);
  const output = await manageAgentsMd(root, "print");
  assert.equal(output.changed, false);
  assert.equal(output.status, "current");
  assert.match(output.content ?? "", /stacks locate \. --json/u);
});
