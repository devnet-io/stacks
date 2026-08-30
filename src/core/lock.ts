import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoadedStack } from "./types.ts";
import { getComponentStatuses } from "./status.ts";

export async function createLockSnapshot(stack: LoadedStack) {
  const manifestBytes = await readFile(stack.manifestPath);
  const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
  const statuses = getComponentStatuses(stack);
  return {
    schemaVersion: "0.1",
    stackId: stack.manifest.metadata.id,
    generatedAt: new Date().toISOString(),
    manifestSha256,
    components: statuses.map((status) => ({
      id: status.id,
      sourceType: status.sourceType,
      root: path.relative(stack.root, status.root) || ".",
      exists: status.exists,
      ...(status.git?.branch === undefined ? {} : { branch: status.git.branch }),
      ...(status.git?.commit === undefined ? {} : { commit: status.git.commit }),
      ...(status.git?.dirty === undefined ? {} : { dirty: status.git.dirty }),
      ...(status.git?.remoteUrl === undefined ? {} : { remoteUrl: status.git.remoteUrl }),
      issues: status.issues,
    })),
  };
}

export async function writeLockSnapshot(stack: LoadedStack): Promise<string> {
  const lockPath = path.join(stack.root, "stack.lock.json");
  const snapshot = await createLockSnapshot(stack);
  await writeFile(lockPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return lockPath;
}
