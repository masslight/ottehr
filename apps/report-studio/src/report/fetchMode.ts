// Which way a report fetches: one http_auth call (fast, but cut at 27 s when deployed) or the
// background Task (no ceiling, ~2 s of create + poll overhead). Chosen per saved report from the
// server fetch time measured when it was built, and only for a date range no wider than that one.
import { FetchStepDensity, FetchStepStats, stepIsDateBounded } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import type { StudioReport } from './types';

export type FetchMode = 'direct' | 'task';

/** A report whose measured server fetch stays under this goes direct — well inside the 27 s API Gateway ceiling. */
export const DIRECT_FETCH_MAX_SECONDS = 10;
const DIRECT_FETCH_CEILING_MS = 27_000;

type MeasuredFetch = Pick<StudioReport, 'fetchMode' | 'measuredFetchSeconds' | 'measuredRangeDays'>;

export const rangeDays = (range: DateRange): number =>
  Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000);

export function chooseFetchMode(report: MeasuredFetch, dateRange: DateRange): FetchMode {
  if (report.fetchMode !== 'direct' || report.measuredRangeDays === undefined) return 'task';
  return rangeDays(dateRange) > report.measuredRangeDays ? 'task' : 'direct';
}

/** What a run teaches the report; `fellBack` (direct timed out, Task finished it) pins the Task path. */
export function measuredFetch(totalMs: number, dateRange: DateRange, fellBack = false): MeasuredFetch {
  return {
    fetchMode: !fellBack && totalMs < DIRECT_FETCH_MAX_SECONDS * 1000 ? 'direct' : 'task',
    measuredFetchSeconds: totalMs / 1000,
    measuredRangeDays: rangeDays(dateRange),
  };
}

/** A direct call that died of time: a gateway 502/503/504, or any failure after most of the ceiling (a timed-out gateway answer often fails CORS and reaches the browser as status 0). */
export const isDirectTimeout = (error: unknown, elapsedMs: number): boolean =>
  elapsedMs >= DIRECT_FETCH_CEILING_MS * 0.75 ||
  (typeof (error as { status?: unknown })?.status === 'number' && (error as { status: number }).status >= 502);

/**
 * What a run teaches about each step's volume, for the zambda to pre-size the next run's date windows and
 * batches: primary resources per scoped id (and the ids its source step's records yielded, for the request
 * estimate), or per day of the range for a date-bounded step. A step that failed or was skipped teaches nothing.
 */
export function stepDensity(
  plan: { steps: { id: string; params?: { name: string; value: string }[]; from?: { step: string } }[] },
  stats: FetchStepStats[],
  dateRange: DateRange
): Record<string, FetchStepDensity> {
  const days = Math.max(1, rangeDays(dateRange));
  const out: Record<string, FetchStepDensity> = {};
  const primaryOf = (s: FetchStepStats): number => s.byType[s.resourceType] ?? 0;
  for (const s of stats) {
    if (s.mode === 'skipped' || s.error) continue;
    const primary = primaryOf(s);
    const step = plan.steps.find((p) => p.id === s.id);
    if (s.scopedValues) {
      const source = stats.find((other) => other.id === step?.from?.step);
      const sourcePrimary = source ? primaryOf(source) : 0;
      out[s.id] = {
        recordsPerId: primary / s.scopedValues,
        ...(sourcePrimary ? { idsPerSourceRecord: s.scopedValues / sourcePrimary } : {}),
      };
    } else if (step && stepIsDateBounded(step)) {
      // rows per record: what the step's includes bring along, which sizes its bulk jobs (BULK_JOB_ROWS)
      const rows = Object.values(s.byType).reduce((sum, n) => sum + n, 0);
      out[s.id] = { recordsPerDay: primary / days, ...(primary ? { rowsPerRecord: rows / primary } : {}) };
    }
  }
  return out;
}
