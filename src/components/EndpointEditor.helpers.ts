/** Format a JSON body string; if invalid JSON, return the text unchanged. */
export const ensureJsonPretty = (body: string): string => {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return body;
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
};