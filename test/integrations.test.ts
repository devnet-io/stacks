import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStackIntegrations, shellQuote } from "../src/application/integrations.ts";
import { loadStack } from "../src/core/manifest.ts";

test("integration guidance is Stack-scoped, executable, and secret-safe", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stacks-integrations-"));
  try {
    await mkdir(path.join(root, "app"));
    await writeFile(path.join(root, "stack.json"), `${JSON.stringify({
      apiVersion: "stacks.dev/v0alpha1", kind: "Stack",
      metadata: { id: "integration-test-id", namespace: "acme-org", name: "team-platform" },
      components: [{ id: "app", source: { type: "path", path: "app" } }],
    })}\n`, "utf8");
    const result = await buildStackIntegrations(await loadStack(root), {
      url: "https://mcp.example.test/stacks",
      bearerTokenEnvVar: "STACKS_TEST_TOKEN",
    });
    assert.equal(result.schemaVersion, "0.1");
    assert.equal(result.stack.definitionPath, path.join(root, "stack.json"));
    assert.equal(result.cli.developerInstallCommand, "npm run install:local");
    assert.equal(result.cli.refreshCommand, result.cli.developerInstallCommand);
    assert.match(result.cli.doctorCommand, /stacks doctor --root/u);
    assert.equal(result.mcp.serverName, "stacks");
    assert.deepEqual(result.mcp.local.args, ["mcp"]);
    assert.equal(result.mcp.local.codexAddCommand, "codex mcp add stacks -- stacks mcp");
    assert.equal(result.mcp.local.authentication, "none");
    assert.equal(result.mcp.local.clientRestartRequiredAfterRegistrationOrUpgrade, true);
    assert.match(result.mcp.local.codexToml, /command = "stacks"/u);
    assert.equal(result.agentInstructions.installCommand, "stacks agent install --path .");
    assert.equal(result.agentInstructions.checkCommand, "stacks agent check --path .");
    assert.equal(result.mcp.hosted.url, "https://mcp.example.test/stacks");
    assert.equal(result.mcp.hosted.bearerTokenEnvVar, "STACKS_TEST_TOKEN");
    assert.doesNotMatch(JSON.stringify(result), /super-secret-token/u);
    assert.ok(result.checks.every((check) => check.status === "pass"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("hosted MCP settings reject token values disguised as environment-variable names", async () => {
  await assert.rejects(
    async () => buildStackIntegrations(await loadStackResult(), { bearerTokenEnvVar: "actual token value" }),
    /valid environment variable/u,
  );
});

test("generated commands use the native shell's path quoting", () => {
  assert.equal(shellQuote("C:\\Users\\Joe\\My Stacks\\teststack", "win32"), '"C:\\Users\\Joe\\My Stacks\\teststack"');
  assert.equal(shellQuote("/Users/joe/My Stacks/teststack", "darwin"), "'/Users/joe/My Stacks/teststack'");
  assert.equal(shellQuote("/home/joe/My Stacks/teststack", "linux"), "'/home/joe/My Stacks/teststack'");
});

async function loadStackResult() { return loadStack(path.resolve(".")); }
