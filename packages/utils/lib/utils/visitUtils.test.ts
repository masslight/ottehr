import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { VisitStatusHistoryEntry } from '../types';
import { getDurationOfStatus, getVisitTotalTime } from './visitUtils';

const now = DateTime.fromISO('2026-04-15T12:00:00.000Z');

const status = (start: string, end?: string): VisitStatusHistoryEntry => ({
  status: 'arrived',
  period: {
    start,
    ...(end && { end }),
  },
});

describe('visit duration utils', () => {
  describe('getDurationOfStatus', () => {
    it('returns whole elapsed minutes for an active status', () => {
      expect(getDurationOfStatus(status('2026-04-15T11:58:30.000Z'), now)).toBe(1);
    });

    it('returns whole elapsed minutes for an ended status', () => {
      expect(getDurationOfStatus(status('2026-04-15T11:58:30.000Z', '2026-04-15T12:00:30.000Z'), now)).toBe(2);
    });

    it('does not return a negative duration when an active status starts in the future', () => {
      expect(getDurationOfStatus(status('2026-04-15T12:00:01.000Z'), now)).toBe(0);
    });

    it('does not return a negative duration when an ended status has an end before its start', () => {
      expect(getDurationOfStatus(status('2026-04-15T12:00:01.000Z', '2026-04-15T12:00:00.000Z'), now)).toBe(0);
    });
  });

  describe('getVisitTotalTime', () => {
    it('does not include negative status durations in total visit time', () => {
      const total = getVisitTotalTime(
        { resourceType: 'Appointment', status: 'arrived', start: '2026-04-15T11:58:00.000Z', participant: [] },
        [status('2026-04-15T11:59:00.000Z'), status('2026-04-15T12:00:01.000Z')],
        now
      );

      expect(total).toBe(1);
    });
  });
});
