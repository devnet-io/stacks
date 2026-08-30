#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import { initOutput, lockOutput, statusOutput, syncOutput, validateOutput } from "./application/contracts.ts";
import { buildUsageReport } from "./core/usage.ts";
import { completeTurn, completeWork, recordUsage, startWork } from "./core/events.ts";
import { initializeStack } from "./core/init.ts";
import { resolveContext } from "./core/context.ts";
import { syncComponent } from "./core/git.ts";
import { inspectManifest, loadStack } from "./core/manifest.ts";
import { writeLockSnapshot } from "./core/lock.ts";
import { getComponentStatuses } from "./core/status.ts";
import type { CostKind, EventActor, SyncResult, UsageData } from "./core/types.ts";

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

function help(): void {
  process.stdout.write(`Stacks - portable composition, context, and agent activity for local development\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  stacks init --namespace <namespace> --name <name> [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks validate [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks status [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks sync [--root <dir>] [--dry-run] [--update] [--json]\n`);
  process.stdout.write(`  stacks lock [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks context <target> [--task <text>] [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks checkin start --component <id> --summary <text> [--work <id>] [--agent <name>] [--client <name>] [--model <name>] [--json]\n`);
  process.stdout.write(`  stacks checkin turn --session <id> --summary <text> [--status <status>] [--files <a,b>] [--next <text>] [--json]\n`);
  process.stdout.write(`  stacks checkin complete --session <id> --summary <text> [--outcome <outcome>] [--remaining <a,b>] [--json]\n`);
  process.stdout.write(`  stacks usage record --session <id> --provider <name> --model <name> [token/cost options] [--json]\n`);
  process.stdout.write(`  stacks usage report [--root <dir>] [--json]\n`);
  process.stdout.write(`  stacks ui [--root <dir>] [--port <number>] [--api-port <number>] [--api-only]\n`);
  process.stdout.write(`  stacks mcp [--root <dir>]\n`);
}

function portOption(parsed: ParsedArgs, name: string, fallback: number): number {
  const value = numericOption(parsed, name) ?? fallback;
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error(`--${name} must be an integer from 0 to 65535.`);
  return value;
}

async function commandInit(parsed: ParsedArgs): Promise<void> {
  const manifestPath = await initializeStack(rootOption(parsed), requiredOption(parsed, "namespace"), requiredOption(parsed, "name"));
  if (booleanOption(parsed, "json")) printJson(initOutput(await loadStack(manifestPath)));
  else process.stdout.write(`Created ${manifestPath}\n`);
}

async function commandValidate(parsed: ParsedArgs): Promise<void> {
  const result = await inspectManifest(rootOption(parsed));
  if (booleanOption(parsed, "json")) printJson(validateOutput(result));
  else if (result.valid) process.stdout.write(`Valid Stack manifest: ${result.manifestPath}\n`);
  else process.stdout.write(`Invalid Stack manifest: ${result.manifestPath}\n- ${result.errors.join("\n- ")}\n`);
  if (!result.valid) process.exitCode = 2;
}

async function commandStatus(parsed: ParsedArgs): Promise<void> {
  const stack = await loadStack(rootOption(parsed));
  const statuses = getComponentStatuses(stack);
  if (booleanOption(parsed, "json")) {
    printJson(statusOutput(stack, statuses));
    return;
  }
  process.stdout.write(`Stack: ${stack.manifest.metadata.namespace}/${stack.manifest.metadata.name}\n`);
  for (const status of statuses) {
    const state = !status.exists ? "missing" : status.issues.length > 0 ? "issue" : status.git?.dirty ? "dirty" : "ready";
    const revision = status.git?.commit ? ` ${status.git.commit.slice(0, 12)}` : "";
    process.stdout.write(`- ${status.id}: ${state}${revision} (${status.root})\n`);
    for (const issue of status.issues) process.stdout.write(`    ! ${issue}\n`);
  }
}

async function commandSync(parsed: ParsedArgs): Promise<void> {
  const stack = await loadStack(rootOption(parsed));
  const results: SyncResult[] = [];
  for (const component of stack.manifest.components) {
    results.push(await syncComponent(stack, component, {
      dryRun: booleanOption(parsed, "dry-run"),
      update: booleanOption(parsed, "update"),
    }));
  }
  if (booleanOption(parsed, "json")) printJson(syncOutput(stack, results));
  else for (const result of results) process.stdout.write(`- ${result.componentId}: ${result.action} - ${result.message}\n`);
  if (results.some((result) => result.action === "error")) process.exitCode = 2;
}

async function commandLock(parsed: ParsedArgs): Promise<void> {
  const stack = await loadStack(rootOption(parsed));
  const lockPath = await writeLockSnapshot(stack);
  if (booleanOption(parsed, "json")) printJson(lockOutput(stack, lockPath));
  else process.stdout.write(`Wrote ${lockPath}\n`);
}

async function commandContext(parsed: ParsedArgs): Promise<void> {
  const target = parsed.positionals[1];
  if (!target) throw new Error("Usage: stacks context <target-component>.");
  const stack = await loadStack(rootOption(parsed));
  const plan = resolveContext(stack, target, stringOption(parsed, "task"));
  if (booleanOption(parsed, "json")) {
    printJson(plan);
  } else {
    process.stdout.write(`Context for ${target} in ${stack.manifest.metadata.namespace}/${stack.manifest.metadata.name}\n`);
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
  const stack = await loadStack(rootOption(parsed));
  if (operation === "start") {
    const workId = stringOption(parsed, "work");
    const actor = actorFrom(parsed);
    const event = await startWork(stack, {
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
    const event = await completeTurn(stack, {
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
    const event = await completeWork(stack, {
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
  const stack = await loadStack(rootOption(parsed));
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
    const event = await recordUsage(stack, {
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
    const report = await buildUsageReport(stack);
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
  module.startMcpServer(rootOption(parsed));
}

async function commandUi(parsed: ParsedArgs): Promise<void> {
  const module = await import("./ui/launcher.ts");
  await module.launchLocalUi({
    root: rootOption(parsed),
    webPort: portOption(parsed, "port", 3000),
    apiPort: portOption(parsed, "api-port", 3210),
    apiOnly: booleanOption(parsed, "api-only"),
  });
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const parsed = parseArguments(args);
  const command = parsed.positionals[0] ?? "help";
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      help();
      return;
    case "init":
      await commandInit(parsed);
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
    case "ui":
      await commandUi(parsed);
      return;
    default:
      throw new Error(`Unknown command: ${command}. Run stacks help.`);
  }
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`stacks: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
