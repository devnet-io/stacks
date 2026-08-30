import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { loadStack } from "../core/manifest.ts";
import { buildStackOverview } from "../application/overview.ts";

export interface LocalApiOptions {
  root: string;
  host?: string;
  port?: number;
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
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const allowedOrigin = localWebOrigin(request.headers.origin);
  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
  }
}

function send(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.statusCode = status;
  response.end(`${JSON.stringify(body)}\n`);
}

export async function startLocalApi(options: LocalApiOptions): Promise<LocalApiHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3210;
  const server = createServer(async (request, response) => {
    headers(response, request);
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.statusCode = 204;
      response.end();
      return;
    }
    if (request.method !== "GET") {
      send(response, 405, { schemaVersion: "0.1", error: "Method not allowed." });
      return;
    }
    const url = new URL(request.url ?? "/", `http://${host}`);
    try {
      if (url.pathname === "/api/v0.1/overview") {
        const stack = await loadStack(options.root);
        send(response, 200, buildStackOverview(stack) as unknown as Record<string, unknown>);
        return;
      }
      if (url.pathname === "/api/v0.1/health") {
        send(response, 200, { schemaVersion: "0.1", status: "ok" });
        return;
      }
      send(response, 404, { schemaVersion: "0.1", error: "Not found." });
    } catch (error) {
      send(response, 500, {
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
