import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { verifyMvpWorkflow } from "./verify-mvp-workflow.mjs";

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

async function verifyMcp(packageRoot) {
  const cliPath = path.join(packageRoot, "dist", "cli.js");
  const catalog = await import(pathToFileURL(path.join(packageRoot, "dist", "mcp", "catalog.js")).href);
  const child = spawn(process.execPath, [cliPath, "mcp"], { cwd: packageRoot, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const response = async (id) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const messages = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
      const match = messages.find((message) => message.id === id);
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Packaged MCP timed out for response ${id}. stdout=${stdout} stderr=${stderr}`);
  };
  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stacks-package-verification", version: "1" } } });
    const initialized = await response(1);
    assert.equal(initialized.result.serverInfo.name, "stacks");
    send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = (await response(2)).result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(tools, [...catalog.STACKS_MCP_TOOL_NAMES].sort());
    send({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} });
    const resources = (await response(3)).result.resources.map((resource) => resource.uri).sort();
    assert.deepEqual(resources, catalog.STACKS_MCP_RESOURCES.map((resource) => resource.uri).sort());
    assert.match(stderr, /^Stacks MCP server is listening/u);
  } finally {
    child.stdin.end();
    child.kill();
  }
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
  const version = await run(process.execPath, [path.join(packageRoot, "dist", "cli.js"), "--version"]);
  assert.equal(version.stdout.trim(), JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version);
  await verifyMcp(packageRoot);
  await verifyMvpWorkflow({ packageRoot, root: path.join(temporary, "mvp-workflow"), run });

  const port = await availablePort();
  web = spawn(process.execPath, [path.join(packageRoot, "dist", "cli.js"), "ui", "--port", String(port), "--no-open"], {
    cwd: packageRoot,
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      STACKS_CONFIG_HOME: path.join(temporary, "runtime-config"),
      STACKS_STATE_HOME: path.join(temporary, "runtime-state"),
    },
  });
  await waitForMarker(port);
  const health = await (await fetch(`http://127.0.0.1:${port}/api/v0.1/health`)).json();
  assert.equal(health.status, "ok");
  process.stdout.write("Verified temporary installation: CLI, MCP contract, three-component agent workflow, and web runtime.\n");
} finally {
  if (web && web.exitCode === null) {
    const exited = new Promise((resolve) => web.once("exit", resolve));
    web.kill();
    await exited;
  }
  await rm(temporary, { recursive: true, force: true });
}
