import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

function npmInvocation(args) {
  const npmCli = process.env.npm_execpath;
  return npmCli
    ? { command: process.execPath, args: [npmCli, ...args] }
    : { command: process.platform === "win32" ? "npm.cmd" : "npm", args };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `${command} exited with ${code}.`)));
  });
}

async function npm(args, options = {}) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, { cwd: process.cwd(), ...options });
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to allocate a package verification port.");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForMarker(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/stacks-web.json`);
      if (response.ok && (await response.json()).product === "stacks") return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The packaged web runtime did not become ready.");
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "stacks-package-verification-"));
let web;
try {
  const packages = path.join(temporary, "packages");
  const installation = path.join(temporary, "installation");
  await mkdir(packages, { recursive: true });
  const packed = await npm(["pack", "--json", "--pack-destination", packages]);
  const filename = JSON.parse(packed.stdout)[0]?.filename;
  assert.ok(filename, "npm pack must return a filename");
  await npm(["install", "--prefix", installation, "--ignore-scripts", "--prefer-offline", path.join(packages, filename)]);

  const packageRoot = path.join(installation, "node_modules", "@stacks-dev", "stacks");
  assert.equal((await lstat(packageRoot)).isSymbolicLink(), false, "the installed package must be a copy, not a link");
  await access(path.join(packageRoot, "dist", "cli.js"));
  await access(path.join(packageRoot, "apps", "web", "dist", "index.html"));
  await access(path.join(packageRoot, "apps", "web", "dist", "stacks-web.json"));
  await access(path.join(packageRoot, "docs", "cli-reference.md"));
  await access(path.join(packageRoot, "docs", "mcp-reference.md"));
  await access(path.join(packageRoot, "docs", "http-reference.md"));

  const cli = await run(process.execPath, [path.join(packageRoot, "dist", "cli.js"), "help"]);
  assert.match(cli.stdout, /^Stacks - portable/u);

  const port = await availablePort();
  web = spawn(process.execPath, [path.join(packageRoot, "dist", "cli.js"), "ui", "--port", String(port), "--no-open"], {
    cwd: packageRoot, windowsHide: true, stdio: "ignore",
  });
  await waitForMarker(port);
  const health = await (await fetch(`http://127.0.0.1:${port}/api/v0.1/health`)).json();
  assert.equal(health.status, "ok");
  process.stdout.write("Verified copied CLI and packaged web runtime.\n");
} finally {
  if (web && web.exitCode === null) {
    const exited = new Promise((resolve) => web.once("exit", resolve));
    web.kill();
    await exited;
  }
  await rm(temporary, { recursive: true, force: true });
}
