import { useMemo, useState } from "react";
import {
  Activity,
  Clipboard,
  Check,
  Filter,
  Layers,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useMockStore } from "../store/useMockStore";
import type { RequestLog } from "../types/mock";
import { methodColorClass, statusColorClass, toCurl } from "../lib/format";
import { displayHost } from "../lib/host";
import { CodeEditor } from "./CodeEditor";
import { cn } from "../lib/cn";

export function TrafficInspector() {
  const logs = useMockStore((s) => s.logs);
  const selectedLogId = useMockStore((s) => s.selectedLogId);
  const selectLog = useMockStore((s) => s.selectLog);
  const clearLogs = useMockStore((s) => s.clearLogs);
  const logFilter = useMockStore((s) => s.logFilter);
  const setLogFilter = useMockStore((s) => s.setLogFilter);
  const port = useMockStore((s) => s.port);
  const lanUrls = useMockStore((s) => s.lanUrls);
  const bindHost = useMockStore((s) => s.bindHost);
  const showTraffic = useMockStore((s) => s.showTraffic);
  const toggleTraffic = useMockStore((s) => s.toggleTraffic);
  const [copied, setCopied] = useState<string | null>(null);

  const selected = useMemo(
    () => logs.find((l) => l.id === selectedLogId) ?? null,
    [logs, selectedLogId]
  );

  const filtered = useMemo(() => {
    const q = logFilter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.method.toLowerCase().includes(q) ||
        l.path.toLowerCase().includes(q) ||
        q === l.status.toString()
    );
  }, [logs, logFilter]);

  const copyCurl = async (log: RequestLog) => {
    await navigator.clipboard.writeText(toCurl(log, port));
    setCopied(log.id);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className="terminal-canvas flex h-full min-h-0 flex-col border-t border-emerald-500/10">
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-2 px-3">
        <button
          onClick={toggleTraffic}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hover:text-white"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live Traffic
        </button>

        <div className="mx-2 h-5 w-px bg-white/10" />

        <div className="relative">
          <Filter className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-600" />
          <input
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            placeholder="method, path or status…"
            className="h-7 w-52 rounded-md border border-white/10 bg-panel-2/60 pl-7 pr-2 text-[11px] text-gray-300 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        <div className="flex-1" />

        <span className="font-mono text-[10px] text-gray-600">
          {filtered.length}/{logs.length}
        </span>
        <button
          onClick={() => void clearLogs()}
          className="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-white"
          title="Clear logs"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={toggleTraffic}
          className="rounded p-1 text-gray-500 hover:bg-white/5 hover:text-white"
          title="Minimize"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!showTraffic ? null : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          {/* Log stream */}
          <div className="min-h-0 overflow-y-auto border-r border-white/5">
            <div className="px-2 py-1">
              {filtered.length === 0 && (
                <div className="px-2 py-6 text-center">
                  <Layers className="mx-auto h-6 w-6 text-gray-700" />
                  <p className="mt-2 text-xs text-gray-500">
                    No requests yet.
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gray-700">
                    Hit http://{displayHost(bindHost, port, lanUrls)} while the engine
                    runs.{lanUrls[0] && bindHost !== "127.0.0.1"
                      ? ` — or from any device on this network: ${lanUrls[0]}.`
                      : ""}
                  </p>
                </div>
              )}
              {filtered.map((log) => (
                <button
                  key={log.id}
                  onClick={() => selectLog(log.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[11px] leading-tight hover:bg-white/5",
                    selectedLogId === log.id && "bg-emerald-500/10"
                  )}
                >
                  <span className="text-gray-600">
                    {log.timestamp.slice(11, 19)}
                  </span>
                  <span className={methodColorClass(log.method)}>
                    {log.method.padEnd(4)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-300">
                    {log.path}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[10px]",
                      statusColorClass(log.status)
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-600">
                    {log.latencyMs}ms
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyCurl(log);
                    }}
                    className="hidden shrink-0 rounded p-0.5 text-gray-500 hover:text-emerald-400 group-hover:block"
                    title="Copy as cURL"
                  >
                    {copied === log.id ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Clipboard className="h-3 w-3" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detail stream */}
          <div className="min-h-0 overflow-y-auto border-l border-white/5">
            {selected ? (
              <LogDetail log={selected} port={port} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Activity className="h-3.5 w-3.5" />
                  Select a request to inspect headers & body
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function LogDetail({ log, port }: { log: RequestLog; port: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(toCurl(log, port));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const rows: Array<[string, string]> = [
    ["Timestamp", log.timestamp],
    ["Client", log.ip || "-"],
    ["Latency", `${log.latencyMs}ms`],
    ["Route", log.matchedRouteId ? `#${log.matchedRouteId.slice(0, 8)}` : "no match"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <span
          className={cn(
            "rounded px-2 py-0.5 font-mono text-[11px] font-bold",
            methodColorClass(log.method)
          )}
        >
          {log.method}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-300">
          {log.path}
        </span>
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            statusColorClass(log.status)
          )}
        >
          {log.status}
        </span>
        <button
          onClick={() => void copy()}
          className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5 hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Clipboard className="h-3 w-3" />
          )}
          curl
        </button>
      </div>

      <div className="shrink-0 border-b border-white/5 px-3 py-1.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <span className="text-gray-600">{k}</span>
              <span className="truncate text-gray-300">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {Object.keys(log.requestHeaders ?? {}).length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Request headers
            </div>
            <div className="space-y-0.5 font-mono text-[11px]">
              {Object.entries(log.requestHeaders).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-amber-200/80">{k}:</span>
                  <span className="truncate text-gray-400">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {log.requestBody && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Request body
            </div>
            <CodeEditor value={log.requestBody} readOnly minHeight="80px" maxHeight="220px" />
          </div>
        )}

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Response body
          </div>
          {log.error ? (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-rose-400">
              <XCircle className="h-3.5 w-3.5" />
              {log.error}
            </p>
          ) : (
            <CodeEditor value={log.responseBody} readOnly minHeight="120px" maxHeight="400px" />
          )}
        </div>
      </div>
    </div>
  );
}