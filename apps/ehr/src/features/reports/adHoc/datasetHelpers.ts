import { ADHOC_BATCH_DAYS, splitDateRangeIntoBatches } from 'utils';
import { AdHocDatasetOption } from './types';

/**
 * Fetch a date range, batching ranges longer than ADHOC_BATCH_DAYS into parallel sub-fetches. A short
 * range is fetched in one call; a long range is split, fetched concurrently, then `combine`d (dedupe or
 * merge — the only step that varies by dataset). Shared by the Encounters/Billing/Patients datasets.
 */
export async function fetchBatchedRange<T>(
  dateRange: { start: string; end: string },
  fetchRange: (range: { start: string; end: string }) => Promise<T[]>,
  combine: (all: T[]) => T[]
): Promise<T[]> {
  const { start, end } = dateRange;
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  if (days <= ADHOC_BATCH_DAYS) return fetchRange({ start, end });
  const batches = splitDateRangeIntoBatches(start, end, ADHOC_BATCH_DAYS);
  const results = await Promise.all(batches.map(fetchRange));
  return combine(results.flat());
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
