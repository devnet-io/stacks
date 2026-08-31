import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const stack = "verification/mvp-agent-workflow";

export async function verifyMvpWorkflow({ packageRoot, root, run }) {
  const cliPath = path.join(packageRoot, "dist", "cli.js");
  const componentsRoot = path.join(root, "components");
  const knowledge = path.join(componentsRoot, "knowledge");
  const ui = path.join(componentsRoot, "ui-library");
  const product = path.join(componentsRoot, "product");
  const env = {
    ...process.env,
    STACKS_CONFIG_HOME: path.join(root, "config"),
    STACKS_STATE_HOME: path.join(root, "state"),
  };

  await Promise.all([mkdir(knowledge, { recursive: true }), mkdir(ui, { recursive: true }), mkdir(product, { recursive: true })]);
  await writeFile(path.join(knowledge, "engineering.md"), "# Engineering rules\n\nReuse authoritative shared capabilities. Verify accessibility and tests before completion.\n", "utf8");
  await writeFile(path.join(ui, "components.md"), "# Shared UI capabilities\n\n- `ui.button`: accessible actions\n- `ui.paged-data-list`: paginated administrative data\n", "utf8");
  await writeFile(path.join(product, "product.md"), "# Product constraints\n\nDo not introduce product-local substitutes for capabilities owned by the shared UI library.\n", "utf8");
  await writeFile(path.join(product, "AGENTS.md"), "# Product-owned agent instructions\n\nPreserve this text.\n", "utf8");

  const cli = async (args) => {
    const output = await run(process.execPath, [cliPath, ...args, "--json"], { cwd: root, env });
    assert.equal(output.stderr, "");
    return JSON.parse(output.stdout);
  };

  await cli(["stack", "create", stack]);
  await cli(["component", "add", stack, "knowledge", "--path", knowledge, "--kind", "knowledge"]);
  await cli(["component", "add", stack, "ui-library", "--path", ui, "--kind", "library"]);
  await cli(["component", "add", stack, "product", "--path", product, "--kind", "product"]);
  await cli(["component", "provide", stack, "knowledge", "practice.engineering", "--context", "engineering.md", "--strength", "required"]);
  await cli(["component", "provide", stack, "ui-library", "ui.button", "--context", "components.md", "--strength", "preferred"]);
  await cli(["component", "provide", stack, "ui-library", "ui.paged-data-list", "--context", "components.md", "--strength", "preferred"]);
  await cli(["component", "consume", stack, "product", "practice.engineering", "--from", "knowledge"]);
  await cli(["component", "consume", stack, "product", "ui.button", "--from", "ui-library"]);
  await cli(["component", "consume", stack, "product", "ui.paged-data-list", "--from", "ui-library"]);
  await cli(["component", "guidance", stack, "product", "--path", "product.md", "--strength", "required"]);
  const activation = await cli(["agent", "install", "--path", product]);
  assert.equal(activation.status, "current");
  const agents = await readFile(path.join(product, "AGENTS.md"), "utf8");
  assert.match(agents, /Product-owned agent instructions/u);
  assert.match(agents, /<!-- stacks:agent-instructions:start -->/u);

  const mcp = createMcpClient(cliPath, root, env);
  try {
    await mcp.initialize();
    const memberships = await mcp.call("stack_memberships", { path: product });
    assert.equal(memberships.resolution, "component");
    assert.equal(memberships.memberships[0]?.stack.namespace, "verification");
    assert.equal(memberships.memberships[0]?.component.id, "product");
    assert.equal((await mcp.call("component_get", { stack, componentId: "product" })).component.kind, "product");
    assert.equal((await mcp.call("stack_status", { stack })).components.length, 3);

    const productWork = await mcp.call("work_start", { stack, componentId: "product", summary: "Build the administration section", agent: "acceptance-agent" });
    const productSession = productWork.sessionId;
    const reuseTurn = await mcp.call("turn_start", { stack, sessionId: productSession, task: "Build a paginated administration page using shared buttons" });
    assert.equal(reuseTurn.context.briefing.mode, "orientation");
    const orientation = reuseTurn.context.briefing.items.map((item) => item.content).join("\n");
    assert.match(orientation, /Reuse authoritative shared capabilities/u);
    assert.match(orientation, /ui\.button/u);
    assert.match(orientation, /ui\.paged-data-list/u);
    await mcp.call("turn_complete", { stack, sessionId: productSession, turnId: reuseTurn.turnId, summary: "Selected the authoritative button and paged data list.", status: "progress" });

    const blockedTurn = await mcp.call("turn_start", { stack, sessionId: productSession, task: "Add an accessible dialog to the administration page" });
    assert.equal(blockedTurn.context.briefing.mode, "refresh");
    assert.equal((await mcp.call("capability_request_list", { stack, componentId: "product" })).requests.length, 0);
    await mcp.call("capability_consume", { stack, componentId: "product", capability: "ui.dialog", from: "ui-library" });
    const created = await mcp.call("capability_request_create", {
      stack,
      requesterComponentId: "product",
      providerComponentId: "ui-library",
      sessionId: productSession,
      capability: "ui.dialog",
      reason: "The product must not create a parallel dialog implementation.",
      acceptance: "An accessible dialog is documented and available from the shared UI library.",
    });
    const requestId = created.request.requestId;
    await mcp.call("turn_complete", { stack, sessionId: productSession, turnId: blockedTurn.turnId, summary: "Recorded the missing shared dialog capability.", status: "blocked", nextStep: `Wait for ${requestId}` });

    const providerWork = await mcp.call("work_start", { stack, componentId: "ui-library", summary: "Provide the requested dialog capability", agent: "acceptance-agent" });
    const providerTurn = await mcp.call("turn_start", { stack, sessionId: providerWork.sessionId, task: "Implement the requested shared dialog" });
    assert.equal(providerTurn.context.capabilityRequests[0]?.requestId, requestId);
    await mcp.call("capability_request_transition", { stack, requestId, componentId: "ui-library", status: "in-progress", summary: "Dialog implementation started." });
    await writeFile(path.join(ui, "dialog.md"), "# Dialog\n\n`ui.dialog` provides an accessible modal surface with focus management.\n", "utf8");
    await mcp.call("capability_provide", { stack, componentId: "ui-library", capability: "ui.dialog", contextPath: "dialog.md", strength: "preferred" });
    await mcp.call("capability_request_transition", { stack, requestId, componentId: "ui-library", status: "provider-complete", summary: "Accessible dialog published.", evidence: "dialog.md" });
    await mcp.call("turn_complete", { stack, sessionId: providerWork.sessionId, turnId: providerTurn.turnId, summary: "Published and documented ui.dialog.", status: "complete", changedPaths: ["dialog.md"] });
    await mcp.call("work_complete", { stack, sessionId: providerWork.sessionId, summary: "Dialog capability is ready for consumer verification." });

    const resumeTurn = await mcp.call("turn_start", { stack, sessionId: productSession, task: "Verify and integrate the shared dialog" });
    assert.equal(resumeTurn.context.capabilityRequests[0]?.status, "provider-complete");
    assert.match(resumeTurn.context.briefing.items.map((item) => item.content).join("\n"), /focus management/u);
    await mcp.call("capability_request_transition", { stack, requestId, componentId: "product", status: "consumer-verified", summary: "The product verified the shared dialog guidance.", evidence: "product acceptance walkthrough" });
    await mcp.call("turn_complete", { stack, sessionId: productSession, turnId: resumeTurn.turnId, summary: "Integrated the authoritative shared dialog.", status: "complete" });
    await mcp.call("work_complete", { stack, sessionId: productSession, summary: "Administration section uses authoritative shared UI capabilities." });

    const request = await mcp.call("capability_request_get", { stack, requestId });
    assert.equal(request.request.status, "consumer-verified");
    assert.deepEqual(request.transitions.map((transition) => transition.toStatus), ["consumer-verified", "provider-complete", "in-progress"]);
    const finished = await mcp.call("work_get", { stack, sessionId: productSession });
    assert.equal(finished.work.status, "success");
    assert.equal(finished.turns.length, 3);
  } finally {
    await mcp.close();
  }
}

function createMcpClient(cliPath, cwd, env) {
  const child = spawn(process.execPath, [cliPath, "mcp"], { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const messages = [];
  let buffer = "";
  let stderr = "";
  let nextId = 1;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) messages.push(JSON.parse(line));
  });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const request = async (method, params) => {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const index = messages.findIndex((message) => message.id === id);
      if (index >= 0) {
        const message = messages.splice(index, 1)[0];
        if (message.error) throw new Error(`MCP ${method} failed: ${JSON.stringify(message.error)}`);
        return message.result;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`MCP ${method} timed out. stderr=${stderr}`);
  };

  return {
    async initialize() {
      const result = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stacks-mvp-acceptance", version: "1" } });
      assert.equal(result.serverInfo.name, "stacks");
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    },
    async call(name, args) {
      const result = await request("tools/call", { name, arguments: args });
      if (result.isError) throw new Error(`MCP tool ${name} failed: ${result.content?.map((item) => item.text).join(" ")}`);
      return result.structuredContent;
    },
    async close() {
      if (child.exitCode !== null) return;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.stdin.end();
      child.kill();
      await exited;
    },
  };
}
