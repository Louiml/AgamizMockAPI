/** HTTP methods supported by the mock engine. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const HTTP_METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  POST: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  PUT: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  PATCH: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  DELETE: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

/** Common HTTP response statuses offered in the endpoint editor. */
export const RESPONSE_STATUSES: readonly number[] = [
  200, 201, 204, 301, 302, 400, 401, 403, 404, 409, 418, 422, 500, 502, 503,
];

export interface KeyValue {
  id: string;
  key: string;
  value: string;
}

export type ServerState = "stopped" | "starting" | "running" | "error";

export interface ServerStatus {
  running: boolean;
  port: number;
  /** ws:// URL of the first enabled socket route, if any. */
  wsUrl: string | null;
  /** Reachable LAN endpoints, e.g. `http://192.168.1.5:8080`. */
  lanUrls: string[];
  /** Interface/domain the engine bound to, e.g. "0.0.0.0", "127.0.0.1", "localhost", or a custom hostname. */
  bind: string;
  error?: string;
}

/** Quick-select bind targets. Any other hostname/IP/domain is also allowed. */
export const BIND_HOSTS = {
  all: "0.0.0.0",
  loopback: "127.0.0.1",
} as const;

export interface WsConfig {
  enabled: boolean;
  intervalMs: number;
}

export interface MockRoute {
  id: string;
  name: string;
  group: string;
  method: HttpMethod;
  path: string;
  enabled: boolean;
  statusCode: number;
  latencyMs: number;
  headers: KeyValue[];
  /** Raw JSON response body (may contain {{template}} tags). */
  body: string;
  ws: WsConfig;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  ip: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseBody: string;
  matchedRouteId: string | null;
  error: string | null;
}

/** Schema of an exported project file. */
export interface MockProject {
  app: "agamiz-mock-api";
  version: 1;
  name: string;
  port: number;
  routes: MockRoute[];
}

export type ViewPane = "editor" | "traffic";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;