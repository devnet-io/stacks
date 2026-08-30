import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startLocalApi, type LocalApiHandle } from "../http/server.ts";
import { STACKS_VERSION } from "../version.ts";
import { createUiRuntimeToken, registerUiRuntime } from "./runtime.ts";

export const DEFAULT_UI_PORT = 3210;

export interface UiLaunchOptions {
  root?: string;
  webPort?: number;
  openBrowser?: boolean;
}

export interface BrowserOpenCommand { command: string; args: string[] }

async function exists(candidate: string): Promise<boolean> {
  try { await access(candidate); return true; } catch { return false; }
}

export async function findPackageRoot(start = path.dirname(fileURLToPath(import.meta.url))): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, "package.json")) && await exists(path.join(current, "apps", "web", "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error("Unable to locate the bundled Stacks web application. Reinstall Stacks.");
}

export async function existingStacksWeb(port: number): Promise<boolean> {
  try {
    const [markerResponse, healthResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/stacks-web.json`, { signal: AbortSignal.timeout(800) }),
      fetch(`http://127.0.0.1:${port}/api/v0.1/health`, { signal: AbortSignal.timeout(800) }),
    ]);
    if (!markerResponse.ok || !healthResponse.ok) return false;
    const marker = await markerResponse.json() as { schemaVersion?: string; product?: string; role?: string };
    const health = await healthResponse.json() as { schemaVersion?: string; status?: string; version?: string };
    return marker.schemaVersion === "0.1" && marker.product === "stacks" && marker.role === "local-web"
      && health.schemaVersion === "0.1" && health.status === "ok" && health.version === STACKS_VERSION;
  } catch { return false; }
}

export function browserOpenCommand(url: string, platform = process.platform): BrowserOpenCommand | undefined {
  if (platform === "win32") return { command: "explorer.exe", args: [url] };
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "linux") return { command: "xdg-open", args: [url] };
  return undefined;
}

function openUiInBrowser(url: string): void {
  const target = browserOpenCommand(url);
  if (!target) {
    process.stderr.write(`Stacks: automatic browser opening is not supported on ${process.platform}; open ${url}\n`);
    return;
  }
  const opener = spawn(target.command, target.args, { detached: true, stdio: "ignore", windowsHide: true });
  opener.once("error", (error) => process.stderr.write(`Stacks: could not open the browser automatically (${error.message}). Open ${url}\n`));
  opener.unref();
}

function addressInUse(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "EADDRINUSE";
}

async function startUiServer(
  options: UiLaunchOptions,
  staticRoot: string,
  runtimeControl: { token: string; onShutdownRequested(): void },
): Promise<{ api?: LocalApiHandle; port: number; reused: boolean }> {
  const requested = options.webPort ?? DEFAULT_UI_PORT;
  for (let port = requested; port <= Math.min(65535, requested + 100); port += 1) {
    if (await existingStacksWeb(port)) return { port, reused: true };
    try {
      const api = await startLocalApi({
        ...(options.root === undefined ? {} : { root: options.root }),
        port,
        staticRoot,
        hostedMcp: {
          url: process.env.STACKS_HOSTED_MCP_URL,
          bearerTokenEnvVar: process.env.STACKS_HOSTED_MCP_TOKEN_ENV_VAR,
        },
        runtimeControl,
      });
      return { api, port, reused: false };
    } catch (error) {
      if (!addressInUse(error)) throw error;
      if (options.webPort !== undefined) throw new Error(`Port ${port} is already in use. Choose another with --port.`);
    }
  }
  throw new Error(`No available local port found from ${requested} through ${Math.min(65535, requested + 100)}.`);
}

export async function launchLocalUi(options: UiLaunchOptions): Promise<void> {
  const packageRoot = await findPackageRoot();
  const staticRoot = path.join(packageRoot, "apps", "web", "dist");
  if (!await exists(path.join(staticRoot, "index.html"))) throw new Error("The installed Stacks package is missing its web application. Reinstall Stacks.");
  const runtimeToken = createUiRuntimeToken();
  let requestShutdown: () => void = () => {};
  const shutdownRequested = new Promise<void>((resolve) => { requestShutdown = resolve; });
  const server = await startUiServer(options, staticRoot, { token: runtimeToken, onShutdownRequested: requestShutdown });
  const uiUrl = `http://localhost:${server.port}/`;
  if (server.reused) process.stdout.write(`Using the running Stacks UI on port ${server.port}.\n`);
  else if (server.port !== (options.webPort ?? DEFAULT_UI_PORT)) process.stdout.write(`Port ${options.webPort ?? DEFAULT_UI_PORT} is in use; using ${server.port}.\n`);
  process.stdout.write(`Stacks UI: ${uiUrl}\n`);
  if (options.openBrowser !== false) openUiInBrowser(uiUrl);
  if (!server.api) return;
  let unregister: () => Promise<void>;
  try {
    unregister = await registerUiRuntime(server.api.origin, runtimeToken);
  } catch (error) {
    await server.api.close();
    throw error;
  }
  let resolveSignal: () => void = () => {};
  const signalReceived = new Promise<void>((resolve) => { resolveSignal = resolve; });
  process.once("SIGINT", resolveSignal);
  process.once("SIGTERM", resolveSignal);
  try {
    await Promise.race([shutdownRequested, signalReceived]);
    await server.api.close();
  } finally {
    process.off("SIGINT", resolveSignal);
    process.off("SIGTERM", resolveSignal);
    await unregister();
  }
}
