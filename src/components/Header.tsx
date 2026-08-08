import { useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  CloudDownload,
  Copy,
  Globe,
  Pause,
  Play,
  Upload,
  Wifi,
} from "lucide-react";
import { useMockStore } from "../store/useMockStore";
import { BIND_HOSTS } from "../types/mock";
import { displayHost } from "../lib/host";
import { cn } from "../lib/cn";
import { Button } from "./ui";

const PORTS = [8080, 3000, 4000, 5000, 8000, 9000];
const QUICK_HOSTS = ["0.0.0.0", "127.0.0.1", "localhost"];

export function Header() {
  const serverState = useMockStore((s) => s.serverState);
  const port = useMockStore((s) => s.port);
  const setPort = useMockStore((s) => s.setPort);
  const setPane = useMockStore((s) => s.setPane);
  const pane = useMockStore((s) => s.pane);
  const startServer = useMockStore((s) => s.startServer);
  const stopServer = useMockStore((s) => s.stopServer);
  const verifyPort = useMockStore((s) => s.verifyPort);
  const checkingPort = useMockStore((s) => s.checkingPort);
  const portAvailable = useMockStore((s) => s.portAvailable);
  const wsUrl = useMockStore((s) => s.wsUrl);
  const lanUrls = useMockStore((s) => s.lanUrls);
  const bindHost = useMockStore((s) => s.bindHost);
  const setBindHost = useMockStore((s) => s.setBindHost);
  const importProject = useMockStore((s) => s.importProject);
  const exportProject = useMockStore((s) => s.exportProject);
  const error = useMockStore((s) => s.error);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = serverState === "running";
  const busy = serverState === "starting";
  const liveUrl = `http://${displayHost(bindHost, port, lanUrls)}`;

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const onStart = async () => {
    await startServer();
    await verifyPort();
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      importProject(JSON.parse(text));
    } catch {
      // invalid project file – ignore silently
    }
    e.target.value = "";
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(exportProject(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agamiz-mocks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-panel/80 px-4 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
          <Activity className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-white">
            Agamiz&nbsp;Mock&nbsp;API
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-500/80">
            Agamiz Apps
          </div>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-white/10" />

      {/* Local engine status */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
          running
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-white/10 bg-white/5 text-gray-400"
        )}
      >
        <span className="relative flex h-2 w-2">
          {running ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-500" />
          )}
        </span>
        <Wifi className="h-3 w-3" />
        <span className="font-mono">
          {running ? (
            <>
              {liveUrl}
              {wsUrl ? (
                <span className="ml-2 text-emerald-400/70">{wsUrl}</span>
              ) : null}
            </>
          ) : (
            "Local engine idle"
          )}
        </span>
      </div>

      {/* Reachable endpoint(s) — LAN IPs or the custom domain the engine bound to */}
      {running && lanUrls.length > 0 && (
        <div className="flex max-w-[240px] items-center gap-1.5 overflow-hidden">
          {lanUrls.slice(0, 2).map((url) => (
            <button
              key={url}
              onClick={() => void copyText(url, url)}
              title={`Copy ${url}`}
              className="group flex min-w-0 items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/5 px-2.5 py-1.5 text-[11px] text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/10"
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate font-mono">{url.replace(/^https?:\/\//, "")}</span>
              {copied === url ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3 shrink-0 text-sky-400/60 group-hover:text-sky-300" />
              )}
            </button>
          ))}
          {lanUrls.length > 2 ? (
            <span className="text-[10px] text-gray-500">+{lanUrls.length - 2}</span>
          ) : null}
        </div>
      )}

      {/* Bind host / domain input */}
      <label className="relative" title="Bind host — IP, hostname, or domain (e.g. 0.0.0.0, 127.0.0.1, api.myapp.dev)">
        <Globe className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-500/70" />
        <input
          list="bind-hosts"
          value={bindHost}
          disabled={busy}
          spellCheck={false}
          onChange={(e) =>
            setBindHost(e.target.value.trim() ? e.target.value : BIND_HOSTS.all)
          }
          onBlur={() => {
            if (!bindHost.trim()) setBindHost(BIND_HOSTS.all);
            void verifyPort();
          }}
          placeholder="0.0.0.0 · localhost · domain"
          className="h-8 w-[160px] rounded-md border border-white/10 bg-panel-2/80 pl-7 pr-2 text-xs font-mono text-emerald-100 focus:border-emerald-500/50 focus:outline-none"
        />
        <datalist id="bind-hosts">
          {QUICK_HOSTS.map((h) => (
            <option key={h} value={h} />
          ))}
          {running &&
            lanUrls.map((u) => {
              const host = u.replace(/^https?:\/\//, "").split(":")[0];
              return <option key={host} value={host} />;
            })}
        </datalist>
      </label>

      {/* Port selector */}

        <label className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-gray-500">
            port
          </span>
          <select
            value={port}
            disabled={busy}
            onChange={(e) => {
              const p = Number(e.target.value);
              setPort(p);
              void verifyPort();
            }}
            className="h-8 w-[92px] appearance-none rounded-md border border-white/10 bg-panel-2/80 pl-9 pr-6 text-xs font-mono text-gray-200 focus:border-emerald-500/50 focus:outline-none"
          >
            {PORTS.includes(port) ? null : (
              <option value={port}>{port}</option>
            )}
            {PORTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
        </label>

      {checkingPort && (
        <span className="text-[10px] text-gray-500">checking…</span>
      )}
      {!busy && portAvailable === false && (
        <span className="text-[10px] text-amber-400">port busy</span>
      )}

      <div className="flex-1" />

      {/* Layout controls */}
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
        <button
          onClick={() => setPane("editor")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            pane === "editor"
              ? "bg-emerald-500/15 text-emerald-300"
              : "text-gray-400 hover:text-white"
          )}
        >
          Endpoints
        </button>
        <button
          onClick={() => setPane("traffic")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            pane === "traffic"
              ? "bg-emerald-500/15 text-emerald-300"
              : "text-gray-400 hover:text-white"
          )}
        >
          Traffic
        </button>
      </div>

      {/* Export / Import */}
      <Button variant="ghost" onClick={onExport} title="Export collection">
        <CloudDownload className="h-3.5 w-3.5" />
        Export
      </Button>
      <Button
        variant="ghost"
        onClick={() => fileRef.current?.click()}
        title="Import collection"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImport}
      />

      {/* Start / Stop */}
      <button
        onClick={() => (running ? void stopServer() : void onStart())}
        disabled={busy}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-all",
          busy && "opacity-60",
          running
            ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            : "border-emerald-500/40 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_0_24px_-6px_rgba(16,185,129,0.7)] hover:shadow-[0_0_32px_-4px_rgba(16,185,129,0.9)]"
        )}
      >
        {running ? (
          <>
            <Pause className="h-4 w-4" />
            Stop engine
          </>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <Play className="h-4 w-4" />
            Start engine
          </>
        )}
      </button>

      {error && (
        <span className="max-w-[220px] truncate text-[10px] text-rose-400">
          {error}
        </span>
      )}
    </header>
  );
}