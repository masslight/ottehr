export const MAX_LOGGED_CHARS = 500;

function stringifyForLog(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Renders a value for logging, capped at MAX_LOGGED_CHARS characters.
 *
 * Request bodies and response payloads are the dominant per-invocation log cost, and CloudWatch
 * bills per byte ingested. Serialization failures degrade to a marker rather than throwing, so a
 * log line can never take down a handler.
 */
export function truncateForLog(value: unknown, maxLength: number = MAX_LOGGED_CHARS): string {
  const text = typeof value === 'string' ? value : stringifyForLog(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncated, ${text.length} chars total]` : text;
}
