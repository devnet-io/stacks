#!/usr/bin/env node
import process from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createLocalStacksApplication, type StackReference } from "./application/stacks-application.ts";
import type { CostKind, EventActor, UsageData } from "./core/types.ts";
import { STACKS_VERSION } from "./version.ts";
import { manageAgentsMd, type AgentsMdOperation } from "./agent/agents-md.ts";
import { STACKS_MCP_RESOURCES, STACKS_MCP_TOOL_NAMES } from "./mcp/catalog.ts";

interface ParsedArgs {
  positionals: string[];
  options: Record<string, string | boolean>;
}

function parseArguments(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) continue;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const equalsIndex = token.indexOf("=");
    if (equalsIndex > 2) {
      options[token.slice(2, equalsIndex)] = token.slice(equalsIndex + 1);
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { positionals, options };
}

function stringOption(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.options[name];
  return typeof value === "string" ? value : undefined;
}

function requiredOption(parsed: ParsedArgs, name: string): string {
  const value = stringOption(parsed, name);
  if (!value) throw new Error(`Missing required option --${name}.`);
  return value;
}

function booleanOption(parsed: ParsedArgs, name: string): boolean {
  return parsed.options[name] === true;
}

function numericOption(parsed: ParsedArgs, name: string): number | undefined {
  const raw = stringOption(parsed, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a finite number.`);
  return value;
}

function nonNegativeNumericOption(parsed: ParsedArgs, name: string): number | undefined {
  const value = numericOption(parsed, name);
  if (value !== undefined && value < 0) throw new Error(`--${name} must be non-negative.`);
  return value;
}

function listOption(parsed: ParsedArgs, name: string): string[] | undefined {
  const raw = stringOption(parsed, name);
  if (raw === undefined) return undefined;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function rootOption(parsed: ParsedArgs): string {
  return stringOption(parsed, "root") ?? process.cwd();
}

function stackReference(parsed: ParsedArgs): StackReference {
  const selector = stringOption(parsed, "stack");
  const root = stringOption(parsed, "root");
  if (selector && root) throw new Error("Use either --stack or the legacy --root option, not both.");
  if (selector) return { stack: selector };
  if (root) return { root };
  throw new Error("Select a registered Stack with --stack <namespace/name>. Legacy directory manifests require explicit --root <directory>.");
}

const application = createLocalStacksApplication({
  hostedMcp: {
    url: process.env.STACKS_HOSTED_MCP_URL,
    bearerTokenEnvVar: process.env.STACKS_HOSTED_MCP_TOKEN_ENV_VAR,
  },
});

function actorFrom(parsed: ParsedArgs): EventActor | undefined {
  const agent = stringOption(parsed, "agent");
  const client = stringOption(parsed, "client");
  const model = stringOption(parsed, "model");
  if (!agent && !client && !model) return undefined;
  return {
    ...(agent === undefined ? {} : { agent }),
    ...(client === undefined ? {} : { client }),
    ...(model === undefined ? {} : { model }),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(topic?: string): void {
  const topics: Record<string, string> = {
    stack: `Create and list Stacks in this machine's catalog.\n\n  stacks stack create <namespace/name> [--json]\n  stacks stack list [--json]\n`,
    component: `View, attach, and configure components in registered Stacks. Configuration operations upsert by capability or path.\n\n  stacks component list <namespace/name> [--json]\n  stacks component get <namespace/name> <id> [--json]\n  stacks component add <namespace/name> <id> --path <dir> [--git <url>] [--kind <kind>] [--name <name>] [--json]\n  stacks component bind <namespace/name> <id> --path <dir> [--json]\n  stacks component provide <namespace/name> <id> <capability> [--context <path>] [--description <text>] [--strength <strength>] [--priority <number>] [--json]\n  stacks component consume <namespace/name> <id> <capability> [--from <component>] [--optional] [--json]\n  stacks component guidance <namespace/name> <id> --path <path> [--description <text>] [--strength <strength>] [--priority <number>] [--applies-to <a,b>] [--json]\n`,
    locate: `Find every Stack component whose explicit binding contains a directory. Multiple matches are returned instead of guessing.\n\n  stacks locate [directory] [--json]\n`,
    agent: `Manage only the delimited Stacks activation block in a repository AGENTS.md. Existing instructions are preserved; malformed markers are refused.\n\n  stacks agent print [--path <directory>] [--json]\n  stacks agent check [--path <directory>] [--json]\n  stacks agent install [--path <directory>] [--json]\n  stacks agent remove [--path <directory>] [--json]\n`,
    status: `Inspect registered Stack component paths and Git state without changing repositories. With no selector, inspect every registered Stack. Loading a Stack also validates its definition.\n\n  stacks status [--stack <namespace/name> | --root <legacy-directory>] [--json]\n`,
    sync: `Clone missing Git components to their explicit paths. Add --update to fetch existing repositories; Stacks never resets, cleans, merges, or rebases.\n\n  stacks sync --stack <namespace/name> [--dry-run] [--update] [--json]\n`,
    context: `Resolve bounded, provenance-rich context for one target component.\n\n  stacks context <target> --stack <namespace/name> [--task <text>] [--json]\n`,
    ui: `Open the machine-level Stacks UI. It serves the UI and API together on port 3210, automatically choosing the next free port when needed.\n\n  stacks ui [--port <number>] [--no-open]\n`,
    mcp: `Run the machine-level MCP adapter over stdio. Agent clients start this command when needed; do not run it as a daemon.\n\n  stacks mcp\n`,
    checkin: `Append turn-based agent work lifecycle events.\n\n  stacks checkin start --stack <namespace/name> --component <id> --summary <text> [--work <id>] [actor options] [--json]\n  stacks checkin turn-start --stack <namespace/name> --session <id> --task <text> [--json]\n  stacks checkin turn-complete --stack <namespace/name> --session <id> --turn <id> --summary <text> [--status <status>] [--files <a,b>] [--next <text>] [token/cost options] [--json]\n  stacks checkin complete --stack <namespace/name> --session <id> --summary <text> [--outcome <outcome>] [--remaining <a,b>] [--json]\n`,
    usage: `Import delayed usage data or report recorded usage. Live agent telemetry belongs on turn completion. Monetary values require reported, estimated, or allocated provenance.\n\n  stacks usage import --stack <namespace/name> --provider <name> --model <name> [--session <id>] [--turn <id>] [token/cost options] [--json]\n  stacks usage report --stack <namespace/name> [--json]\n`,
    commands: `All commands\n\n  stack create|list                  Create or list catalog definitions\n  component list|get|add|bind|...    View, attach, and configure components\n  locate                             Find Stack membership for a directory\n  agent print|check|install|remove   Manage repository agent activation\n  status                             Inspect component and Git state\n  context                            Resolve bounded context for a target\n  sync                               Clone or fetch Git components safely\n  ui                                 Open the local management UI\n  mcp                                Run the stdio MCP adapter\n  checkin start|turn-start|turn-complete|complete\n                                      Append turn-based work lifecycle events\n  usage import|report                Import delayed usage or report totals\n  lock                               Write a revision snapshot\n  init                               Create a legacy directory manifest\n  validate                           Validate a standalone or legacy definition\n  doctor                             Troubleshoot runtime and adapter installation\n\nRun stacks help <command> for usage. Directory-based --root forms remain available for legacy manifests.\n`,
    lock: `Write stack.lock.json with the current component revisions.\n\n  stacks lock --stack <namespace/name> [--json]\n`,
    init: `Create a legacy directory-based Stack manifest. New Stacks should normally use stacks stack create.\n\n  stacks init --namespace <namespace> --name <name> [--root <dir>] [--json]\n`,
    validate: `Validate a standalone or legacy Stack definition. Registered Stacks are validated whenever they are loaded, including by stacks status.\n\n  stacks validate [--stack <namespace/name> | --root <dir>] [--json]\n`,
    doctor: `Troubleshoot the installed runtime and MCP contract. Add --stack only when component diagnostics are also needed. This is not required during normal use; use stacks status for Stack health.\n\n  stacks doctor [--stack <namespace/name> | --root <legacy-directory>] [--json]\n`,
  };
  if (topic && topics[topic]) {
    process.stdout.write(`Stacks · ${topic}\n\n${topics[topic]}`);
    return;
  }
  process.stdout.write(`Stacks - portable composition, context, and agent activity for local development\n\n`);
  process.stdout.write(`Common commands\n\n`);
  process.stdout.write(`  stacks stack create <namespace/name>       Create a Stack\n`);
  process.stdout.write(`  stacks component add ...                  Add a component\n`);
  process.stdout.write(`  stacks locate [directory]                 Find Stack membership\n`);
  process.stdout.write(`  stacks status --stack <namespace/name>    Inspect Stack health\n`);
  process.stdout.write(`  stacks context <target> --stack <name>    Resolve agent context\n`);
  process.stdout.write(`  stacks ui                                 Open the local UI\n`);
  process.stdout.write(`  stacks mcp                                Run the stdio adapter\n\n`);
  process.stdout.write(`Run stacks help commands for every command, or stacks help <command> for details.\n`);
}

function optionalPortOption(parsed: ParsedArgs, name: string): number | undefined {
  const value = numericOption(parsed, name);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error(`--${name} must be an integer from 0 to 65535.`);
  return value;
}

async function commandInit(parsed: ParsedArgs): Promise<void> {
  const output = await application.initializeLegacyStack(rootOption(parsed), requiredOption(parsed, "namespace"), requiredOption(parsed, "name"));
  if (booleanOption(parsed, "json")) printJson(output);
  else process.stdout.write(`Created ${output.manifestPath}\n`);
}

async function commandValidate(parsed: ParsedArgs): Promise<void> {
  const output = await application.validateStack(stackReference(parsed));
  if (booleanOption(parsed, "json")) printJson(output);
  else if (output.valid) process.stdout.write(`Valid Stack definition: ${output.manifestPath}\n`);
  else process.stdout.write(`Invalid Stack definition: ${output.manifestPath}\n- ${output.errors.join("\n- ")}\n`);
  if (!output.valid) process.exitCode = 2;
}

async function commandStatus(parsed: ParsedArgs): Promise<void> {
  const hasSelection = Boolean(stringOption(parsed, "stack") || stringOption(parsed, "root"));
  if (!hasSelection) {
    const catalog = await application.getCatalogStatus();
    if (booleanOption(parsed, "json")) {
      printJson(catalog);
      return;
    }
    if (catalog.stacks.length === 0) {
      process.stdout.write("No registered Stacks. Create one with: stacks stack create <namespace/name>\n");
      return;
    }
    for (const output of catalog.stacks) printHumanStatus(output);
    return;
  }
  const output = await application.getStatus(stackReference(parsed));
  if (booleanOption(parsed, "json")) {
    printJson(output);
    return;
  }
  printHumanStatus(output);
}

function printHumanStatus(output: Awaited<ReturnType<typeof application.getStatus>>): void {
  process.stdout.write(`Stack: ${output.stack.namespace}/${output.stack.name}\n`);
  for (const status of output.components) {
    const state = !status.exists ? "missing" : status.issues.length > 0 ? "issue" : status.git?.dirty ? "dirty" : "ready";
    const revision = status.git?.commit ? ` ${status.git.commit.slice(0, 12)}` : "";
    process.stdout.write(`- ${status.id}: ${state}${revision} (${status.root})\n`);
    for (const issue of status.issues) process.stdout.write(`    ! ${issue}\n`);
  }
}

async function commandSync(parsed: ParsedArgs): Promise<void> {
  const output = await application.sync(stackReference(parsed), { dryRun: booleanOption(parsed, "dry-run"), update: booleanOption(parsed, "update") });
  if (booleanOption(parsed, "json")) printJson(output);
  else for (const result of output.results) process.stdout.write(`- ${result.componentId}: ${result.action} - ${result.message}\n`);
  if (output.results.some((result) => result.action === "error")) process.exitCode = 2;
}

async function commandLock(parsed: ParsedArgs): Promise<void> {
  const output = await application.lock(stackReference(parsed));
  if (booleanOption(parsed, "json")) printJson(output);
  else process.stdout.write(`Wrote ${output.lockPath}\n`);
}

async function commandContext(parsed: ParsedArgs): Promise<void> {
  const target = parsed.positionals[1];
  if (!target) throw new Error("Usage: stacks context <target-component>.");
  const reference = stackReference(parsed);
  const plan = await application.resolveContext(reference, target, stringOption(parsed, "task"));
  if (booleanOption(parsed, "json")) {
    printJson(plan);
  } else {
    const selected = "stack" in reference ? reference.stack : reference.root;
    process.stdout.write(`Context for ${target} in ${selected}\n`);
    for (const item of plan.items) {
      process.stdout.write(`- [${item.strength}] ${item.componentId}:${item.path}\n`);
      process.stdout.write(`    ${item.reasons.join("; ")}\n`);
    }
    for (const warning of plan.warnings) process.stdout.write(`WARNING: ${warning}\n`);
    for (const error of plan.errors) process.stdout.write(`ERROR: ${error}\n`);
  }
  if (plan.errors.length > 0) process.exitCode = 2;
}

function usageFromOptions(parsed: ParsedArgs, required: boolean): UsageData | undefined {
  const optionNames = ["provider", "model", "input", "output", "cached-input", "reasoning", "tool-calls", "duration-ms", "amount", "currency", "cost-kind", "pricing-reference", "note"];
  if (!required && !optionNames.some((name) => parsed.options[name] !== undefined)) return undefined;
  const costKind = stringOption(parsed, "cost-kind") as CostKind | undefined;
  if (costKind && !["reported", "estimated", "allocated"].includes(costKind)) throw new Error("Invalid --cost-kind.");
  const inputTokens = nonNegativeNumericOption(parsed, "input");
  const outputTokens = nonNegativeNumericOption(parsed, "output");
  const cachedInputTokens = nonNegativeNumericOption(parsed, "cached-input");
  const reasoningTokens = nonNegativeNumericOption(parsed, "reasoning");
  const toolCalls = nonNegativeNumericOption(parsed, "tool-calls");
  const durationMs = nonNegativeNumericOption(parsed, "duration-ms");
  const amount = nonNegativeNumericOption(parsed, "amount");
  const currency = stringOption(parsed, "currency");
  const pricingReference = stringOption(parsed, "pricing-reference");
  const note = stringOption(parsed, "note");
  const usage: UsageData = {
    provider: requiredOption(parsed, "provider"),
    model: requiredOption(parsed, "model"),
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    ...(toolCalls === undefined ? {} : { toolCalls }),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(amount === undefined ? {} : { amount }),
    ...(currency === undefined ? {} : { currency }),
    ...(costKind === undefined ? {} : { costKind }),
    ...(pricingReference === undefined ? {} : { pricingReference }),
    ...(note === undefined ? {} : { note }),
  };
  if (usage.amount !== undefined && usage.costKind === undefined) throw new Error("--cost-kind is required whenever --amount is supplied.");
  return usage;
}

async function commandCheckin(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1];
  const reference = stackReference(parsed);
  if (operation === "start") {
    const workId = stringOption(parsed, "work");
    const actor = actorFrom(parsed);
    const event = await application.startWork(reference, {
      componentId: requiredOption(parsed, "component"),
      summary: requiredOption(parsed, "summary"),
      ...(workId === undefined ? {} : { workId }),
      ...(actor === undefined ? {} : { actor }),
    });
    if (booleanOption(parsed, "json")) printJson(event);
    else process.stdout.write(`Started session ${event.sessionId}\n`);
    return;
  }
  if (operation === "turn-start") {
    const output = await application.startTurn(reference, {
      sessionId: requiredOption(parsed, "session"),
      task: requiredOption(parsed, "task"),
    });
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Started turn ${output.turn.turnId} for session ${output.turn.sessionId} with ${output.context.items.length} context items\n`);
    return;
  }
  if (operation === "turn-complete") {
    const status = stringOption(parsed, "status") as "progress" | "blocked" | "failed" | "complete" | undefined;
    if (status && !["progress", "blocked", "failed", "complete"].includes(status)) throw new Error("Invalid --status.");
    const changedPaths = listOption(parsed, "files");
    const nextStep = stringOption(parsed, "next");
    const usage = usageFromOptions(parsed, false);
    const output = await application.completeTurn(reference, {
      sessionId: requiredOption(parsed, "session"),
      turnId: requiredOption(parsed, "turn"),
      summary: requiredOption(parsed, "summary"),
      ...(status === undefined ? {} : { status }),
      ...(changedPaths === undefined ? {} : { changedPaths }),
      ...(nextStep === undefined ? {} : { nextStep }),
      ...(usage === undefined ? {} : { usage }),
    });
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Completed turn ${output.turn.turnId} for session ${output.turn.sessionId}${output.usage ? " with usage" : ""}\n`);
    return;
  }
  if (operation === "complete") {
    const outcome = stringOption(parsed, "outcome") as "success" | "partial" | "failed" | "cancelled" | undefined;
    if (outcome && !["success", "partial", "failed", "cancelled"].includes(outcome)) throw new Error("Invalid --outcome.");
    const remaining = listOption(parsed, "remaining");
    const event = await application.completeWork(reference, {
      sessionId: requiredOption(parsed, "session"),
      summary: requiredOption(parsed, "summary"),
      ...(outcome === undefined ? {} : { outcome }),
      ...(remaining === undefined ? {} : { remaining }),
    });
    if (booleanOption(parsed, "json")) printJson(event);
    else process.stdout.write(`Completed session ${event.sessionId} with event ${event.id}\n`);
    return;
  }
  throw new Error("Usage: stacks checkin start|turn-start|turn-complete|complete ...");
}

async function commandUsage(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1];
  const reference = stackReference(parsed);
  if (operation === "import") {
    const componentId = stringOption(parsed, "component");
    const sessionId = stringOption(parsed, "session");
    const turnId = stringOption(parsed, "turn");
    const workId = stringOption(parsed, "work");
    const actor = actorFrom(parsed);
    const event = await application.importUsage(reference, {
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(turnId === undefined ? {} : { turnId }),
      ...(componentId === undefined ? {} : { componentId }),
      ...(workId === undefined ? {} : { workId }),
      ...(actor === undefined ? {} : { actor }),
      usage: usageFromOptions(parsed, true)!,
    });
    if (booleanOption(parsed, "json")) printJson(event);
    else process.stdout.write(`Recorded usage event ${event.id}\n`);
    return;
  }
  if (operation === "report") {
    const report = await application.getUsageReport(reference);
    if (booleanOption(parsed, "json")) printJson(report);
    else {
      if (report.rows.length === 0) process.stdout.write("No usage events recorded.\n");
      for (const row of report.rows) {
        const amounts = Object.entries(row.amounts).map(([currency, rowAmount]) => `${rowAmount.toFixed(4)} ${currency}`).join(", ");
        process.stdout.write(`- ${row.provider}/${row.model}${row.componentId ? ` @ ${row.componentId}` : ""}: ${row.inputTokens} in, ${row.outputTokens} out${amounts ? `, ${amounts}` : ""}\n`);
      }
      for (const warning of report.warnings) process.stdout.write(`WARNING: ${warning}\n`);
    }
    return;
  }
  throw new Error("Usage: stacks usage import|report ...");
}

async function commandMcp(parsed: ParsedArgs): Promise<void> {
  const module = await import("./mcp/server.ts");
  module.startMcpServer();
}

async function commandDoctor(parsed: ParsedArgs): Promise<void> {
  const hasSelection = Boolean(stringOption(parsed, "stack") || stringOption(parsed, "root"));
  if (!hasSelection) {
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    const result = {
      schemaVersion: "0.1",
      cli: { version: STACKS_VERSION, command: "stacks" },
      mcp: {
        serverName: "stacks",
        transport: "stdio",
        command: "stacks",
        args: ["mcp"],
        tools: [...STACKS_MCP_TOOL_NAMES],
        resources: STACKS_MCP_RESOURCES.map((resource) => resource.uri),
        codexAddCommand: "codex mcp add stacks -- stacks mcp",
        clientRestartRequiredAfterRegistrationOrUpgrade: true,
      },
      checks: [
        { id: "runtime", label: "Node.js runtime", status: nodeMajor >= 22 ? "pass" : "fail", detail: `Node.js ${process.versions.node}; Stacks requires 22.6 or newer.` },
        { id: "mcp-contract", label: "MCP contract", status: "pass", detail: `${STACKS_MCP_TOOL_NAMES.length} tools and ${STACKS_MCP_RESOURCES.length} resources are built into Stacks ${STACKS_VERSION}.` },
      ],
      notes: [
        { id: "mcp-client-refresh", detail: "Stacks cannot inspect an agent client's already-loaded tool registry. Fully restart Codex after MCP registration or a Stacks upgrade that changes MCP tools." },
      ],
    } as const;
    if (booleanOption(parsed, "json")) printJson(result);
    else {
      process.stdout.write(`Stacks ${result.cli.version}\n`);
      for (const check of result.checks) process.stdout.write(`${check.status === "pass" ? "PASS" : "FAIL"} ${check.label}: ${check.detail}\n`);
      for (const note of result.notes) process.stdout.write(`NOTE ${note.detail}\n`);
      process.stdout.write(`\nCodex MCP: ${result.mcp.codexAddCommand}\n`);
    }
    if (result.checks.some((check) => check.status === "fail")) process.exitCode = 2;
    return;
  }
  const result = await application.getIntegrations(stackReference(parsed));
  if (booleanOption(parsed, "json")) printJson(result);
  else {
    process.stdout.write(`Stacks ${result.cli.version} · ${result.stack.namespace}/${result.stack.name}\n`);
    for (const check of result.checks) process.stdout.write(`${check.status === "pass" ? "PASS" : check.status === "warning" ? "WARN" : "FAIL"} ${check.label}: ${check.detail}\n`);
    process.stdout.write(`\nCodex MCP: ${result.mcp.local.codexAddCommand}\n`);
  }
  if (result.checks.some((check) => check.status === "fail")) process.exitCode = 2;
}

async function commandStack(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1];
  if (operation === "create") {
    const selector = parsed.positionals[2];
    if (!selector) throw new Error("Usage: stacks stack create <namespace/name>.");
    const identity = await application.createStack(selector, { actor: { client: "stacks-cli" } });
    const output = { schemaVersion: "0.1", stack: identity };
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Created Stack ${selector}\n`);
    return;
  }
  if (operation === "list") {
    const stacks = await application.listStacks();
    const output = { schemaVersion: "0.1", stacks };
    if (booleanOption(parsed, "json")) printJson(output);
    else if (!stacks.length) process.stdout.write("No registered Stacks.\n");
    else for (const stack of stacks) process.stdout.write(`${stack.namespace}/${stack.name}\n`);
    return;
  }
  throw new Error("Usage: stacks stack create|list ...");
}

async function commandComponent(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1];
  const selector = parsed.positionals[2];
  const id = parsed.positionals[3];
  if (!selector || !operation) throw new Error("Usage: stacks component list|get|add|bind|provide|consume|guidance <namespace/name> ...");
  if (operation === "list") {
    const output = await application.listComponents(selector);
    if (booleanOption(parsed, "json")) printJson(output);
    else if (!output.components.length) process.stdout.write(`No components in ${selector}.\n`);
    else for (const item of output.components) process.stdout.write(`${item.component.id}\t${item.component.kind ?? "component"}\t${item.binding ?? "unbound"}\n`);
    return;
  }
  if (operation === "get") {
    if (!id) throw new Error("Usage: stacks component get <namespace/name> <id> [--json].");
    const output = await application.getComponent(selector, id);
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`${output.component.id} (${output.component.kind ?? "component"})\nStack: ${output.stack.namespace}/${output.stack.name}\nPath: ${output.binding ?? "unbound"}\n`);
    return;
  }
  if (!id) throw new Error("Usage: stacks component add|bind|provide|consume|guidance <namespace/name> <id> ...");
  if (operation === "provide") {
    const capability = parsed.positionals[4];
    if (!capability) throw new Error("Usage: stacks component provide <namespace/name> <id> <capability> ...");
    const contextPath = stringOption(parsed, "context");
    const strength = stringOption(parsed, "strength") as "required" | "preferred" | "reference" | undefined;
    if (strength && !["required", "preferred", "reference"].includes(strength)) throw new Error("Invalid --strength.");
    const priority = numericOption(parsed, "priority");
    const output = await application.configureCapabilityExport(selector, id, {
      capability,
      ...(stringOption(parsed, "description") === undefined ? {} : { description: stringOption(parsed, "description")! }),
      ...(contextPath === undefined ? {} : { context: [{ path: contextPath, ...(strength === undefined ? {} : { strength }), ...(priority === undefined ? {} : { priority }) }] }),
    }, { actor: { client: "stacks-cli" } });
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Configured ${id} as a provider of ${capability}.\n`);
    return;
  }
  if (operation === "consume") {
    const capability = parsed.positionals[4];
    if (!capability) throw new Error("Usage: stacks component consume <namespace/name> <id> <capability> ...");
    const from = stringOption(parsed, "from");
    const output = await application.configureCapabilityRequirement(selector, id, {
      capability,
      ...(from === undefined ? {} : { from }),
      ...(booleanOption(parsed, "optional") ? { optional: true } : {}),
    }, { actor: { client: "stacks-cli" } });
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Configured ${id} to consume ${capability}${from ? ` from ${from}` : ""}.\n`);
    return;
  }
  if (operation === "guidance") {
    const guidancePath = requiredOption(parsed, "path");
    const strength = (stringOption(parsed, "strength") ?? "reference") as "required" | "preferred" | "reference";
    if (!["required", "preferred", "reference"].includes(strength)) throw new Error("Invalid --strength.");
    const priority = numericOption(parsed, "priority");
    const appliesTo = listOption(parsed, "applies-to");
    const output = await application.configureGuidance(selector, id, {
      path: guidancePath,
      strength,
      ...(stringOption(parsed, "description") === undefined ? {} : { description: stringOption(parsed, "description")! }),
      ...(priority === undefined ? {} : { priority }),
      ...(appliesTo === undefined ? {} : { appliesTo }),
    }, { actor: { client: "stacks-cli" } });
    if (booleanOption(parsed, "json")) printJson(output);
    else process.stdout.write(`Configured guidance ${guidancePath} for ${id}.\n`);
    return;
  }
  const localPath = requiredOption(parsed, "path");
  if (operation === "bind") {
    const changed = await application.bindComponent(selector, id, localPath, { actor: { client: "stacks-cli" } });
    const output = { schemaVersion: "0.1", stack: selector, component: id, path: changed.bindings[id], sync: changed.sync };
    if (booleanOption(parsed, "json")) printJson(output); else process.stdout.write(`Bound ${id} in ${selector} to ${changed.bindings[id]}\n${changed.sync.message}\n`);
    return;
  }
  if (operation !== "add") throw new Error("Usage: stacks component add|bind <namespace/name> <id> --path <dir> ...");
  const changed = await application.addComponent({
    stack: selector, id, path: localPath,
    ...(stringOption(parsed, "git") === undefined ? {} : { git: stringOption(parsed, "git")! }),
    ...(stringOption(parsed, "kind") === undefined ? {} : { kind: stringOption(parsed, "kind")! }),
    ...(stringOption(parsed, "name") === undefined ? {} : { name: stringOption(parsed, "name")! }),
    actor: { client: "stacks-cli" },
  });
  const output = { schemaVersion: "0.1", stack: selector, component: id, path: changed.bindings[id], sync: changed.sync };
  if (booleanOption(parsed, "json")) printJson(output);
  else process.stdout.write(`Added ${id} to ${selector} at ${changed.bindings[id]}\n${changed.sync.message}\n`);
}

async function commandLocate(parsed: ParsedArgs): Promise<void> {
  const output = await application.findMemberships(parsed.positionals[1] ?? process.cwd());
  if (booleanOption(parsed, "json")) {
    printJson(output);
    return;
  }
  if (!output.memberships.length) {
    process.stdout.write(`No Stack component binding contains ${output.path}.\n`);
    return;
  }
  for (const membership of output.memberships) {
    process.stdout.write(`${membership.stack.namespace}/${membership.stack.name}\t${membership.component.id}\t${membership.root}\t${membership.relativePath}\n`);
  }
}

async function commandAgent(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1] as AgentsMdOperation | undefined;
  if (!operation || !["print", "check", "install", "remove"].includes(operation)) {
    throw new Error("Usage: stacks agent print|check|install|remove [--path <directory>] [--json].");
  }
  const output = await manageAgentsMd(stringOption(parsed, "path") ?? process.cwd(), operation);
  if (booleanOption(parsed, "json")) {
    printJson(output);
  } else if (operation === "print") {
    process.stdout.write(`${output.content ?? ""}\n`);
  } else {
    process.stdout.write(`${operation === "check" ? "Agent activation" : operation === "install" ? "Installed agent activation" : "Removed agent activation"}: ${output.status} at ${output.path}${output.changed ? " (changed)" : ""}\n`);
  }
  if (operation === "check" && output.status !== "current") process.exitCode = 2;
}

async function commandUi(parsed: ParsedArgs): Promise<void> {
  const module = await import("./ui/launcher.ts");
  const webPort = optionalPortOption(parsed, "port");
  const legacyRoot = stringOption(parsed, "root");
  await module.launchLocalUi({
    ...(legacyRoot === undefined ? {} : { root: legacyRoot }),
    ...(webPort === undefined ? {} : { webPort }),
    openBrowser: !booleanOption(parsed, "no-open"),
  });
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(`${STACKS_VERSION}\n`);
    return;
  }
  const parsed = parseArguments(args);
  const command = parsed.positionals[0] ?? "help";
  if (booleanOption(parsed, "help") && command !== "help") {
    help(command);
    return;
  }
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      help(parsed.positionals[1]);
      return;
    case "init":
      await commandInit(parsed);
      return;
    case "stack":
      await commandStack(parsed);
      return;
    case "component":
      await commandComponent(parsed);
      return;
    case "locate":
      await commandLocate(parsed);
      return;
    case "agent":
      await commandAgent(parsed);
      return;
    case "validate":
      await commandValidate(parsed);
      return;
    case "status":
      await commandStatus(parsed);
      return;
    case "sync":
      await commandSync(parsed);
      return;
    case "lock":
      await commandLock(parsed);
      return;
    case "context":
      await commandContext(parsed);
      return;
    case "checkin":
      await commandCheckin(parsed);
      return;
    case "usage":
      await commandUsage(parsed);
      return;
    case "mcp":
      await commandMcp(parsed);
      return;
    case "doctor":
      await commandDoctor(parsed);
      return;
    case "ui":
      await commandUi(parsed);
      return;
    default:
      throw new Error(`Unknown command: ${command}. Run stacks help.`);
  }
}

const entrypoint = process.argv[1];
function isEntrypoint(candidate: string | undefined): boolean {
  if (!candidate) return false;
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(candidate); }
  catch { return import.meta.url === pathToFileURL(candidate).href; }
}

if (isEntrypoint(entrypoint)) {
  main().catch((error: unknown) => {
    process.stderr.write(`stacks: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
