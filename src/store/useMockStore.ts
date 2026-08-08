import { create } from "zustand";
import type {
  KeyValue,
  MockProject,
  MockRoute,
  RequestLog,
  ServerState,
  ServerStatus,
  ViewPane,
} from "../types/mock";
import { BIND_HOSTS, uid } from "../types/mock";
import { bridge } from "../lib/bridge";

const DEFAULT_BODY = `{
  "success": true,
  "data": {
    "id": "{{random.uuid}}",
    "name": "{{random.name}}",
    "createdAt": "{{timestamp}}"
  },
  "echo": {
    "paramId": "{{req.params.id}}"
  }
}`;

export const makeDefaultRoute = (): MockRoute => ({
  id: uid(),
  name: "New endpoint",
  group: "Default",
  method: "GET",
  path: "/api/v1/users/:id",
  enabled: true,
  statusCode: 200,
  latencyMs: 120,
  headers: [
    { id: uid(), key: "Content-Type", value: "application/json" },
    { id: uid(), key: "X-Mock-Server", value: "Agamiz" },
  ],
  body: DEFAULT_BODY,
  ws: { enabled: false, intervalMs: 1000 },
});

interface MockStore {
  routes: MockRoute[];
  selectedRouteId: string | null;
  serverState: ServerState;
  port: number;
  wsUrl: string | null;
  lanUrls: string[];
  /** IP, hostname, or domain the engine binds to (e.g. "0.0.0.0", "127.0.0.1", "localhost", "api.dev.local"). */
  bindHost: string;
  logs: RequestLog[];
  selectedLogId: string | null;
  pane: ViewPane;
  showTraffic: boolean;
  logFilter: string;
  error: string | null;
  checkingPort: boolean;
  portAvailable: boolean | null;

  selectRoute: (id: string | null) => void;
  addRoute: () => void;
  duplicateRoute: (id: string) => void;
  removeRoute: (id: string) => void;
  updateRoute: (id: string, patch: Partial<MockRoute>) => void;
  updateHeader: (routeId: string, headerId: string, patch: Partial<KeyValue>) => void;
  addHeader: (routeId: string) => void;
  removeHeader: (routeId: string, headerId: string) => void;

  setPort: (port: number) => void;
  setBindHost: (host: string) => void;
  verifyPort: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  toggleServer: () => Promise<void>;
  setServerState: (state: ServerState, status?: ServerStatus) => void;

  selectLog: (id: string | null) => void;
  setLogFilter: (f: string) => void;
  clearLogs: () => Promise<void>;

  setPane: (pane: ViewPane) => void;
  toggleTraffic: () => void;

  importProject: (project: MockProject) => void;
  exportProject: () => MockProject;
}

const syncRoutes = (routes: MockRoute[]): void => {
  void bridge.updateRoutes(routes).catch(() => undefined);
};

export const useMockStore = create<MockStore>((set, get) => ({
  routes: [makeDefaultRoute()],
  selectedRouteId: null,
  serverState: "stopped",
  port: 8080,
  wsUrl: null,
  lanUrls: [],
  bindHost: BIND_HOSTS.all,
  logs: [],
  selectedLogId: null,
  pane: "editor",
  showTraffic: true,
  logFilter: "",
  error: null,
  checkingPort: false,
  portAvailable: null,

  selectRoute: (id) => set({ selectedRouteId: id }),

  addRoute: () => {
    const route = makeDefaultRoute();
    set((s) => ({
      routes: [...s.routes, route],
      selectedRouteId: route.id,
    }));
    syncRoutes(get().routes);
  },

  duplicateRoute: (id) => {
    const src = get().routes.find((r) => r.id === id);
    if (!src) return;
    const copy: MockRoute = { ...src, id: uid(), name: `${src.name} (copy)` };
    set((s) => ({ routes: [...s.routes, copy], selectedRouteId: copy.id }));
    syncRoutes(get().routes);
  },

  removeRoute: (id) => {
    set((s) => {
      const routes = s.routes.filter((r) => r.id !== id);
      return {
        routes,
        selectedRouteId: s.selectedRouteId === id ? null : s.selectedRouteId,
      };
    });
    syncRoutes(get().routes);
  },

  updateRoute: (id, patch) => {
    set((s) => ({
      routes: s.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    syncRoutes(get().routes);
  },

  updateHeader: (routeId, headerId, patch) => {
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId
          ? {
              ...r,
              headers: r.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h)),
            }
          : r
      ),
    }));
    syncRoutes(get().routes);
  },

  addHeader: (routeId) => {
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId
          ? { ...r, headers: [...r.headers, { id: uid(), key: "", value: "" }] }
          : r
      ),
    }));
  },

  removeHeader: (routeId, headerId) => {
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === routeId ? { ...r, headers: r.headers.filter((h) => h.id !== headerId) } : r
      ),
    }));
  },

  setPort: (port) => set({ port }),

  setBindHost: (bindHost) => set({ bindHost }),

  verifyPort: async () => {
    const port = get().port;
    if (port < 1 || port > 65535) {
      set({ portAvailable: false, error: "Port must be between 1 and 65535." });
      return;
    }
    set({ checkingPort: true, error: null });
    const available = await bridge.checkPort(port, get().bindHost);
    set({ checkingPort: false, portAvailable: available });
  },

  startServer: async () => {
    const { port, routes, bindHost } = get();
    set({ serverState: "starting", error: null });
    try {
      const status = await bridge.startServer(port, routes, bindHost);
      set({
        serverState: status.running ? "running" : "error",
        port: status.port,
        wsUrl: status.wsUrl,
        lanUrls: status.lanUrls,
        bindHost: status.bind || get().bindHost,
        error: status.error ?? null,
      });
      const history = await bridge.getLogs();
      set({ logs: history });
    } catch (err) {
      set({ serverState: "error", error: String(err) });
    }
  },

  stopServer: async () => {
    set({ serverState: "starting" });
    try {
      const status = await bridge.stopServer();
      set({ serverState: "stopped", wsUrl: null, error: status.error ?? null });
    } catch (err) {
      set({ serverState: "error", error: String(err) });
    }
  },

  toggleServer: async () => {
    const { serverState } = get();
    if (serverState === "running" || serverState === "starting") {
      await get().stopServer();
    } else {
      await get().startServer();
    }
  },

  setServerState: (state, status) => {
    set((s) => ({
      serverState: state,
      wsUrl: status?.wsUrl ?? s.wsUrl,
      lanUrls: status?.lanUrls ?? s.lanUrls,
      bindHost: status?.bind || s.bindHost,
      error: status?.error ?? null,
    }));
  },

  selectLog: (id) => set({ selectedLogId: id, pane: "traffic" }),

  setLogFilter: (logFilter) => set({ logFilter }),

  clearLogs: async () => {
    await bridge.clearLogs();
    set({ logs: [], selectedLogId: null });
  },

  setPane: (pane) => set({ pane }),

  toggleTraffic: () => set((s) => ({ showTraffic: !s.showTraffic })),

  importProject: (project) => {
    if (!project?.routes?.length) return;
    set({
      routes: project.routes,
      selectedRouteId: project.routes[0]?.id ?? null,
      port: project.port || 8080,
      logs: [],
    });
    syncRoutes(get().routes);
  },

  exportProject: () => {
    const { routes, port } = get();
    return {
      app: "agamiz-mock-api",
      version: 1,
      name: "Agamiz Mock API project",
      port,
      routes,
    };
  },
}));

/** Attach the live IPC listeners once — called from App bootstrap. */
let listenersBound = false;

export const initRealtimeListeners = (): void => {
  if (listenersBound) return;
  listenersBound = true;

  bridge.onRequestLog((log) => {
    useMockStore.setState((s) => ({
      logs: [...s.logs, log].slice(-500),
    }));
  });

  bridge.onStatusChange((status) => {
    useMockStore.getState().setServerState(status.running ? "running" : "stopped", status);
  });
};
