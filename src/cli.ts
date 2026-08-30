#!/usr/bin/env node
import process from "node:process";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createLocalStacksApplication, type StackReference } from "./application/stacks-application.ts";
import type { CostKind, EventActor, UsageData } from "./core/types.ts";
import { STACKS_VERSION } from "./version.ts";

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
    component: `View components or attach them to registered Stacks. Paths are always explicit. Kind is optional and defaults to component.\n\n  stacks component list <namespace/name> [--json]\n  stacks component get <namespace/name> <id> [--json]\n  stacks component add <namespace/name> <id> --path <dir> [--git <url>] [--kind <kind>] [--name <name>] [--json]\n  stacks component bind <namespace/name> <id> --path <dir> [--json]\n`,
    locate: `Find every Stack component whose explicit binding contains a directory. Multiple matches are returned instead of guessing.\n\n  stacks locate [directory] [--json]\n`,
    status: `Inspect registered Stack component paths and Git state without changing repositories. With no selector, inspect every registered Stack. Loading a Stack also validates its definition.\n\n  stacks status [--stack <namespace/name> | --root <legacy-directory>] [--json]\n`,
    sync: `Clone missing Git components to their explicit paths. Add --update to fetch existing repositories; Stacks never resets, cleans, merges, or rebases.\n\n  stacks sync --stack <namespace/name> [--dry-run] [--update] [--json]\n`,
    context: `Resolve bounded, provenance-rich context for one target component.\n\n  stacks context <target> --stack <namespace/name> [--task <text>] [--json]\n`,
    ui: `Open the machine-level Stacks UI. It serves the UI and API together on port 3210, automatically choosing the next free port when needed.\n\n  stacks ui [--port <number>] [--no-open]\n`,
    mcp: `Run the machine-level MCP adapter over stdio. Agent clients start this command when needed; do not run it as a daemon.\n\n  stacks mcp\n`,
    checkin: `Append agent work lifecycle events.\n\n  stacks checkin start --stack <namespace/name> --component <id> --summary <text> [--work <id>] [actor options] [--json]\n  stacks checkin turn --stack <namespace/name> --session <id> --summary <text> [--status <status>] [--files <a,b>] [--next <text>] [--json]\n  stacks checkin complete --stack <namespace/name> --session <id> --summary <text> [--outcome <outcome>] [--remaining <a,b>] [--json]\n`,
    usage: `Append usage data or report recorded usage. Monetary values require reported, estimated, or allocated provenance.\n\n  stacks usage record --stack <namespace/name> --session <id> --provider <name> --model <name> [token/cost options] [--json]\n  stacks usage report --stack <namespace/name> [--json]\n`,
    commands: `All commands\n\n  stack create|list                  Create or list catalog definitions\n  component list|get|add|bind        View or attach components and paths\n  locate                             Find Stack membership for a directory\n  status                             Inspect component and Git state\n  context                            Resolve bounded context for a target\n  sync                               Clone or fetch Git components safely\n  ui                                 Open the local management UI\n  mcp                                Run the stdio MCP adapter\n  checkin start|turn|complete        Append work lifecycle events\n  usage record|report                Record and report usage\n  lock                               Write a revision snapshot\n  init                               Create a legacy directory manifest\n  validate                           Validate a standalone or legacy definition\n  doctor                             Troubleshoot runtime and adapter installation\n\nRun stacks help <command> for usage. Directory-based --root forms remain available for legacy manifests.\n`,
    lock: `Write stack.lock.json with the current component revisions.\n\n  stacks lock --stack <namespace/name> [--json]\n`,
    init: `Create a legacy directory-based Stack manifest. New Stacks should normally use stacks stack create.\n\n  stacks init --namespace <namespace> --name <name> [--root <dir>] [--json]\n`,
    validate: `Validate a standalone or legacy Stack definition. Registered Stacks are validated whenever they are loaded, including by stacks status.\n\n  stacks validate [--stack <namespace/name> | --root <dir>] [--json]\n`,
    doctor: `Troubleshoot the installed CLI, runtime, component bindings, and MCP setup. This is not required during normal use; use stacks status for Stack health.\n\n  stacks doctor --stack <namespace/name> [--json]\n`,
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
  if (operation === "turn") {
    const status = stringOption(parsed, "status") as "progress" | "blocked" | "failed" | "complete" | undefined;
    if (status && !["progress", "blocked", "failed", "complete"].includes(status)) throw new Error("Invalid --status.");
    const changedPaths = listOption(parsed, "files");
    const nextStep = stringOption(parsed, "next");
    const event = await application.completeTurn(reference, {
      sessionId: requiredOption(parsed, "session"),
      summary: requiredOption(parsed, "summary"),
      ...(status === undefined ? {} : { status }),
      ...(changedPaths === undefined ? {} : { changedPaths }),
      ...(nextStep === undefined ? {} : { nextStep }),
    });
    if (booleanOption(parsed, "json")) printJson(event);
    else process.stdout.write(`Recorded turn ${event.id} for session ${event.sessionId}\n`);
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
  throw new Error("Usage: stacks checkin start|turn|complete ...");
}

async function commandUsage(parsed: ParsedArgs): Promise<void> {
  const operation = parsed.positionals[1];
  const reference = stackReference(parsed);
  if (operation === "record") {
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
    if (usage.amount !== undefined && usage.costKind === undefined) {
      throw new Error("--cost-kind is required whenever --amount is supplied.");
    }

    const componentId = stringOption(parsed, "component");
    const workId = stringOption(parsed, "work");
    const actor = actorFrom(parsed);
    const event = await application.recordUsage(reference, {
      sessionId: requiredOption(parsed, "session"),
      ...(componentId === undefined ? {} : { componentId }),
      ...(workId === undefined ? {} : { workId }),
      ...(actor === undefined ? {} : { actor }),
      usage,
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
  throw new Error("Usage: stacks usage record|report ...");
}

async function commandMcp(parsed: ParsedArgs): Promise<void> {
  const module = await import("./mcp/server.ts");
  module.startMcpServer();
}

async function commandDoctor(parsed: ParsedArgs): Promise<void> {
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
    const identity = await application.createStack(selector);
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
  if (!selector || !operation) throw new Error("Usage: stacks component list|get|add|bind <namespace/name> ...");
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
  if (!id) throw new Error("Usage: stacks component add|bind <namespace/name> <id> --path <dir> ...");
  const localPath = requiredOption(parsed, "path");
  if (operation === "bind") {
    const changed = await application.bindComponent(selector, id, localPath);
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
