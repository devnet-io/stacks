import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { platformDirectories, type PlatformDirectories } from "../core/catalog.ts";
import { STACKS_VERSION } from "../version.ts";

interface UiRuntimeRecord {
  schemaVersion: "0.1";
  pid: number;
  origin: string;
  version: string;
  token: string;
  startedAt: string;
}

export interface StopRunningUiResult {
  stopped: number;
  stale: number;
  warnings: string[];
}

function runtimeDirectory(directories: PlatformDirectories): string {
  return path.join(directories.state, "runtime", "ui");
}

function runtimePath(directories: PlatformDirectories, pid: number): string {
  return path.join(runtimeDirectory(directories), `${pid}.json`);
}

function validLoopbackOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

function validRecord(value: unknown): value is UiRuntimeRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<UiRuntimeRecord>;
  return record.schemaVersion === "0.1" && Number.isInteger(record.pid) && (record.pid ?? 0) > 0
    && typeof record.origin === "string" && validLoopbackOrigin(record.origin)
    && typeof record.version === "string" && typeof record.token === "string" && record.token.length >= 32
    && typeof record.startedAt === "string";
}

function processIsRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

async function waitForStop(record: UiRuntimeRecord, file: string): Promise<boolean> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!processIsRunning(record.pid)) return true;
    try { await readFile(file, "utf8"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

export function createUiRuntimeToken(): string {
  return randomBytes(32).toString("hex");
}

export async function registerUiRuntime(
  origin: string,
  token: string,
  directories = platformDirectories(),
): Promise<() => Promise<void>> {
  if (!validLoopbackOrigin(origin)) throw new Error(`Refusing to register a non-loopback Stacks UI origin: ${origin}`);
  const file = runtimePath(directories, process.pid);
  const record: UiRuntimeRecord = {
    schemaVersion: "0.1",
    pid: process.pid,
    origin,
    version: STACKS_VERSION,
    token,
    startedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return async () => {
    await unlink(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  };
}

export async function stopRunningUiProcesses(
  directories = platformDirectories(),
): Promise<StopRunningUiResult> {
  const directory = runtimeDirectory(directories);
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { stopped: 0, stale: 0, warnings: [] };
    throw error;
  }
  const result: StopRunningUiResult = { stopped: 0, stale: 0, warnings: [] };
  for (const name of names.filter((candidate) => candidate.endsWith(".json"))) {
    const file = path.join(directory, name);
    let record: UiRuntimeRecord;
    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
      if (!validRecord(parsed)) throw new Error("invalid runtime record");
      record = parsed;
    } catch (error) {
      result.warnings.push(`Ignored ${file}: ${error instanceof Error ? error.message : String(error)}.`);
      continue;
    }
    if (!processIsRunning(record.pid)) {
      await unlink(file).catch(() => undefined);
      result.stale += 1;
      continue;
    }
    try {
      const response = await fetch(`${record.origin}/api/v0.1/runtime/shutdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Stacks-Runtime-Token": record.token },
        body: "{}",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status !== 202) throw new Error(`runtime returned HTTP ${response.status}`);
      if (!await waitForStop(record, file)) throw new Error("runtime did not stop within five seconds");
      result.stopped += 1;
    } catch (error) {
      result.warnings.push(`Could not stop Stacks UI ${record.pid} at ${record.origin}: ${error instanceof Error ? error.message : String(error)}.`);
    }
  }
  return result;
}
