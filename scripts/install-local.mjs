import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { stopRunningUiProcesses } from "../dist/ui/runtime.js";

function npmInvocation(args) {
  const npmCli = process.env.npm_execpath;
  return npmCli
    ? { command: process.execPath, args: [npmCli, ...args] }
    : { command: process.platform === "win32" ? "npm.cmd" : "npm", args };
}

function run(args, options = {}) {
  const invocation = npmInvocation(args);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, { cwd: process.cwd(), windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `npm exited with ${code}.`)));
  });
}

const running = await stopRunningUiProcesses();
if (running.stopped) process.stdout.write(`Stopped ${running.stopped} running Stacks UI process${running.stopped === 1 ? "" : "es"} before installation.\n`);
if (running.stale) process.stdout.write(`Removed ${running.stale} stale Stacks UI runtime record${running.stale === 1 ? "" : "s"}.\n`);
for (const warning of running.warnings) process.stderr.write(`Warning: ${warning}\n`);

const temporary = await mkdtemp(path.join(os.tmpdir(), "stacks-install-"));
try {
  const packed = await run(["pack", "--json", "--pack-destination", temporary], { stdio: ["ignore", "pipe", "pipe"] });
  const result = JSON.parse(packed.stdout);
  const filename = result[0]?.filename;
  if (!filename) throw new Error("npm pack did not return a package filename.");
  const archive = path.join(temporary, filename);
  process.stdout.write("Installing a self-contained Stacks snapshot for this computer...\n");
  const installed = await run(["install", "--global", "--force", archive], { stdio: ["inherit", "pipe", "pipe"] });
  if (installed.stdout) process.stdout.write(installed.stdout);
  if (installed.stderr) process.stderr.write(installed.stderr);
  process.stdout.write("Stacks is installed independently of this source checkout.\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
