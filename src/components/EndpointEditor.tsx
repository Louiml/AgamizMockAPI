import { useMemo } from "react";
import {
  Braces,
  Info,
  GripVertical,
  Plus,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { useMockStore } from "../store/useMockStore";
import type { HttpMethod } from "../types/mock";
import {
  HTTP_METHODS,
  HTTP_METHOD_COLORS,
  RESPONSE_STATUSES,
} from "../types/mock";
import { ensureJsonPretty } from "./EndpointEditor.helpers";
import { displayHost } from "../lib/host";
import { CodeEditor } from "./CodeEditor";
import { Badge, Button, Panel, SelectField, TextField } from "./ui";
import { cn } from "../lib/cn";

export function EndpointEditor() {
  const route = useMockStore((s) =>
    s.routes.find((r) => r.id === s.selectedRouteId)
  );
  const updateRoute = useMockStore((s) => s.updateRoute);
  const updateHeader = useMockStore((s) => s.updateHeader);
  const addHeader = useMockStore((s) => s.addHeader);
  const removeHeader = useMockStore((s) => s.removeHeader);
  const port = useMockStore((s) => s.port);
  const serverState = useMockStore((s) => s.serverState);
  const lanUrls = useMockStore((s) => s.lanUrls);
  const bindHost = useMockStore((s) => s.bindHost);
  const addRoute = useMockStore((s) => s.addRoute);

  const jsonLint = useMemo(() => {
    if (!route) return { ok: true, message: "" };
    try {
      JSON.parse(route.body || "{}");
      return { ok: true, message: "Valid JSON" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Invalid JSON" };
    }
  }, [route?.body]);

  if (!route) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <Braces className="h-10 w-10 text-gray-700" />
        <p className="text-sm text-gray-400">Select an endpoint from the sidebar</p>
        <p className="text-xs text-gray-600">
          or create a new one to start mocking routes.
        </p>
        <Button onClick={addRoute} className="mt-2">
          <Plus className="h-3.5 w-3.5" />
          New endpoint
        </Button>
      </main>
    );
  }

  const running = serverState === "running";

  return (
    <main className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-3xl animate-fade-slide flex-col gap-4">
        {/* Route identity */}
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={route.method}
              onChange={(e) =>
                updateRoute(route.id, { method: e.target.value as HttpMethod })
              }
              className={cn(
                "h-8 appearance-none rounded-md border px-2 text-xs font-bold focus:outline-none",
                HTTP_METHOD_COLORS[route.method]
              )}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <input
              value={route.path}
              onChange={(e) => updateRoute(route.id, { path: e.target.value })}
              spellCheck={false}
              placeholder="/api/v1/users/:id"
              className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-panel-2/80 px-3 font-mono text-xs text-emerald-300 caret-emerald-400 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <TextField
              label="Display name"
              value={route.name}
              onChange={(e) => updateRoute(route.id, { name: e.target.value })}
            />
            <TextField
              label="Folder / tag"
              value={route.group}
              onChange={(e) => updateRoute(route.id, { group: e.target.value })}
            />
            <label className="flex items-end pb-0.5">
              <button
                onClick={() => updateRoute(route.id, { enabled: !route.enabled })}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center gap-2 rounded-md border text-xs font-medium",
                  route.enabled
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-white/10 bg-white/5 text-gray-500 hover:text-gray-300"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                {route.enabled ? "Enabled" : "Disabled"}
              </button>
            </label>
          </div>

          <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] text-gray-500">
            <span className="truncate">
              {running && route.enabled ? (
                <>
                  →
                  {" "}
                  <span className="text-emerald-400">
                    http://{displayHost(bindHost, port, lanUrls)}
                    {route.path.replace(/:\w+/g, (p) => `<${p.slice(1)}>`)}
                  </span>
                </>
              ) : (
                `Preview: /${route.path.split("/").filter(Boolean).join("/")}`
              )}
            </span>
            <Badge className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              {route.enabled && !running ? "ready" : running ? "mocked" : "off"}
            </Badge>
          </div>
        </Panel>

        {/* Behavior */}
        <Panel className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Behavior
            </h2>
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <SelectField
              label="Response status"
              value={route.statusCode}
              onChange={(e) =>
                updateRoute(route.id, { statusCode: Number(e.target.value) })
              }
            >
              {RESPONSE_STATUSES.map((code) => (
                <option key={code} value={code}>
                  {code} — {statusText(code)}
                </option>
              ))}
            </SelectField>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-gray-500">
                  <Timer className="h-3 w-3" />
                  Simulated latency
                </span>
                <span className="font-mono text-xs text-emerald-400">
                  {route.latencyMs}ms
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={route.latencyMs}
                onChange={(e) =>
                  updateRoute(route.id, { latencyMs: Number(e.target.value) })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-500"
              />
              <div className="mt-1 flex justify-between text-[9px] text-gray-600">
                <span>0ms</span>
                <span>5s</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Response headers */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Response headers
            </h2>
            <Button
              variant="ghost"
              onClick={() => addHeader(route.id)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add header
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {route.headers.length === 0 && (
              <p className="text-xs text-gray-600">
                No custom headers. Content-Type will default to JSON.
              </p>
            )}
            {route.headers.map((header) => (
              <div key={header.id} className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-700" />
                <input
                  value={header.key}
                  onChange={(e) =>
                    updateHeader(route.id, header.id, { key: e.target.value })
                  }
                  placeholder="Header-Name"
                  spellCheck={false}
                  className="h-8 w-52 shrink-0 rounded-md border border-white/10 bg-panel-2/80 px-2.5 font-mono text-xs text-amber-200/90 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
                />
                <span className="text-gray-600">:</span>
                <input
                  value={header.value}
                  onChange={(e) =>
                    updateHeader(route.id, header.id, { value: e.target.value })
                  }
                  placeholder="value"
                  spellCheck={false}
                  className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-panel-2/80 px-2.5 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
                />
                <button
                  onClick={() => removeHeader(route.id, header.id)}
                  className="rounded p-1 text-gray-500 hover:text-rose-400"
                  title="Remove header"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Panel>

        {/* Response body */}
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              <Braces className="h-4 w-4 text-emerald-400" />
              Response body
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateRoute(route.id, { body: ensureJsonPretty(route.body) })
                }
                className="rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5 hover:text-white"
                title="Format JSON"
              >
                Format
              </button>
              <Badge
                className={
                  jsonLint.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }
              >
                {jsonLint.ok ? "JSON ✓" : "JSON ✗"}
              </Badge>
            </div>
          </div>

          <div className="mt-3">
            <CodeEditor
              value={route.body}
              onChange={(v) => updateRoute(route.id, { body: v })}
              minHeight="280px"
              maxHeight="520px"
            />
          </div>

          <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500/70" />
            <span>
              Use template tags inside the body —{" "}
              <code className="rounded bg-white/5 px-1 font-mono text-emerald-300">
                {"{{random.uuid}}"}
              </code>
              {"   "}
              <code className="rounded bg-white/5 px-1 font-mono text-emerald-300">
                {"{{random.name}}"}
              </code>
              {"   "}
              <code className="rounded bg-white/5 px-1 font-mono text-emerald-300">
                {"{{req.params.id}}"}
              </code>
              {"   "}
              <code className="rounded bg-white/5 px-1 font-mono text-emerald-300">
                {"{{timestamp}}"}
              </code>
            </span>
          </div>
        </Panel>

        {/* WebSocket mock (bonus) */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
              <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-400">
                ws
              </Badge>
              WebSocket mock
            </h2>
            <button
              onClick={() =>
                updateRoute(route.id, {
                  ws: { ...route.ws, enabled: !route.ws.enabled },
                })
              }
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                route.ws.enabled ? "bg-emerald-500" : "bg-white/10"
              )}
              title="Toggle WebSocket"
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                  route.ws.enabled ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <SelectField
                label="Push interval"
                value={route.ws.intervalMs}
                onChange={(e) =>
                  updateRoute(route.id, {
                    ws: {
                      ...route.ws,
                      intervalMs: Number(e.target.value),
                    },
                  })
                }
              >
                <option value={500}>500ms</option>
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
              </SelectField>
            </div>
            <div className="flex items-end">
              <p className="text-[11px] leading-relaxed text-gray-500">
                Connects at{" "}
                <code className="rounded bg-white/5 px-1 font-mono text-violet-300">
                  ws://{displayHost(bindHost, port)}
                  {route.path.replace(/\/:/g, "/")}
                </code>{" "}
                and streams the response body on the interval.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function statusText(code: number): string {
  switch (code) {
    case 200:
      return "OK";
    case 201:
      return "Created";
    case 204:
      return "No Content";
    case 301:
      return "Moved Permanently";
    case 302:
      return "Found";
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 418:
      return "I'm a teapot";
    case 422:
      return "Unprocessable Content";
    case 500:
      return "Internal Server Error";
    case 502:
      return "Bad Gateway";
    case 503:
      return "Service Unavailable";
    default:
      return "";
  }
}