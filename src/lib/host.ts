/**
 * The host shown to the user for a given bind target.
 * - `0.0.0.0`/`::` → first reachable LAN address (falls back to localhost)
 * - loopback variants → `localhost`
 * - anything else (custom IP/domain) → shown verbatim
 */
export const displayHost = (
  bindHost: string,
  port: number,
  lanUrls: string[] = []
): string => {
  const h = bindHost.trim();
  if (!h || h === "0.0.0.0" || h === "::") return lanUrls[0] ?? `localhost:${port}`;
  if (h === "127.0.0.1" || h === "::1" || h.toLowerCase() === "localhost") {
    return `localhost:${port}`;
  }
  return `${h}:${port}`;
};