import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  MockRoute,
  RequestLog,
  ServerStatus,
} from "../types/mock";

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Thin IPC bridge over the Rust engine.
 * In a plain-browser context (vite dev / mock preview) it falls back to an
 * in-memory simulation so the full UI remains testable with zero backend.
 */
export const bridge = {
  startServer(port: number, routes: MockRoute[], host: string): Promise<ServerStatus> {
    if (isTauri()) return invoke<ServerStatus>("mock_start_server", { port, host, routes });
    return browserStart(port, routes, host);
  },

  stopServer(): Promise<ServerStatus> {
    if (isTauri()) return invoke<ServerStatus>("mock_stop_server");
    return browserStop();
  },

  serverStatus(): Promise<ServerStatus> {
    if (isTauri()) return invoke<ServerStatus>("mock_server_status");
    return Promise.resolve(browserStatus());
  },

  updateRoutes(routes: MockRoute[]): Promise<void> {
    if (isTauri()) return invoke<void>("mock_update_routes", { routes });
    return Promise.resolve();
  },

  checkPort(port: number, host = "0.0.0.0"): Promise<boolean> {
    if (isTauri()) return invoke<boolean>("mock_check_port", { port, host });
    return Promise.resolve(true);
  },

  getLogs(): Promise<RequestLog[]> {
    if (isTauri()) return invoke<RequestLog[]>("mock_get_logs");
    return Promise.resolve([...browserLogs]);
  },

  clearLogs(): Promise<void> {
    if (isTauri()) return invoke<void>("mock_clear_logs");
    browserLogs.length = 0;
    return Promise.resolve();
  },

  onRequestLog(cb: (log: RequestLog) => void): Promise<UnlistenFn> {
    if (isTauri()) return listen<RequestLog>("mock://request", ({ payload }) => cb(payload));
    const listener = ((evt: MessageEvent<RequestLog>) => cb(evt.data)) as EventListener;
    window.addEventListener("mock-demolog", listener);
    return Promise.resolve(() => window.removeEventListener("mock-demolog", listener));
  },

  onStatusChange(cb: (status: ServerStatus) => void): Promise<UnlistenFn> {
    if (isTauri()) return listen<ServerStatus>("mock://status", ({ payload }) => cb(payload));
    return Promise.resolve(() => stopBrowserSim());
  },
};

/* ------------------------------------------------------------------ */
/* Browser simulation — lets the UI run without the Rust shell.        */
/* ------------------------------------------------------------------ */

let browserPort = 8080;
let browserRunning = false;
let browserBind = "0.0.0.0";
const browserLogs: RequestLog[] = [];
let browserTimer: ReturnType<typeof setInterval> | null = null;

async function browserStart(port: number, routes: MockRoute[], host = "0.0.0.0"): Promise<ServerStatus> {
  browserPort = port;
  browserRunning = true;
  browserBind = host;
  browserLogs.length = 0;
  stopBrowserSim();
  let i = 0;
  const sample = routes.filter((r) => r.enabled && !r.ws.enabled);
  browserTimer = setInterval(() => {
    const route = sample[i % Math.max(sample.length, 1)];
    i += 1;
    if (!route) return;
    const log: RequestLog = {
      id: `b-${Date.now()}-${i}`,
      timestamp: new Date().toISOString(),
      method: route.method,
      path: route.path,
      status: route.statusCode,
      latencyMs: Math.round(Math.random() * 120),
      ip: "127.0.0.1",
      requestHeaders: { "user-agent": "curl/7.88 (mock)" },
      requestBody: "",
      responseBody: route.body,
      matchedRouteId: route.id,
      error: null,
    };
    browserLogs.push(log);
    if (browserLogs.length > 500) browserLogs.shift();
    window.dispatchEvent(new MessageEvent("mock-demolog", { data: log }));
  }, 2200);
  return browserStatus();
}

function browserStop(): Promise<ServerStatus> {
  browserRunning = false;
  stopBrowserSim();
  return Promise.resolve(browserStatus());
}

function stopBrowserSim(): void {
  if (browserTimer) clearInterval(browserTimer);
  browserTimer = null;
}

function browserStatus(): ServerStatus {
  return {
    running: browserRunning,
    port: browserPort,
    wsUrl: null,
    lanUrls: browserBind === "0.0.0.0" ? [`http://127.0.0.1:${browserPort}`] : [],
    bind: browserBind,
  };
}

declare global {
  interface Window {
    addEventListener(
      type: "mock-demolog",
      listener: (this: Window, ev: MessageEvent<RequestLog>) => void
    ): void;
  }
}