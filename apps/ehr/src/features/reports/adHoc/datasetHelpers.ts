import { ADHOC_BATCH_DAYS, splitDateRangeIntoBatches } from 'utils';
import { AdHocDatasetOption } from './types';

/** Partial-failure info for a batched range fetch: how many of the date windows failed to load. */
export interface BatchWindowFailures {
  failedWindows: number;
  totalWindows: number;
}

// Keyed by the exact row array `fetchBatchedRange` returned. The datasets hand that array through
// unchanged to the AdHocReport page, so the UI can look up the partial-failure info for the rows it
// holds without the datasets having to thread an extra return value.
const windowFailuresByResult = new WeakMap<object, BatchWindowFailures>();

/**
 * Partial-failure info recorded for a `fetchBatchedRange` result — `undefined` when every window
 * loaded. Call with the row array a dataset `fetch` returned to show a
 * "N of M date windows failed to load" banner.
 */
export const getBatchWindowFailures = (rows: unknown[]): BatchWindowFailures | undefined =>
  windowFailuresByResult.get(rows);

/**
 * Fetch a date range, batching ranges longer than ADHOC_BATCH_DAYS into parallel sub-fetches. A short
 * range is fetched in one call; a long range is split, fetched concurrently, then `combine`d (dedupe or
 * merge — the only step that varies by dataset). Shared by the Encounters/Billing/Patients datasets.
 *
 * A transient failure in one window no longer sinks the whole report: successful windows are kept and
 * the failure count is recorded (readable via `getBatchWindowFailures`). Only when EVERY window fails
 * does this throw.
 */
export async function fetchBatchedRange<T>(
  dateRange: { start: string; end: string },
  fetchRange: (range: { start: string; end: string }) => Promise<T[]>,
  combine: (all: T[]) => T[]
): Promise<T[]> {
  const { start, end } = dateRange;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  // `combine` runs on the single-batch path too — one window can still contain rows that need
  // deduping/merging (e.g. a follow-up encounter row alongside its parent visit's row).
  if (days <= ADHOC_BATCH_DAYS) return combine(await fetchRange({ start, end }));
  const batches = splitDateRangeIntoBatches(start, end, ADHOC_BATCH_DAYS);
  const settled = await Promise.allSettled(batches.map(fetchRange));
  const succeeded = settled.filter((r): r is PromiseFulfilledResult<T[]> => r.status === 'fulfilled');
  const failedWindows = settled.length - succeeded.length;
  if (failedWindows === settled.length) {
    const firstReason = (settled[0] as PromiseRejectedResult).reason;
    const detail = firstReason instanceof Error ? `: ${firstReason.message}` : '';
    throw new Error(`All ${settled.length} date windows failed to load${detail}`, { cause: firstReason });
  }
  const rows = combine(succeeded.flatMap((r) => r.value));
  if (failedWindows > 0) {
    console.warn(
      `fetchBatchedRange: ${failedWindows} of ${settled.length} date windows failed to load; returning partial results`,
      (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason
    );
    windowFailuresByResult.set(rows, { failedWindows, totalWindows: settled.length });
  }
  return rows;
}

/** Dedupe rows keyed by encounterId (falling back to appointmentId) — the Encounters/Billing combine. */
export const dedupeByEncounter = <T extends { encounterId?: string; appointmentId?: string }>(rows: T[]): T[] =>
  Array.from(new Map(rows.map((r) => [r.encounterId ?? r.appointmentId, r])).values());

/** The not-yet-loaded layers a dataset exposes to the generator (so it can request more). */
export const availableLayersFor = (
  options: AdHocDatasetOption[],
  opts: Record<string, boolean>
): { id: string; label: string; description: string }[] =>
  options.filter((o) => !opts[o.id]).map((o) => ({ id: o.id, label: o.label, description: o.description ?? '' }));
