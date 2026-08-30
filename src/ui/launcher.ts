import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startLocalApi } from "../http/server.ts";

export interface UiLaunchOptions {
  root: string;
  webPort?: number;
  apiPort?: number;
  apiOnly?: boolean;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function findPackageRoot(start = path.dirname(fileURLToPath(import.meta.url))): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, "apps", "web", "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Unable to locate the bundled Stacks web workspace.");
}

async function spawnWeb(packageRoot: string, webPort: number, apiOrigin: string): Promise<ChildProcess> {
  const siblingNpm = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const npmExecPath = process.env.npm_execpath ?? (await exists(siblingNpm) ? siblingNpm : undefined);
  const args = ["run", "dev", "-w", "@stacks-dev/web", "--", "--port", String(webPort)];
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], {
      cwd: packageRoot,
      env: { ...process.env, VITE_STACKS_API_ORIGIN: apiOrigin },
      stdio: "inherit",
      windowsHide: true,
    });
  }
  if (process.platform === "win32") throw new Error("Unable to locate npm-cli.js beside the active Node.js runtime.");
  return spawn("npm", args, {
      cwd: packageRoot,
      env: { ...process.env, VITE_STACKS_API_ORIGIN: apiOrigin },
      stdio: "inherit",
      windowsHide: true,
  });
}

async function existingStacksWeb(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.text()).includes("Stacks");
  } catch {
    return false;
  }
}

export async function launchLocalUi(options: UiLaunchOptions): Promise<void> {
  const webPort = options.webPort ?? 3000;
  const api = await startLocalApi({ root: options.root, port: options.apiPort ?? 3210 });
  const uiUrl = `http://localhost:${webPort}/?api=${encodeURIComponent(api.origin)}`;
  process.stdout.write(`Stacks API: ${api.origin}\n`);

  let child: ChildProcess | undefined;
  if (!options.apiOnly) {
    if (await existingStacksWeb(webPort)) {
      process.stdout.write(`Using the existing Stacks web development server on port ${webPort}.\n`);
    } else {
      child = await spawnWeb(await findPackageRoot(), webPort, api.origin);
    }
    process.stdout.write(`Stacks UI:  ${uiUrl}\n`);
  } else {
    process.stdout.write("Stacks UI client was not started (--api-only).\n");
  }

  await new Promise<void>((resolve, reject) => {
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      if (child && !child.killed) child.kill();
      void api.close().then(resolve, reject);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    if (child) {
      child.once("error", (error) => {
        void api.close().finally(() => reject(error));
      });
      child.once("exit", (code, signal) => {
        if (stopping) return;
        void api.close().then(() => {
          if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
          else reject(new Error(`Web UI process exited with code ${code ?? "unknown"}.`));
        }, reject);
      });
    }
  });
}
