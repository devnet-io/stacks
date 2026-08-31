import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { createLocalStacksApplication, type StacksApplication, type StackReference } from "../application/stacks-application.ts";
import type { HostedMcpConfiguration } from "../application/integrations.ts";
import type { PlatformDirectories } from "../core/catalog.ts";
import { STACKS_VERSION } from "../version.ts";
import type { CapabilityRequestStatus } from "../core/types.ts";

export interface LocalApiOptions {
  root?: string;
  host?: string;
  port?: number;
  hostedMcp?: HostedMcpConfiguration;
  catalogDirectories?: PlatformDirectories;
  staticRoot?: string;
  application?: StacksApplication;
  runtimeControl?: { token: string; onShutdownRequested(): void };
}

export interface LocalApiHandle {
  server: Server;
  origin: string;
  close(): Promise<void>;
}

function localWebOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return undefined;
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function headers(response: ServerResponse, request: IncomingMessage): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const allowedOrigin = localWebOrigin(request.headers.origin);
  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
  }
}

function send(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = status;
  response.end(`${JSON.stringify(body)}\n`);
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 65_536) throw new HttpError(413, "Request body exceeds 64 KiB.");
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
}

function requiredString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${name} must be a non-empty string.`);
  return value.trim();
}

function optionalString(body: Record<string, unknown>, name: string): string | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${name} must be a string.`);
  return value.trim() || undefined;
}

function optionalBoolean(body: Record<string, unknown>, name: string): boolean | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new HttpError(400, `${name} must be boolean.`);
  return value;
}

function optionalNumber(body: Record<string, unknown>, name: string): number | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new HttpError(400, `${name} must be a finite number.`);
  return value;
}

function optionalStringArray(body: Record<string, unknown>, name: string): string[] | undefined {
  const value = body[name];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new HttpError(400, `${name} must be an array of non-empty strings.`);
  return value.map((item) => String(item).trim());
}

function optionalStrength(body: Record<string, unknown>, name: string): "required" | "preferred" | "reference" | undefined {
  const value = optionalString(body, name);
  if (value === undefined) return undefined;
  if (value !== "required" && value !== "preferred" && value !== "reference") throw new HttpError(400, `${name} must be required, preferred, or reference.`);
  return value;
}

function applicationErrorStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  const message = error instanceof Error ? error.message : String(error);
  if (/already exists|already registered|or identity .* is already|cannot transition/u.test(message)) return 409;
  if (/^Unknown /u.test(message)) return 404;
  if (/must |Missing |does not exist|selector|belongs to/u.test(message)) return 400;
  return 500;
}

function transitionStatus(body: Record<string, unknown>): Exclude<CapabilityRequestStatus, "requested"> {
  const value = requiredString(body, "status") as CapabilityRequestStatus;
  if (!["in-progress", "provider-complete", "consumer-verified", "rejected", "superseded"].includes(value)) {
    throw new HttpError(400, "status must be in-progress, provider-complete, consumer-verified, rejected, or superseded.");
  }
  return value as Exclude<CapabilityRequestStatus, "requested">;
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".map": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2",
};

async function sendStatic(response: ServerResponse, staticRoot: string, pathname: string): Promise<boolean> {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  const root = path.resolve(staticRoot);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  let candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return false;
  try {
    const body = await readFile(candidate);
    response.setHeader("Content-Type", contentTypes[path.extname(candidate).toLowerCase()] ?? "application/octet-stream");
    response.setHeader("Cache-Control", candidate.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
    response.statusCode = 200;
    response.end(body);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "EISDIR") throw error;
  }
  if (path.extname(relative)) return false;
  candidate = path.join(root, "index.html");
  const body = await readFile(candidate);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache");
  response.statusCode = 200;
  response.end(body);
  return true;
}

export async function startLocalApi(options: LocalApiOptions): Promise<LocalApiHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3210;
  const application = options.application ?? createLocalStacksApplication({
    ...(options.catalogDirectories === undefined ? {} : { catalogDirectories: options.catalogDirectories }),
    ...(options.hostedMcp === undefined ? {} : { hostedMcp: options.hostedMcp }),
  });
  const server = createServer(async (request, response) => {
    headers(response, request);
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.statusCode = 204;
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://${host}`);
    try {
      if (request.method === "POST" || request.method === "PUT") {
        if (request.headers.origin && !localWebOrigin(request.headers.origin)) throw new HttpError(403, "Mutation origin is not allowed.");
        if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Mutations require application/json.");
      }
      if (request.method === "POST" && url.pathname === "/api/v0.1/runtime/shutdown") {
        if (!options.runtimeControl) throw new HttpError(404, "Runtime control is unavailable.");
        if (request.headers["x-stacks-runtime-token"] !== options.runtimeControl.token) throw new HttpError(403, "Runtime control token is invalid.");
        await readJsonBody(request);
        send(response, 202, { schemaVersion: "0.1", status: "stopping" });
        setImmediate(options.runtimeControl.onShutdownRequested);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v0.1/stacks") {
        if (options.root) throw new HttpError(409, "Stack management is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const stack = await application.createStack(requiredString(body, "selector"), { actor: { client: "stacks-web" } });
        send(response, 201, { schemaVersion: "0.1", stack });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v0.1/components") {
        if (options.root) throw new HttpError(409, "Component management is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const output = await application.addComponent({
          stack: requiredString(body, "stack"), id: requiredString(body, "id"), path: requiredString(body, "path"),
          ...(optionalString(body, "git") === undefined ? {} : { git: optionalString(body, "git")! }),
          ...(optionalString(body, "kind") === undefined ? {} : { kind: optionalString(body, "kind")! }),
          ...(optionalString(body, "name") === undefined ? {} : { name: optionalString(body, "name")! }),
          actor: { client: "stacks-web" },
        });
        const componentId = requiredString(body, "id");
        const { id, namespace, name } = output.manifest.metadata;
        send(response, 201, { schemaVersion: "0.1", stack: { id, namespace, name }, component: { id: componentId, path: output.bindings[componentId] }, sync: output.sync });
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/v0.1/component-binding") {
        if (options.root) throw new HttpError(409, "Component management is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const componentId = requiredString(body, "componentId");
        const output = await application.bindComponent(requiredString(body, "stack"), componentId, requiredString(body, "path"), { actor: { client: "stacks-web" } });
        const { id, namespace, name } = output.manifest.metadata;
        send(response, 200, { schemaVersion: "0.1", stack: { id, namespace, name }, component: { id: componentId, path: output.bindings[componentId] }, sync: output.sync });
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/v0.1/capability-provider") {
        if (options.root) throw new HttpError(409, "Component configuration is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const contextPath = optionalString(body, "contextPath");
        const contextStrength = optionalStrength(body, "strength");
        const priority = optionalNumber(body, "priority");
        const output = await application.configureCapabilityExport(requiredString(body, "stack"), requiredString(body, "componentId"), {
          capability: requiredString(body, "capability"),
          ...(optionalString(body, "description") === undefined ? {} : { description: optionalString(body, "description")! }),
          ...(contextPath === undefined ? {} : { context: [{ path: contextPath, ...(contextStrength === undefined ? {} : { strength: contextStrength }), ...(priority === undefined ? {} : { priority }) }] }),
        }, { actor: { client: "stacks-web" } });
        send(response, 200, output as unknown as Record<string, unknown>);
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/v0.1/capability-requirement") {
        if (options.root) throw new HttpError(409, "Component configuration is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const output = await application.configureCapabilityRequirement(requiredString(body, "stack"), requiredString(body, "componentId"), {
          capability: requiredString(body, "capability"),
          ...(optionalString(body, "from") === undefined ? {} : { from: optionalString(body, "from")! }),
          ...(optionalBoolean(body, "optional") === undefined ? {} : { optional: optionalBoolean(body, "optional")! }),
        }, { actor: { client: "stacks-web" } });
        send(response, 200, output as unknown as Record<string, unknown>);
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/v0.1/component-guidance") {
        if (options.root) throw new HttpError(409, "Component configuration is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const output = await application.configureGuidance(requiredString(body, "stack"), requiredString(body, "componentId"), {
          path: requiredString(body, "path"),
          ...(optionalString(body, "description") === undefined ? {} : { description: optionalString(body, "description")! }),
          ...(optionalStrength(body, "strength") === undefined ? {} : { strength: optionalStrength(body, "strength")! }),
          ...(optionalNumber(body, "priority") === undefined ? {} : { priority: optionalNumber(body, "priority")! }),
          ...(optionalStringArray(body, "appliesTo") === undefined ? {} : { appliesTo: optionalStringArray(body, "appliesTo")! }),
        }, { actor: { client: "stacks-web" } });
        send(response, 200, output as unknown as Record<string, unknown>);
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v0.1/capability-requests") {
        if (options.root) throw new HttpError(409, "Capability requests are unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const output = await application.createCapabilityRequest({ stack: requiredString(body, "stack") }, {
          requesterComponentId: requiredString(body, "requesterComponentId"),
          providerComponentId: requiredString(body, "providerComponentId"),
          sessionId: requiredString(body, "sessionId"),
          capability: requiredString(body, "capability"),
          reason: requiredString(body, "reason"),
          ...(optionalString(body, "acceptance") === undefined ? {} : { acceptance: optionalString(body, "acceptance")! }),
          actor: { client: "stacks-web" },
        });
        send(response, 201, output as unknown as Record<string, unknown>);
        return;
      }
      if (request.method === "PUT" && url.pathname === "/api/v0.1/capability-request") {
        if (options.root) throw new HttpError(409, "Capability requests are unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const output = await application.transitionCapabilityRequest({ stack: requiredString(body, "stack") }, {
          requestId: requiredString(body, "requestId"), componentId: requiredString(body, "componentId"),
          status: transitionStatus(body), summary: requiredString(body, "summary"),
          ...(optionalString(body, "evidence") === undefined ? {} : { evidence: optionalString(body, "evidence")! }),
          actor: { client: "stacks-web" },
        });
        send(response, 200, output as unknown as Record<string, unknown>);
        return;
      }
      if (request.method !== "GET") {
        send(response, 405, { schemaVersion: "0.1", error: "Method not allowed." });
        return;
      }
      if (url.pathname === "/api/v0.1/stacks") {
        const registered = options.root
          ? [(await application.getStack({ root: options.root })).manifest.metadata]
          : await application.listStacks();
        send(response, 200, { schemaVersion: "0.1", stacks: registered.map(({ id, namespace, name }) => ({ id, namespace, name })) });
        return;
      }
      if (url.pathname === "/api/v0.1/components") {
        if (options.root) throw new HttpError(409, "Component management is unavailable in legacy --root mode.");
        const stack = url.searchParams.get("stack");
        if (!stack) throw new HttpError(400, "stack must be a non-empty string.");
        send(response, 200, await application.listComponents(stack) as unknown as Record<string, unknown>);
        return;
      }
      const selected = async (): Promise<StackReference> => {
        if (options.root) return { root: options.root };
        const requested = url.searchParams.get("stack");
        const first = requested ?? (await application.listStacks())[0]?.id;
        if (!first) throw new Error("No registered Stacks. Create one with: stacks stack create namespace/name");
        return { stack: first };
      };
      if (url.pathname === "/api/v0.1/overview") {
        send(response, 200, await application.getOverview(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/activity") {
        send(response, 200, await application.getActivity(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/activity/work") {
        const sessionId = url.searchParams.get("session");
        if (!sessionId) throw new HttpError(400, "session must be a non-empty string.");
        send(response, 200, await application.getActivityWork(await selected(), sessionId) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/activity/turn") {
        const sessionId = url.searchParams.get("session");
        const turnId = url.searchParams.get("turn");
        if (!sessionId) throw new HttpError(400, "session must be a non-empty string.");
        if (!turnId) throw new HttpError(400, "turn must be a non-empty string.");
        send(response, 200, await application.getActivityTurn(await selected(), sessionId, turnId) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/capability-requests") {
        send(response, 200, await application.listCapabilityRequests(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/capability-request") {
        const requestId = url.searchParams.get("request");
        if (!requestId) throw new HttpError(400, "request must be a non-empty string.");
        send(response, 200, await application.getCapabilityRequest(await selected(), requestId) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/integrations") {
        send(response, 200, await application.getIntegrations(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/graph") {
        send(response, 200, await application.getGraph(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/health") {
        send(response, 200, { schemaVersion: "0.1", status: "ok", version: STACKS_VERSION });
        return;
      }
      if (!url.pathname.startsWith("/api/") && options.staticRoot && await sendStatic(response, options.staticRoot, url.pathname)) return;
      send(response, 404, { schemaVersion: "0.1", error: "Not found." });
    } catch (error) {
      send(response, applicationErrorStatus(error), {
        schemaVersion: "0.1",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local API did not expose a TCP address.");
  const origin = `http://${host}:${address.port}`;
  return {
    server,
    origin,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
