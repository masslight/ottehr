import { DateTime } from 'luxon';
import { ADHOC_BATCH_DAYS, splitDateRangeIntoBatches } from 'utils';

// Format a raw ISO instant as the VIEWER-LOCAL yyyy-MM-dd day ('' when absent/unparseable). The
// ad-hoc zambdas emit raw ISO instants and never zone-format dates (a report can mix locations across
// timezones), so all day-level derivation happens here in the browser-local zone.
export const toLocalYmd = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat('yyyy-MM-dd') : null;
};

// How long a fetched date-window stays fresh in the react-query cache. Long enough that the whole
// fetch→generate→needsLayers pipeline and StrictMode's dev double-invoke reuse the cached result
// instead of re-hitting the zambda; short enough that a later manual re-fetch gets fresh data.
export const ADHOC_QUERY_STALE_MS = 5 * 60 * 1000;

export interface BatchWindowFailures {
  failedWindows: number;
  totalWindows: number;
}

// Keyed by the exact row array fetchBatchedRange returned — the datasets hand that array to the page
// unchanged, so the UI can look up partial-failure info without threading an extra return value.
const windowFailuresByResult = new WeakMap<object, BatchWindowFailures>();

// Partial-failure info for a fetchBatchedRange result — undefined when every window loaded.
export const getBatchWindowFailures = (rows: unknown[]): BatchWindowFailures | undefined =>
  windowFailuresByResult.get(rows);

// Fetch a date range, batching windows longer than ADHOC_BATCH_DAYS into parallel sub-fetches, then
// `combine` (dedupe/merge — the only per-dataset step). A transient failure in one window keeps the
// successful windows and records the failure count (see getBatchWindowFailures); only an all-windows
// failure throws.
export async function fetchBatchedRange<T>(
  dateRange: { start: string; end: string },
  fetchRange: (range: { start: string; end: string }) => Promise<T[]>,
  combine: (all: T[]) => T[]
): Promise<T[]> {
  const { start, end } = dateRange;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  // combine runs on the single-window path too — one window can hold rows that need deduping/merging
  // (e.g. a follow-up encounter row alongside its parent visit's row).
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
    console.warn(`fetchBatchedRange: ${failedWindows} of ${settled.length} date windows failed to load`);
    windowFailuresByResult.set(rows as object, { failedWindows, totalWindows: settled.length });
  }
  return rows;
}

// Dedupe rows keyed by encounterId, falling back to appointmentId when an encounter isn't present yet.
export const dedupeByEncounter = <T extends { encounterId?: string; appointmentId?: string }>(rows: T[]): T[] =>
  Array.from(new Map(rows.map((r) => [r.encounterId ?? r.appointmentId, r])).values());
