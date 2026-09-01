import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { STACKS_MCP_RESOURCES, STACKS_MCP_TOOL_NAMES } from "../src/mcp/catalog.ts";
import { addRegisteredComponent, createRegisteredStack } from "../src/core/catalog.ts";

test("stdio MCP exposes instructions and documented tools/resources without stdout diagnostics", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-mcp-authoring-"));
  const directories = { config: path.join(root, "config"), state: path.join(root, "state") };
  const knowledge = path.join(root, "knowledge");
  const product = path.join(root, "product");
  await mkdir(knowledge, { recursive: true });
  await mkdir(product, { recursive: true });
  await writeFile(path.join(knowledge, "engineering.md"), "# Engineering\n", "utf8");
  await createRegisteredStack("tests/mcp-authoring", directories);
  await addRegisteredComponent("tests/mcp-authoring", { id: "knowledge", path: knowledge }, directories);
  await addRegisteredComponent("tests/mcp-authoring", { id: "product", path: product }, directories);
  const child = spawn(process.execPath, ["--experimental-strip-types", path.resolve("src/cli.ts"), "mcp"], {
    cwd: path.resolve("."), stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, STACKS_CONFIG_HOME: directories.config, STACKS_STATE_HOME: directories.state },
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
    assert.match(contents[0]?.text ?? "", /### `usage_import`/u);

    send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "instructions_get", arguments: {} } });
    const instructions = await response(5);
    const structured = (instructions.result as { structuredContent: { resources: Array<{ uri: string }> } }).structuredContent;
    assert.ok(structured.resources.some((resource) => resource.uri === "stacks://reference/cli"));

    send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "capability_provide", arguments: { stack: "tests/mcp-authoring", componentId: "knowledge", capability: "practice.engineering", contextPath: "engineering.md", strength: "required", artifactEcosystem: "npm", artifactName: "@tests/engineering", artifactPath: "." } } });
    assert.equal((await response(6)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "capability_consume", arguments: { stack: "tests/mcp-authoring", componentId: "product", capability: "practice.engineering", from: "knowledge" } } });
    assert.equal((await response(7)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "guidance_configure", arguments: { stack: "tests/mcp-authoring", componentId: "product", path: "AGENTS.md", strength: "preferred" } } });
    assert.equal((await response(8)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "context_resolve", arguments: { stack: "tests/mcp-authoring", target: "product" } } });
    const resolved = (await response(9)).result as { structuredContent: { items: Array<{ componentId: string; path: string }>; artifactGuidance: Array<{ artifact: { name: string }; localFallback: { dependencySpecifier: string } }>; briefing: { items: Array<{ content: string }>; omissions: Array<{ reason: string }> } } };
    assert.deepEqual(resolved.structuredContent.items.map((item) => [item.componentId, item.path]), [["knowledge", "engineering.md"], ["product", "AGENTS.md"]]);
    assert.equal(resolved.structuredContent.briefing.items[0]?.content, "# Engineering\n");
    assert.equal(resolved.structuredContent.briefing.omissions[0]?.reason, "missing");
    assert.equal(resolved.structuredContent.artifactGuidance[0]?.artifact.name, "@tests/engineering");
    assert.equal(resolved.structuredContent.artifactGuidance[0]?.localFallback.dependencySpecifier, "file:../knowledge");

    send({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "work_start", arguments: { stack: "tests/mcp-authoring", componentId: "product", summary: "Exercise logical work", agent: "codex" } } });
    const startedWork = (await response(10)).result as { structuredContent: { sessionId: string } };
    const sessionId = startedWork.structuredContent.sessionId;
    send({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "turn_start", arguments: { stack: "tests/mcp-authoring", sessionId, task: "Exercise the turn lifecycle" } } });
    const startedTurn = (await response(11)).result as { structuredContent: { turnId: string } };
    const turnId = startedTurn.structuredContent.turnId;
    send({ jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "turn_complete", arguments: { stack: "tests/mcp-authoring", sessionId, turnId, summary: "Lifecycle exercised", status: "complete", changedPaths: ["src/example.ts"] } } });
    assert.equal((await response(12)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "work_list", arguments: { stack: "tests/mcp-authoring", componentId: "product", status: "active" } } });
    const workList = (await response(13)).result as { structuredContent: { work: Array<{ sessionId: string; title: string; turnCount: number }> } };
    assert.deepEqual(workList.structuredContent.work.map((item) => [item.sessionId, item.title, item.turnCount]), [[sessionId, "Exercise logical work", 1]]);
    send({ jsonrpc: "2.0", id: 14, method: "tools/call", params: { name: "work_get", arguments: { stack: "tests/mcp-authoring", sessionId } } });
    const workDetail = (await response(14)).result as { structuredContent: { turns: Array<{ turnId: string }> } };
    assert.equal(workDetail.structuredContent.turns[0]?.turnId, turnId);
    send({ jsonrpc: "2.0", id: 15, method: "tools/call", params: { name: "turn_get", arguments: { stack: "tests/mcp-authoring", sessionId, turnId } } });
    const turnDetail = (await response(15)).result as { structuredContent: { turn: { summary: string; changedPaths: string[] } } };
    assert.equal(turnDetail.structuredContent.turn.summary, "Lifecycle exercised");
    assert.deepEqual(turnDetail.structuredContent.turn.changedPaths, ["src/example.ts"]);
    send({ jsonrpc: "2.0", id: 16, method: "tools/call", params: { name: "capability_request_create", arguments: { stack: "tests/mcp-authoring", requesterComponentId: "product", providerComponentId: "knowledge", sessionId, capability: "practice.security", reason: "Product work needs shared security guidance." } } });
    const createdRequest = (await response(16)).result as { structuredContent: { request: { requestId: string; status: string } } };
    const requestId = createdRequest.structuredContent.request.requestId;
    assert.equal(createdRequest.structuredContent.request.status, "requested");
    send({ jsonrpc: "2.0", id: 17, method: "tools/call", params: { name: "capability_request_list", arguments: { stack: "tests/mcp-authoring", componentId: "knowledge" } } });
    const requestList = (await response(17)).result as { structuredContent: { requests: Array<{ requestId: string }> } };
    assert.equal(requestList.structuredContent.requests[0]?.requestId, requestId);
    send({ jsonrpc: "2.0", id: 18, method: "tools/call", params: { name: "capability_request_transition", arguments: { stack: "tests/mcp-authoring", requestId, componentId: "knowledge", status: "provider-complete", summary: "Security guidance published.", evidence: "engineering.md" } } });
    assert.equal((await response(18)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 19, method: "tools/call", params: { name: "capability_request_get", arguments: { stack: "tests/mcp-authoring", requestId } } });
    const requestDetail = (await response(19)).result as { structuredContent: { request: { status: string }; transitions: unknown[] } };
    assert.equal(requestDetail.structuredContent.request.status, "provider-complete");
    assert.equal(requestDetail.structuredContent.transitions.length, 1);
    send({ jsonrpc: "2.0", id: 20, method: "tools/call", params: { name: "work_complete", arguments: { stack: "tests/mcp-authoring", sessionId, summary: "Logical work complete" } } });
    assert.equal((await response(20)).result !== undefined, true);
    send({ jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "component_get", arguments: { stack: "tests/mcp-authoring", componentId: "product" } } });
    const describedComponent = (await response(21)).result as { structuredContent: { descriptor: { status: string; path: string } } };
    assert.equal(describedComponent.structuredContent.descriptor.status, "absent");
    assert.match(describedComponent.structuredContent.descriptor.path, /\.stack[/\\]component\.json$/u);
    send({ jsonrpc: "2.0", id: 22, method: "tools/call", params: { name: "component_update", arguments: { stack: "tests/mcp-authoring", componentId: "product", name: "Product application", description: "MCP-managed metadata", access: "read-only" } } });
    const updatedComponent = (await response(22)).result as { structuredContent: { component: { id: string; name: string; description: string; access: string } } };
    assert.deepEqual(updatedComponent.structuredContent.component, {
      ...updatedComponent.structuredContent.component,
      id: "product", name: "Product application", description: "MCP-managed metadata", access: "read-only",
    });
    assert.match(stderr, /^Stacks MCP server is listening for the machine catalog/u);
    assert.ok(stdout.split("\n").filter(Boolean).every((line) => (JSON.parse(line) as { jsonrpc?: string }).jsonrpc === "2.0"));
  } finally {
    child.stdin.end();
    child.kill();
    await rm(root, { recursive: true, force: true });
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
