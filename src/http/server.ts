import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { createLocalStacksApplication, type StacksApplication, type StackReference } from "../application/stacks-application.ts";
import type { HostedMcpConfiguration } from "../application/integrations.ts";
import type { PlatformDirectories } from "../core/catalog.ts";

export interface LocalApiOptions {
  root?: string;
  host?: string;
  port?: number;
  hostedMcp?: HostedMcpConfiguration;
  catalogDirectories?: PlatformDirectories;
  staticRoot?: string;
  application?: StacksApplication;
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

function applicationErrorStatus(error: unknown): number {
  if (error instanceof HttpError) return error.status;
  const message = error instanceof Error ? error.message : String(error);
  if (/already exists|already registered|or identity .* is already/u.test(message)) return 409;
  if (/^Unknown /u.test(message)) return 404;
  if (/must |Missing |does not exist|selector/u.test(message)) return 400;
  return 500;
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
      if (request.method === "POST" && url.pathname === "/api/v0.1/stacks") {
        if (options.root) throw new HttpError(409, "Stack management is unavailable in legacy --root mode.");
        const body = await readJsonBody(request);
        const stack = await application.createStack(requiredString(body, "selector"));
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
        const output = await application.bindComponent(requiredString(body, "stack"), componentId, requiredString(body, "path"));
        const { id, namespace, name } = output.manifest.metadata;
        send(response, 200, { schemaVersion: "0.1", stack: { id, namespace, name }, component: { id: componentId, path: output.bindings[componentId] }, sync: output.sync });
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
      if (url.pathname === "/api/v0.1/integrations") {
        send(response, 200, await application.getIntegrations(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/graph") {
        send(response, 200, await application.getGraph(await selected()) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/health") {
        send(response, 200, { schemaVersion: "0.1", status: "ok" });
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
