import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  FolderClosed,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMockStore } from "../store/useMockStore";
import type { HttpMethod } from "../types/mock";
import { HTTP_METHOD_COLORS, HTTP_METHODS } from "../types/mock";
import { cn } from "../lib/cn";
import { Button } from "./ui";

export function Sidebar() {
  const routes = useMockStore((s) => s.routes);
  const selectedRouteId = useMockStore((s) => s.selectedRouteId);
  const addRoute = useMockStore((s) => s.addRoute);
  const duplicateRoute = useMockStore((s) => s.duplicateRoute);
  const removeRoute = useMockStore((s) => s.removeRoute);
  const serverState = useMockStore((s) => s.serverState);
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [methodFilter, setMethodFilter] = useState<HttpMethod | "ALL">("ALL");

  const groups = useMemo(() => {
    const map = new Map<string, typeof routes>();
    for (const route of routes) {
      const key = route.group || "Default";
      const list = map.get(key) ?? [];
      list.push(route);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [routes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map(([group, list]) => [
        group,
        list.filter(
          (r) =>
            (q === "" || r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)) &&
            (methodFilter === "ALL" || r.method === methodFilter)
        ),
      ])
      .filter(([, list]) => (list as unknown[]).length > 0) as Array<[string, typeof routes]>;
  }, [groups, query, methodFilter]);

  const count = useMemo(
    () => routes.filter((r) => r.enabled).length,
    [routes]
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-panel/60 backdrop-blur-md">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter endpoints…"
              className="h-8 w-full rounded-md border border-white/10 bg-panel-2/80 pl-7 pr-2 text-xs text-gray-200 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <Button onClick={addRoute} title="New endpoint">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Method filter chips */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMethodFilter("ALL")}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
              methodFilter === "ALL"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 text-gray-500 hover:text-white"
            )}
          >
            All
          </button>
          {HTTP_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-bold",
                HTTP_METHOD_COLORS[m],
                methodFilter !== m && "opacity-40 hover:opacity-80"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-gray-500">No endpoints match.</p>
            <p className="mt-1 text-[10px] text-gray-600">
              Create one with “+” above.
            </p>
          </div>
        )}

        {visible.map(([group, list]) => {
          const isFolded = folded[group];
          return (
            <div key={group} className="mb-1">
              <button
                onClick={() =>
                  setFolded((f) => ({ ...f, [group]: !f[group] }))
                }
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
              >
                {isFolded ? (
                  <FolderClosed className="h-3 w-3" />
                ) : (
                  <FolderOpen className="h-3 w-3" />
                )}
                <span className="flex-1 truncate">{group}</span>
                <span className="font-mono text-gray-600">{list.length}</span>
              </button>

              {!isFolded &&
                list.map((route) => (
                  <RouteRow
                    key={route.id}
                    routeId={route.id}
                    active={route.id === selectedRouteId}
                    onDuplicate={() => duplicateRoute(route.id)}
                    onDelete={() => removeRoute(route.id)}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-gray-500">
        <span>
          <span className="font-mono text-gray-400">{routes.length}</span> routes ·{" "}
          <span className="font-mono text-emerald-400">{count}</span> live
        </span>
        <span className="flex items-center gap-1">
          {serverState === "running" ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          ) : (
            <XCircle className="h-3 w-3 text-gray-600" />
          )}
          engine
        </span>
      </div>
    </aside>
  );
}

function RouteRow({
  routeId,
  active,
  onDuplicate,
  onDelete,
}: {
  routeId: string;
  active: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const route = useMockStore((s) => s.routes.find((r) => r.id === routeId));
  const selectRoute = useMockStore((s) => s.selectRoute);
  const [hover, setHover] = useState(false);
  if (!route) return null;

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md py-1 pl-2 pr-1 transition-colors",
        active
          ? "border border-emerald-500/30 bg-emerald-500/10"
          : "border border-transparent hover:bg-white/5"
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => selectRoute(route.id)}
    >
      <span
        className={cn(
          "flex h-4 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold",
          HTTP_METHOD_COLORS[route.method]
        )}
      >
        {route.method}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[11px] font-medium text-gray-200">
          {route.name}
        </div>
        <div className="truncate font-mono text-[10px] text-gray-500">
          {route.path}
        </div>
      </div>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          route.enabled ? "bg-emerald-400" : "bg-gray-600"
        )}
      />
      {hover && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectRoute(route.id);
              onDuplicate();
            }}
            title="Duplicate"
            className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            className="rounded p-1 text-gray-400 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}