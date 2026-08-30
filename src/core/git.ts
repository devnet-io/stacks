import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { GitStatus, LoadedStack, StackComponent, SyncResult } from "./types.ts";
import { componentRoot } from "./paths.ts";

interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function runGit(args: string[], cwd?: string): GitResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
  };
}

export function gitStatus(root: string): GitStatus {
  if (!existsSync(root)) return { isRepository: false, error: "Path does not exist." };
  const inside = runGit(["-C", root, "rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.stdout !== "true") return { isRepository: false, error: inside.stderr || "Not a Git repository." };

  const branch = runGit(["-C", root, "branch", "--show-current"]);
  const commit = runGit(["-C", root, "rev-parse", "HEAD"]);
  const dirty = runGit(["-C", root, "status", "--porcelain=v1"]);
  const remote = runGit(["-C", root, "remote", "get-url", "origin"]);

  return {
    isRepository: true,
    ...(branch.ok && branch.stdout ? { branch: branch.stdout } : {}),
    ...(commit.ok && commit.stdout ? { commit: commit.stdout } : {}),
    ...(dirty.ok ? { dirty: dirty.stdout.length > 0 } : {}),
    ...(remote.ok && remote.stdout ? { remoteUrl: remote.stdout } : {}),
    ...(!commit.ok ? { error: commit.stderr || "Unable to read Git commit." } : {}),
  };
}

export async function syncComponent(
  stack: LoadedStack,
  component: StackComponent,
  options: { dryRun?: boolean; update?: boolean } = {},
): Promise<SyncResult> {
  const root = componentRoot(stack, component);
  if (component.source.type === "path") {
    return {
      componentId: component.id,
      action: "inspect",
      root,
      changed: false,
      message: existsSync(root) ? "Path component is present." : "Path component is missing.",
    };
  }

  if (!existsSync(root)) {
    if (options.dryRun) {
      return {
        componentId: component.id,
        action: "clone",
        root,
        changed: false,
        message: `Would clone ${component.source.url}${component.source.ref ? ` at ${component.source.ref}` : ""}.`,
      };
    }
    await mkdir(path.dirname(root), { recursive: true });
    const args = ["clone"];
    if (component.source.ref) args.push("--branch", component.source.ref, "--single-branch");
    args.push("--", component.source.url, root);
    const cloned = runGit(args);
    if (!cloned.ok) {
      return {
        componentId: component.id,
        action: "error",
        root,
        changed: false,
        message: cloned.stderr || "Git clone failed.",
      };
    }
    return {
      componentId: component.id,
      action: "clone",
      root,
      changed: true,
      message: "Cloned component repository.",
    };
  }

  const status = gitStatus(root);
  if (!status.isRepository) {
    return {
      componentId: component.id,
      action: "error",
      root,
      changed: false,
      message: `Destination exists but is not a Git repository: ${status.error ?? root}`,
    };
  }
  if (status.remoteUrl && status.remoteUrl !== component.source.url) {
    return {
      componentId: component.id,
      action: "error",
      root,
      changed: false,
      message: `Origin mismatch. Manifest: ${component.source.url}; checkout: ${status.remoteUrl}.`,
    };
  }
  if (!options.update) {
    return {
      componentId: component.id,
      action: "skip",
      root,
      changed: false,
      message: status.dirty ? "Repository is present and dirty; left untouched." : "Repository is present; use --update to fetch.",
    };
  }
  if (options.dryRun) {
    return {
      componentId: component.id,
      action: "fetch",
      root,
      changed: false,
      message: "Would fetch origin with pruning. No merge, rebase, reset, or clean is performed.",
    };
  }
  const fetched = runGit(["-C", root, "fetch", "--prune", "origin"]);
  return {
    componentId: component.id,
    action: fetched.ok ? "fetch" : "error",
    root,
    changed: fetched.ok,
    message: fetched.ok ? "Fetched origin. Working tree and branch were not changed." : fetched.stderr || "Git fetch failed.",
  };
}
