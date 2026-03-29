import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { Closure, ClosureType, Timezone } from '../types/common';
import { ScheduleDay, ScheduleExtension } from '../utils';
import { getHoursForDate, isClosureOverride, isLocationOpen, isWalkinOpen } from './check-office-open';

const timezone: Timezone = 'America/New_York';

function makeScheduleDay(overrides: Partial<ScheduleDay> = {}): ScheduleDay {
  return {
    open: 8,
    close: 17,
    openingBuffer: 0,
    closingBuffer: 0,
    workingDay: true,
    hours: [],
    ...overrides,
  };
}

function makeScheduleExtension(overrides: Partial<ScheduleExtension> = {}): ScheduleExtension {
  return {
    schedule: {
      monday: makeScheduleDay(),
      tuesday: makeScheduleDay(),
      wednesday: makeScheduleDay(),
      thursday: makeScheduleDay(),
      friday: makeScheduleDay(),
      saturday: makeScheduleDay({ workingDay: false }),
      sunday: makeScheduleDay({ workingDay: false }),
    },
    scheduleOverrides: {},
    closures: [],
    ...overrides,
  };
}

describe('check-office-open', () => {
  describe('isClosureOverride', () => {
    it('should return false when no closures', () => {
      const date = DateTime.fromISO('2025-03-10', { zone: timezone }); // Monday
      expect(isClosureOverride([], timezone, date)).toBe(false);
    });

    it('should return true when date matches a single-day closure', () => {
      const closures: Closure[] = [{ start: '3/10/2025', end: '3/10/2025', type: ClosureType.OneDay }];
      const date = DateTime.fromISO('2025-03-10', { zone: timezone });
      expect(isClosureOverride(closures, timezone, date)).toBe(true);
    });

    it('should return false when date does not match closure', () => {
      const closures: Closure[] = [{ start: '3/10/2025', end: '3/10/2025', type: ClosureType.OneDay }];
      const date = DateTime.fromISO('2025-03-11', { zone: timezone });
      expect(isClosureOverride(closures, timezone, date)).toBe(false);
    });

    it('should return true when date falls within a multi-day closure range', () => {
      const closures: Closure[] = [{ start: '3/10/2025', end: '3/14/2025', type: ClosureType.OneDay }];
      const date = DateTime.fromISO('2025-03-12', { zone: timezone });
      expect(isClosureOverride(closures, timezone, date)).toBe(true);
    });

    it('should return true for start date of range', () => {
      const closures: Closure[] = [{ start: '3/10/2025', end: '3/14/2025', type: ClosureType.OneDay }];
      const date = DateTime.fromISO('2025-03-10', { zone: timezone });
      expect(isClosureOverride(closures, timezone, date)).toBe(true);
    });

    it('should return true for end date of range', () => {
      const closures: Closure[] = [{ start: '3/10/2025', end: '3/14/2025', type: ClosureType.OneDay }];
      const date = DateTime.fromISO('2025-03-14', { zone: timezone });
      expect(isClosureOverride(closures, timezone, date)).toBe(true);
    });
  });

  describe('getHoursForDate', () => {
    it('should return schedule for the correct day of week', () => {
      const schedule = makeScheduleExtension();
      // 2025-03-10 is a Monday
      const monday = DateTime.fromISO('2025-03-10', { zone: timezone });
      const hours = getHoursForDate(schedule, monday);
      expect(hours).toBeDefined();
      expect(hours?.open).toBe(8);
      expect(hours?.close).toBe(17);
      expect(hours?.workingDay).toBe(true);
    });

    it('should return non-working day for Saturday', () => {
      const schedule = makeScheduleExtension();
      // 2025-03-15 is a Saturday
      const saturday = DateTime.fromISO('2025-03-15', { zone: timezone });
      const hours = getHoursForDate(schedule, saturday);
      expect(hours?.workingDay).toBe(false);
    });
  });

  describe('isWalkinOpen', () => {
    it('should return true during office hours', () => {
      const schedule = makeScheduleExtension();
      // Monday at 10:00 AM ET
      const now = DateTime.fromISO('2025-03-10T10:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(true);
    });

    it('should return false before opening time', () => {
      const schedule = makeScheduleExtension();
      // Monday at 7:00 AM ET (before 8:00 open)
      const now = DateTime.fromISO('2025-03-10T07:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(false);
    });

    it('should return false after closing time', () => {
      const schedule = makeScheduleExtension();
      // Monday at 18:00 ET (after 17:00 close)
      const now = DateTime.fromISO('2025-03-10T18:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(false);
    });

    it('should return false on a non-working day', () => {
      const schedule = makeScheduleExtension();
      // Saturday at noon
      const now = DateTime.fromISO('2025-03-15T12:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(false);
    });

    it('should return false during a closure override', () => {
      const schedule = makeScheduleExtension({
        closures: [{ start: '3/10/2025', end: '3/10/2025', type: ClosureType.OneDay }],
      });
      // Monday during hours, but closed
      const now = DateTime.fromISO('2025-03-10T10:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(false);
    });

    it('should return true at exactly opening time', () => {
      const schedule = makeScheduleExtension();
      const now = DateTime.fromISO('2025-03-10T08:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(true);
    });

    it('should return false at exactly closing time', () => {
      const schedule = makeScheduleExtension();
      const now = DateTime.fromISO('2025-03-10T17:00:00', { zone: timezone });
      expect(isWalkinOpen(schedule, timezone, now)).toBe(false);
    });
  });

  describe('isLocationOpen', () => {
    it('should return true on a working day without closures', () => {
      const schedule = makeScheduleExtension();
      const now = DateTime.fromISO('2025-03-10T10:00:00', { zone: timezone });
      expect(isLocationOpen(schedule, timezone, now)).toBe(true);
    });

    it('should return false on a non-working day', () => {
      const schedule = makeScheduleExtension();
      const now = DateTime.fromISO('2025-03-15T10:00:00', { zone: timezone });
      expect(isLocationOpen(schedule, timezone, now)).toBe(false);
    });

    it('should return false when there is a closure override', () => {
      const schedule = makeScheduleExtension({
        closures: [{ start: '3/10/2025', end: '3/10/2025', type: ClosureType.OneDay }],
      });
      const now = DateTime.fromISO('2025-03-10T10:00:00', { zone: timezone });
      expect(isLocationOpen(schedule, timezone, now)).toBe(false);
    });
  });
});
