import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const doc = (name: string) => readFileSync(new URL(`../docs/${name}`, import.meta.url), "utf8");

test("keeps product, current architecture, RFCs, and delivery evidence distinct", () => {
  assert.match(doc("product.md"), /defines the product independent of release state/u);
  assert.match(doc("architecture.md"), /describes implemented behavior/u);
  assert.match(doc("rfcs/README.md"), /Acceptance never means implementation or deployment/u);
  assert.match(doc("project-status.md"), /Do not infer completion/u);
});

test("does not retain unused pre-milestone interfaces at the expense of a clear product", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(agents, /Until a compatibility milestone is explicitly declared/u);
  assert.match(doc("architecture.md"), /No compatibility milestone has been declared/u);
  assert.match(doc("architecture.md"), /never silently rewritten, corrupted, or discarded/u);
});

test("documents canonical Markdown as the web documentation source", () => {
  assert.match(doc("README.md"), /Markdown files remain the source of truth/u);
  assert.match(doc("user-guide.md"), /do not maintain a second copy/u);
  const catalog = readFileSync(new URL("../apps/web/lib/documentation.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  assert.match(catalog, /import\.meta\.glob\('\.\.\/\.\.\/\.\.\/docs\/\*\*\/\*\.md'/u);
  for (const category of ["Use Stacks", "Current system & delivery", "Decisions & proposals", "Design archive"]) assert.match(catalog, new RegExp(category, "u"));
  for (const parameter of ["view", "document", "heading"]) assert.match(page, new RegExp(`searchParams\\.(?:get|set)\\('${parameter}'`, "u"));
  assert.match(page, /documentationHeadings/u);
});

test("keeps installation instructions current and secret-safe", () => {
  assert.match(doc("getting-started.md"), /npm run install:local/u);
  assert.match(doc("getting-started.md"), /stacks stack create/u);
  assert.match(doc("getting-started.md"), /does not link to the clone/u);
  assert.doesNotMatch(doc("getting-started.md"), /src\/cli\.ts|dist\/cli\.js|cli:refresh|dev:cli/u);
  assert.match(doc("deployment.md"), /environment-variable name/u);
  assert.match(doc("deployment.md"), /Never put the bearer token value/u);
});

test("documents the implemented Graph and supplementary Docker quality gate", () => {
  assert.match(doc("architecture.md"), /Graph renders the declarative provider\/dependency relationships/u);
  assert.match(doc("user-guide.md"), /GET \/api\/v0\.1\/graph/u);
  assert.match(doc("user-guide.md"), /npm run check:docker/u);
});

test("documents every CLI operation with focused reference sections", () => {
  const reference = doc("cli-reference.md");
  const operations = [
    "help", "--version", "stack create", "stack list", "component list", "component get",
    "component add", "component bind", "locate", "status", "context", "sync", "lock", "ui", "mcp",
    "checkin start", "checkin turn", "checkin complete", "usage record", "usage report",
    "doctor", "validate", "init",
  ];
  for (const operation of operations) assert.match(reference, new RegExp("### `stacks " + operation + "`", "u"));
  assert.match(reference, /Purpose|Creates|Lists|Returns|Reports|Builds|Starts|Runs|Appends|Writes/u);
  assert.match(reference, /```(?:bash|text)/u);
});

test("publishes complete MCP instructions, tools, resources, and examples", () => {
  const reference = doc("mcp-reference.md");
  for (const tool of ["instructions_get", "stack_list", "stack_memberships", "stack_get", "component_list", "component_get", "component_add", "component_bind", "stack_status", "context_resolve", "work_start", "turn_complete", "work_complete", "usage_record", "usage_report"]) {
    assert.match(reference, new RegExp("### `" + tool + "`", "u"));
  }
  for (const uri of ["stacks://instructions", "stacks://reference/mcp", "stacks://reference/cli", "stacks://catalog"]) assert.match(reference, new RegExp(uri.replaceAll("/", "\\/"), "u"));
  assert.match(reference, /Side effects/u);
  assert.match(reference, /```json/u);
});

test("documents every implemented local HTTP route and mutation boundary", () => {
  const reference = doc("http-reference.md");
  for (const route of [
    "GET /api/v0.1/health", "GET /api/v0.1/stacks", "GET /api/v0.1/overview", "GET /api/v0.1/activity",
    "GET /api/v0.1/graph", "GET /api/v0.1/integrations", "POST /api/v0.1/runtime/shutdown", "POST /api/v0.1/stacks",
    "POST /api/v0.1/components", "PUT /api/v0.1/component-binding",
  ]) assert.match(reference, new RegExp("### `" + route.replaceAll("/", "\\/") + "`", "u"));
  assert.match(reference, /must not be exposed beyond loopback/u);
  assert.match(reference, /Content-Type: application\/json/u);
});
