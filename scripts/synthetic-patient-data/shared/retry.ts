/**
 * Retry a network operation up to `attempts` times with exponential backoff.
 * Catches transient `fetch failed` / network errors only — wraps idempotent
 * operations (FHIR GET/SEARCH, idempotent PATCH, idempotent harvest POST).
 *
 * Shared by synthesize-visit.ts, finalize-visit-orders.ts and
 * synth-daily-census.ts (moved here from synthesize-visit.ts, which cannot be
 * imported for its helpers — it runs main() at module load).
 */
/**
 * True for connection-level failures worth retrying (fetch failed / ECONNRESET /
 * ETIMEDOUT) — NOT for 4xx/5xx-style errors that come back via the SDK's typed
 * error path. Single home for the sniff withRetry and the cleanup scripts share.
 */
export function isTransientNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');
}

export async function withRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Only retry transient network failures.
      if (!isTransientNetworkError(err)) {
        throw err;
      }
      if (i === attempts - 1) break;
      const delayMs = 500 * Math.pow(2, i); // 500ms, 1000ms, 2000ms
      console.warn(`  ⚠ ${label}: transient error (attempt ${i + 1}/${attempts}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
