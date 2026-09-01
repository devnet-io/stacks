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

test("keeps exercised MVP acceptance separate from its archived design narrative", () => {
  const vision = doc("11-mvp-agent-workflow-vision.md");
  const acceptance = doc("mvp-acceptance.md");
  const catalog = doc("catalog.json");
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(vision, /historical design material, not current-state documentation/u);
  assert.match(acceptance, /current delivery evidence, not a future proposal/u);
  assert.match(acceptance, /live `stacks mcp` stdio process/u);
  assert.match(catalog, /"id": "mvp-acceptance", "category": "current", "lifecycle": "current"/u);
  assert.match(catalog, /"id": "mvp-agent-workflow-vision", "category": "archive", "lifecycle": "archive"/u);
  assert.match(doc("product.md"), /authoritative providers/u);
  assert.match(doc("architecture.md"), /returned briefing has a stable digest/u);
  assert.match(doc("08-roadmap.md"), /minimum dependable briefing/u);
  assert.match(doc("08-roadmap.md"), /cross-component capability requests as a complete vertical slice/u);
  assert.match(agents, /mvp-acceptance\.md/u);
  assert.match(agents, /refresh the standalone local installation/u);
});

test("does not retain unused pre-milestone interfaces at the expense of a clear product", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(agents, /Until a compatibility milestone is explicitly declared/u);
  assert.match(doc("architecture.md"), /No compatibility milestone has been declared/u);
  assert.match(doc("architecture.md"), /never silently rewritten, corrupted, or discarded/u);
});

test("documents bounded provider descriptors and explicit Stack precedence", () => {
  assert.match(doc("architecture.md"), /strict `\.stack\/component\.json`/u);
  assert.match(doc("user-guide.md"), /Provider-owned component descriptors/u);
  assert.match(doc("user-guide.md"), /replaces the descriptor entry completely/u);
  assert.match(doc("adr/0013-provider-descriptors-are-bounded-inputs.md"), /Consumer requirements remain Stack-owned and explicit/u);
  assert.match(doc("http-reference.md"), /schemas\/http-components\.schema\.json/u);
  assert.doesNotMatch(doc("09-open-questions.md"), /Should reusable components publish/u);
});

test("documents canonical Markdown as the web documentation source", () => {
  assert.match(doc("README.md"), /Markdown files remain the prose source of truth/u);
  assert.match(doc("user-guide.md"), /do not maintain a second copy/u);
  const catalog = readFileSync(new URL("../apps/web/lib/documentation.ts", import.meta.url), "utf8");
  const lifecycleCatalog = readFileSync(new URL("../docs/catalog.json", import.meta.url), "utf8");
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  assert.match(catalog, /import\.meta\.glob\('\.\.\/\.\.\/\.\.\/docs\/\*\*\/\*\.md'/u);
  assert.match(catalog, /catalogJson/u);
  for (const lifecycle of ["current", "proposed", "decision", "archive"]) assert.match(lifecycleCatalog, new RegExp(`"lifecycle": "${lifecycle}"`, "u"));
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
    "component add", "component bind", "component provide", "component consume", "component guidance", "locate", "agent print", "agent check", "agent install", "agent remove", "status", "context", "sync", "lock", "ui", "mcp",
    "checkin start", "checkin turn-start", "checkin turn-complete", "checkin complete", "request list", "request get", "request create", "request transition", "usage import", "usage report",
    "doctor", "validate", "init",
  ];
  for (const operation of operations) assert.match(reference, new RegExp("### `stacks " + operation + "`", "u"));
  assert.match(reference, /Purpose|Creates|Lists|Returns|Reports|Builds|Starts|Runs|Appends|Writes/u);
  assert.match(reference, /```(?:bash|text)/u);
});

test("publishes complete MCP instructions, tools, resources, and examples", () => {
  const reference = doc("mcp-reference.md");
  for (const tool of ["instructions_get", "stack_list", "stack_memberships", "stack_get", "component_list", "component_get", "component_add", "component_bind", "capability_provide", "capability_consume", "guidance_configure", "stack_status", "context_resolve", "capability_request_list", "capability_request_get", "capability_request_create", "capability_request_transition", "work_list", "work_get", "turn_get", "work_start", "turn_start", "turn_complete", "work_complete", "usage_import", "usage_report"]) {
    assert.match(reference, new RegExp("### `" + tool + "`", "u"));
  }
  for (const uri of ["stacks://instructions", "stacks://reference/mcp", "stacks://reference/cli", "stacks://catalog"]) assert.match(reference, new RegExp(uri.replaceAll("/", "\\/"), "u"));
  const absent = reference.split("## Intentionally absent from MCP")[1] ?? "";
  assert.doesNotMatch(absent, /Component registration, binding/u);
  assert.match(reference, /Fully quit and reopen Codex/u);
  assert.match(reference, /Side effects/u);
  assert.match(reference, /```json/u);
});

test("documents every implemented local HTTP route and mutation boundary", () => {
  const reference = doc("http-reference.md");
  for (const route of [
    "GET /api/v0.1/health", "GET /api/v0.1/stacks", "GET /api/v0.1/overview", "GET /api/v0.1/activity", "GET /api/v0.1/activity/work", "GET /api/v0.1/activity/turn", "GET /api/v0.1/capability-requests", "GET /api/v0.1/capability-request",
    "GET /api/v0.1/graph", "GET /api/v0.1/integrations", "POST /api/v0.1/runtime/shutdown", "POST /api/v0.1/stacks",
    "GET /api/v0.1/components", "POST /api/v0.1/components", "PUT /api/v0.1/component-binding",
    "PUT /api/v0.1/capability-provider", "PUT /api/v0.1/capability-requirement", "PUT /api/v0.1/component-guidance", "POST /api/v0.1/capability-requests", "PUT /api/v0.1/capability-request",
  ]) assert.match(reference, new RegExp("### `" + route.replaceAll("/", "\\/") + "`", "u"));
  assert.match(reference, /must not be exposed beyond loopback/u);
  assert.match(reference, /Content-Type: application\/json/u);
});
