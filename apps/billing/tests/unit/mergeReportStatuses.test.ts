import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it } from 'vitest';
import { mergeReportStatuses } from '../../src/components/ReportStatusBar';

const idle = (lastCompletedAt?: string): ReportRefreshStatus => ({ state: 'idle', lastCompletedAt });
const running: ReportRefreshStatus = { state: 'running', progress: 'computing' };
const errored: ReportRefreshStatus = { state: 'error', error: 'boom' };

describe('mergeReportStatuses', () => {
  it('returns undefined when nothing is passed', () => {
    expect(mergeReportStatuses()).toBeUndefined();
  });

  it('returns undefined when all statuses are undefined', () => {
    expect(mergeReportStatuses(undefined, undefined)).toBeUndefined();
  });

  it('ignores undefined entries', () => {
    expect(mergeReportStatuses(undefined, idle('2026-08-27T10:00:00Z'))).toEqual(idle('2026-08-27T10:00:00Z'));
  });

  it('prefers running over error and idle', () => {
    expect(mergeReportStatuses(idle('2026-08-27T10:00:00Z'), errored, running)).toBe(running);
  });

  it('prefers error over idle when nothing is running', () => {
    expect(mergeReportStatuses(idle('2026-08-27T10:00:00Z'), errored)).toBe(errored);
  });

  it('returns the oldest completion among idle statuses', () => {
    const older = idle('2026-08-26T09:00:00Z');
    const newer = idle('2026-08-27T10:00:00Z');
    expect(mergeReportStatuses(newer, older)).toBe(older);
  });

  it('treats a missing lastCompletedAt as the oldest', () => {
    const never = idle();
    const completed = idle('2026-08-27T10:00:00Z');
    expect(mergeReportStatuses(completed, never)).toBe(never);
  });

  it('compares completions as instants, not strings', () => {
    // lexicographically '2026-08-27T05:00:00-05:00' < '2026-08-27T09:00:00Z' but it is the later instant
    const laterInstant = idle('2026-08-27T05:00:00-05:00'); // 10:00Z
    const earlierInstant = idle('2026-08-27T09:00:00Z');
    expect(mergeReportStatuses(laterInstant, earlierInstant)).toBe(earlierInstant);
  });

  it('returns a single status unchanged', () => {
    const only = idle('2026-08-27T10:00:00Z');
    expect(mergeReportStatuses(only)).toBe(only);
  });
});
