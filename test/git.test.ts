import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadStack } from "../src/core/manifest.ts";
import { gitStatus, syncComponent } from "../src/core/git.ts";
import { componentRoot } from "../src/core/paths.ts";
import { writeLockSnapshot } from "../src/core/lock.ts";

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true }).trim();
}

test("clones and fetches without changing dirty working state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-git-"));
  try {
    const remote = path.join(root, "remote.git");
    const seed = path.join(root, "seed");
    git(["init", "--bare", remote]);
    git(["init", "-b", "main", seed]);
    git(["config", "user.email", "stacks@example.invalid"], seed);
    git(["config", "user.name", "Stacks Test"], seed);
    await writeFile(path.join(seed, "README.md"), "first\n");
    git(["add", "README.md"], seed);
    git(["commit", "-m", "initial"], seed);
    git(["remote", "add", "origin", remote], seed);
    git(["push", "-u", "origin", "main"], seed);

    const stackRoot = path.join(root, "stack");
    git(["init", "-b", "main", stackRoot]);
    await writeFile(
      path.join(stackRoot, "stack.json"),
      `${JSON.stringify({
        apiVersion: "stacks.dev/v0alpha1",
        kind: "Stack",
        metadata: { id: "git-test-id", namespace: "tests", name: "git-test" },
        components: [
          { id: "library", source: { type: "git", url: remote, ref: "main" } },
        ],
      }, null, 2)}\n`,
    );

    const stack = await loadStack(stackRoot);
    const component = stack.manifest.components[0]!;
    const cloned = await syncComponent(stack, component);
    assert.equal(cloned.action, "clone");
    assert.equal(cloned.changed, true);

    const checkout = componentRoot(stack, component);
    const before = gitStatus(checkout);
    assert.equal(before.isRepository, true);
    assert.equal(before.dirty, false);
    assert.equal(before.remoteUrl, remote);

    await writeFile(path.join(checkout, "LOCAL.txt"), "do not destroy\n");
    const fetched = await syncComponent(stack, component, { update: true });
    assert.equal(fetched.action, "fetch");
    assert.equal(await readFile(path.join(checkout, "LOCAL.txt"), "utf8"), "do not destroy\n");
    assert.equal(gitStatus(checkout).dirty, true);

    const lockPath = await writeLockSnapshot(stack);
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as { components: Array<{ dirty?: boolean }> };
    assert.equal(lock.components[0]!.dirty, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
