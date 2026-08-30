import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { LoadedStack } from "../core/types.ts";
import { getComponentStatuses } from "../core/status.ts";
import { stackIdentity, type StackIdentity } from "./contracts.ts";

export type DiagnosticStatus = "pass" | "warning" | "fail";

export interface HostedMcpConfiguration {
  url?: string | undefined;
  bearerTokenEnvVar?: string | undefined;
}

export interface StackIntegrations {
  schemaVersion: "0.1";
  stack: StackIdentity & { definitionPath: string };
  cli: {
    packageName: string;
    version: string;
    command: "stacks";
    entrypoint: string;
    mode: "source" | "built";
    developerInstallCommand: "npm run install:local";
    refreshCommand: "npm run install:local";
    watchCommand: "npm run dev:cli";
    doctorCommand: string;
    uiCommand: string;
  };
  mcp: {
    serverName: string;
    local: {
      transport: "stdio";
      authentication: "none";
      command: "stacks";
      args: string[];
      codexAddCommand: string;
      codexToml: string;
      clientRestartRequiredAfterRegistrationOrUpgrade: true;
    };
    hosted: {
      status: "not-configured" | "configured";
      url?: string;
      bearerTokenEnvVar?: string;
    };
    officialCodexDocumentation: string;
  };
  agentInstructions: {
    file: "AGENTS.md";
    installCommand: "stacks agent install --path .";
    checkCommand: "stacks agent check --path .";
    removeCommand: "stacks agent remove --path .";
  };
  checks: Array<{ id: string; label: string; status: DiagnosticStatus; detail: string }>;
}

async function exists(candidate: string): Promise<boolean> {
  try { await access(candidate); return true; } catch { return false; }
}

export async function findStacksPackageRoot(start = path.dirname(fileURLToPath(import.meta.url))): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    if (await exists(path.join(current, "package.json")) && (await exists(path.join(current, "src", "cli.ts")) || await exists(path.join(current, "dist", "cli.js")))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Unable to locate the Stacks package root.");
    current = parent;
  }
}

export function shellQuote(value: string, platform = process.platform): string {
  if (/^[A-Za-z0-9_./:@-]+$/u.test(value)) return value;
  if (platform === "win32") {
    const escaped = value.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\+)$/u, "$1$1");
    return `"${escaped}"`;
  }
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function serverName(stack: LoadedStack): string {
  void stack;
  return "stacks";
}

function validHostedConfig(config: HostedMcpConfiguration): HostedMcpConfiguration {
  const result: HostedMcpConfiguration = {};
  if (config.url) {
    const url = new URL(config.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("STACKS_HOSTED_MCP_URL must use http or https.");
    result.url = url.toString();
  }
  if (config.bearerTokenEnvVar) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(config.bearerTokenEnvVar)) throw new Error("STACKS_HOSTED_MCP_TOKEN_ENV_VAR must name a valid environment variable.");
    result.bearerTokenEnvVar = config.bearerTokenEnvVar;
  }
  return result;
}

export async function buildStackIntegrations(stack: LoadedStack, hostedConfig: HostedMcpConfiguration = {}): Promise<StackIntegrations> {
  const packageRoot = await findStacksPackageRoot();
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")) as { name: string; version: string };
  const entrypoint = path.resolve(process.argv[1] ?? path.join(packageRoot, "src", "cli.ts"));
  const root = path.resolve(stack.root);
  const name = serverName(stack);
  const args = ["mcp"];
  const codexAddCommand = ["codex", "mcp", "add", name, "--", "stacks", ...args].map((value) => shellQuote(value)).join(" ");
  const codexToml = `[mcp_servers.${tomlString(name)}]\ncommand = "stacks"\nargs = [${args.map(tomlString).join(", ")}]`;
  const definitionExists = await exists(stack.manifestPath);
  const statuses = getComponentStatuses(stack);
  const problemComponents = statuses.filter((status) => !status.exists || status.issues.length > 0);
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const hosted = validHostedConfig(hostedConfig);
  const hostedConfigured = Boolean(hosted.url);

  return {
    schemaVersion: "0.1",
    stack: { ...stackIdentity(stack.manifest), definitionPath: stack.manifestPath },
    cli: {
      packageName: packageJson.name,
      version: packageJson.version,
      command: "stacks",
      entrypoint,
      mode: entrypoint.includes(`${path.sep}src${path.sep}`) ? "source" : "built",
      developerInstallCommand: "npm run install:local",
      refreshCommand: "npm run install:local",
      watchCommand: "npm run dev:cli",
      doctorCommand: stack.registered ? `stacks doctor --stack ${shellQuote(`${stack.manifest.metadata.namespace}/${stack.manifest.metadata.name}`)}` : `stacks doctor --root ${shellQuote(root)}`,
      uiCommand: "stacks ui",
    },
    mcp: {
      serverName: name,
      local: { transport: "stdio", authentication: "none", command: "stacks", args, codexAddCommand, codexToml, clientRestartRequiredAfterRegistrationOrUpgrade: true },
      hosted: {
        status: hostedConfigured ? "configured" : "not-configured",
        ...(hosted.url === undefined ? {} : { url: hosted.url }),
        ...(hosted.bearerTokenEnvVar === undefined ? {} : { bearerTokenEnvVar: hosted.bearerTokenEnvVar }),
      },
      officialCodexDocumentation: "https://learn.chatgpt.com/docs/extend/mcp",
    },
    agentInstructions: {
      file: "AGENTS.md",
      installCommand: "stacks agent install --path .",
      checkCommand: "stacks agent check --path .",
      removeCommand: "stacks agent remove --path .",
    },
    checks: [
      { id: "runtime", label: "Node.js runtime", status: nodeMajor >= 22 ? "pass" : "fail", detail: `Node.js ${process.versions.node}; Stacks requires 22.6 or newer.` },
      { id: "manifest", label: "Stack definition", status: definitionExists ? "pass" : "fail", detail: definitionExists ? `Valid definition at ${stack.manifestPath}.` : `Definition is missing at ${stack.manifestPath}.` },
      { id: "components", label: "Component roots", status: problemComponents.length === 0 ? "pass" : "warning", detail: problemComponents.length === 0 ? `${statuses.length} component root${statuses.length === 1 ? "" : "s"} ready.` : `${problemComponents.length} component${problemComponents.length === 1 ? "" : "s"} need attention.` },
      { id: "cli", label: "CLI entrypoint", status: await exists(entrypoint) ? "pass" : "fail", detail: entrypoint },
    ],
  };
}
