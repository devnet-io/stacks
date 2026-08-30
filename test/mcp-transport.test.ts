import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { STACKS_MCP_RESOURCES, STACKS_MCP_TOOL_NAMES } from "../src/mcp/catalog.ts";

test("stdio MCP exposes instructions and documented tools/resources without stdout diagnostics", async () => {
  const child = spawn(process.execPath, ["--experimental-strip-types", path.resolve("src/cli.ts"), "mcp"], {
    cwd: path.resolve("."), stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  const send = (message: Record<string, unknown>) => child.stdin.write(`${JSON.stringify(message)}\n`);
  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stacks-test", version: "1" } } });
    const initialized = await response(1);
    const initialization = initialized.result as { serverInfo: { name: string }; instructions?: string };
    assert.equal(initialization.serverInfo.name, "stacks");
    assert.match(initialization.instructions ?? "", /stack_list/u);
    assert.match(initialization.instructions ?? "", /stacks:\/\/reference\/mcp/u);
    send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const listed = await response(2);
    const tools = (listed.result as { tools: Array<{ name: string }> }).tools;
    const toolNames = tools.map((tool) => tool.name).sort();
    assert.deepEqual(toolNames, [...STACKS_MCP_TOOL_NAMES].sort());
    const reference = await readFile(path.resolve("docs/mcp-reference.md"), "utf8");
    for (const name of toolNames) assert.match(reference, new RegExp("### `" + name + "`", "u"));

    send({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} });
    const listedResources = await response(3);
    const resources = (listedResources.result as { resources: Array<{ uri: string }> }).resources;
    assert.deepEqual(resources.map((resource) => resource.uri).sort(), STACKS_MCP_RESOURCES.map((resource) => resource.uri).sort());

    send({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "stacks://reference/mcp" } });
    const readReference = await response(4);
    const contents = (readReference.result as { contents: Array<{ text: string }> }).contents;
    assert.match(contents[0]?.text ?? "", /### `usage_record`/u);

    send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "instructions_get", arguments: {} } });
    const instructions = await response(5);
    const structured = (instructions.result as { structuredContent: { resources: Array<{ uri: string }> } }).structuredContent;
    assert.ok(structured.resources.some((resource) => resource.uri === "stacks://reference/cli"));
    assert.match(stderr, /^Stacks MCP server is listening for the machine catalog/u);
    assert.ok(stdout.split("\n").filter(Boolean).every((line) => (JSON.parse(line) as { jsonrpc?: string }).jsonrpc === "2.0"));
  } finally {
    child.stdin.end();
    child.kill();
  }

  async function response(id: number): Promise<Record<string, unknown>> {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const messages = stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
      const match = messages.find((message) => message.id === id);
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for MCP response ${id}. stdout=${stdout} stderr=${stderr}`);
  }
});
