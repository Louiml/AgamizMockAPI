import type { KeyValue, MockRoute, RequestLog } from "../types/mock";

/** Pretty-print JSON; fall back to original text when invalid. */
export const prettyPrint = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/** Very cheap JSON validity probe used for inline lint hints. */
export const isValidJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

export const statusColorClass = (status: number): string => {
  if (status >= 500) return "text-rose-400";
  if (status >= 400) return "text-amber-400";
  if (status >= 300) return "text-violet-400";
  if (status >= 200) return "text-emerald-400";
  return "text-gray-400";
};

export const methodColorClass = (method: string): string => {
  switch (method) {
    case "GET":
      return "text-emerald-400";
    case "POST":
      return "text-sky-400";
    case "PUT":
      return "text-amber-400";
    case "PATCH":
      return "text-violet-400";
    case "DELETE":
      return "text-rose-400";
    default:
      return "text-gray-400";
  }
};

const pad = (n: number, len = 3): string => n.toString().padStart(len, " ");

/** Single terminal-style log line. */
export const formatLogLine = (log: RequestLog): string => {
  const time = (log.timestamp ?? "").slice(11, 23);
  const path = log.path.length > 46 ? `${log.path.slice(0, 45)}…` : log.path;
  return `[${time}] ${log.method.padEnd(6)} ${path} ${" ".repeat(Math.max(0, 40 - path.length)).replace(/ /g, ".")} ${pad(
    log.status
  )} ${pad(log.latencyMs, 4)}ms`;
};

/** One-click copyable curl command for a captured request. */
export const toCurl = (log: RequestLog, port: number): string => {
  const lines: string[] = ["curl", "-X", log.method];
  for (const [k, v] of Object.entries(log.requestHeaders ?? {})) {
    if (k.toLowerCase() === "host") continue;
    lines.push(`-H '${k}: ${v}'`);
  }
  if (log.requestBody && log.requestBody.trim() !== "") {
    lines.push(`-d '${log.requestBody.replace(/'/g, "\\'")}'`);
  }
  return [
    ...lines,
    `http://localhost:${port}${log.path}`,
  ].join(" ");
};

export const routeUrl = (route: MockRoute, port: number, ws: boolean): string =>
  `${ws ? "ws" : "http"}://localhost:${port}${route.path}`;

export const headersToRecord = (headers: KeyValue[]): Record<string, string> =>
  Object.fromEntries(
    headers
      .filter((h) => h.key.trim() !== "")
      .map((h) => [h.key.trim(), h.value.trim()])
  );