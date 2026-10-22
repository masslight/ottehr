// Which way a report fetches: one http_auth call (fast, but cut at 27 s when deployed) or the
// background Task (no ceiling, ~2 s of create + poll overhead). Chosen per report from the server
// fetch time measured on an earlier run, and only for a date range no wider than that one. Shared by
// Report Studio (measured while building) and the EHR's system reports (measured on the practice).
import type { DateRange } from '../query/date-range';

export type FetchMode = 'direct' | 'task';

/** A report whose measured server fetch stays under this goes direct — well inside the 27 s API Gateway ceiling. */
export const DIRECT_FETCH_MAX_SECONDS = 10;
const DIRECT_FETCH_CEILING_MS = 27_000;

export interface MeasuredFetch {
  /** How runs fetch: direct http_auth call when the measured fetch was fast, else the background Task. */
  fetchMode?: FetchMode;
  /** Server fetch time of the last run, and the date-range span (days) it was measured on. */
  measuredFetchSeconds?: number;
  measuredRangeDays?: number;
}

export const rangeDays = (range: DateRange): number =>
  Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000);

/** A report without a date range (no templated plan) has nothing to compare: its last measurement decides alone. */
export function chooseFetchMode(report: MeasuredFetch, dateRange?: DateRange): FetchMode {
  if (report.fetchMode !== 'direct' || report.measuredRangeDays === undefined) return 'task';
  if (!dateRange) return 'direct';
  return rangeDays(dateRange) > report.measuredRangeDays ? 'task' : 'direct';
}

/** What a run teaches the report; `fellBack` (direct timed out, Task finished it) pins the Task path. */
export function measuredFetch(totalMs: number, dateRange: DateRange | undefined, fellBack = false): MeasuredFetch {
  return {
    fetchMode: !fellBack && totalMs < DIRECT_FETCH_MAX_SECONDS * 1000 ? 'direct' : 'task',
    measuredFetchSeconds: totalMs / 1000,
    measuredRangeDays: dateRange ? rangeDays(dateRange) : 0,
  };
}

/** A direct call that died of time: a gateway 502/503/504, or any failure after most of the ceiling (a timed-out gateway answer often fails CORS and reaches the browser as status 0). */
export const isDirectTimeout = (error: unknown, elapsedMs: number): boolean =>
  elapsedMs >= DIRECT_FETCH_CEILING_MS * 0.75 ||
  (typeof (error as { status?: unknown })?.status === 'number' && (error as { status: number }).status >= 502);
