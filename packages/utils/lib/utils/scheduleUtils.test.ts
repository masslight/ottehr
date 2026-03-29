import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { Closure, ClosureType, Timezone } from '../types';
import {
  applyOverridesToDailySchedule,
  Capacity,
  DailySchedule,
  getSlotCapacityMapForDayAndSchedule,
  getWaitingMinutes,
  mapSlotListItemToStartTimesArray,
  ScheduleDay,
  ScheduleOverrides,
  SlotListItem,
} from './scheduleUtils';

const timezone: Timezone = 'America/New_York';

function makeScheduleDay(overrides: Partial<ScheduleDay> = {}): ScheduleDay {
  return {
    open: 8,
    close: 17,
    openingBuffer: 0,
    closingBuffer: 0,
    workingDay: true,
    hours: [
      { hour: 8, capacity: 4 },
      { hour: 9, capacity: 4 },
      { hour: 10, capacity: 4 },
      { hour: 11, capacity: 4 },
      { hour: 12, capacity: 4 },
      { hour: 13, capacity: 4 },
      { hour: 14, capacity: 4 },
      { hour: 15, capacity: 4 },
      { hour: 16, capacity: 4 },
    ] as Capacity[],
    ...overrides,
  };
}

function makeDailySchedule(): DailySchedule {
  return {
    monday: makeScheduleDay(),
    tuesday: makeScheduleDay(),
    wednesday: makeScheduleDay(),
    thursday: makeScheduleDay(),
    friday: makeScheduleDay(),
    saturday: makeScheduleDay({ workingDay: false }),
    sunday: makeScheduleDay({ workingDay: false }),
  };
}

describe('scheduleUtils', () => {
  describe('getWaitingMinutes', () => {
    const now = DateTime.fromISO('2025-06-15T14:00:00', { zone: timezone });

    it('should return 0 when there are no encounters', () => {
      expect(getWaitingMinutes(now, [])).toBe(0);
    });

    it('should compute wait from the earliest arrived encounter', () => {
      const encounters = [
        {
          resourceType: 'Encounter',
          status: 'arrived',
          class: { code: 'AMB' },
          statusHistory: [{ status: 'arrived', period: { start: '2025-06-15T13:30:00-04:00' } }],
        },
        {
          resourceType: 'Encounter',
          status: 'arrived',
          class: { code: 'AMB' },
          statusHistory: [{ status: 'arrived', period: { start: '2025-06-15T13:00:00-04:00' } }],
        },
      ] as unknown as Encounter[];
      // Earliest is 13:00, now is 14:00, so 60 minutes
      expect(getWaitingMinutes(now, encounters)).toBe(60);
    });

    it('should return 0 when encounters have no arrived status history', () => {
      const encounters = [
        {
          resourceType: 'Encounter',
          status: 'arrived',
          class: { code: 'AMB' },
          statusHistory: [{ status: 'planned', period: { start: '2025-06-15T13:00:00-04:00' } }],
        },
      ] as unknown as Encounter[];
      expect(getWaitingMinutes(now, encounters)).toBe(0);
    });
  });

  describe('applyOverridesToDailySchedule', () => {
    it('should return original schedule when no override matches', () => {
      const schedule = makeDailySchedule();
      const result = applyOverridesToDailySchedule({
        dailySchedule: schedule,
        timezone,
        from: DateTime.fromISO('2025-06-09', { zone: timezone }), // Monday
        scheduleOverrides: {},
      });
      expect(result.overriddenDay).toBeUndefined();
    });

    it('should apply override when date matches', () => {
      const schedule = makeDailySchedule();
      const overrides: ScheduleOverrides = {
        '6/9/2025': {
          open: 10,
          close: 15,
          openingBuffer: 0,
          closingBuffer: 0,
          hours: [
            { hour: 10, capacity: 2 },
            { hour: 11, capacity: 2 },
            { hour: 12, capacity: 2 },
            { hour: 13, capacity: 2 },
            { hour: 14, capacity: 2 },
          ],
        },
      };
      const result = applyOverridesToDailySchedule({
        dailySchedule: schedule,
        timezone,
        from: DateTime.fromISO('2025-06-09', { zone: timezone }),
        scheduleOverrides: overrides,
      });
      expect(result.overriddenDay).toBeDefined();
      expect(result.overriddenDay?.open).toBe(10);
      expect(result.overriddenDay?.close).toBe(15);
    });

    it('should preserve workingDay from original schedule when overriding', () => {
      const schedule = makeDailySchedule();
      // Saturday (June 14, 2025) is not a working day
      const overrides: ScheduleOverrides = {
        '6/14/2025': {
          open: 9,
          close: 13,
          openingBuffer: 0,
          closingBuffer: 0,
          hours: [{ hour: 9, capacity: 2 }],
        },
      };
      const result = applyOverridesToDailySchedule({
        dailySchedule: schedule,
        timezone,
        from: DateTime.fromISO('2025-06-14', { zone: timezone }),
        scheduleOverrides: overrides,
      });
      // workingDay should come from the original saturday schedule (false)
      expect(result.overriddenDay?.workingDay).toBe(false);
    });
  });

  describe('getSlotCapacityMapForDayAndSchedule', () => {
    it('should return empty map for non-working day', () => {
      const schedule = makeDailySchedule();
      // Saturday
      const now = DateTime.fromISO('2025-06-14T10:00:00', { zone: timezone });
      const result = getSlotCapacityMapForDayAndSchedule(now, schedule, {}, undefined);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty map for a one-day closure', () => {
      const schedule = makeDailySchedule();
      const closures: Closure[] = [{ start: '6/9/2025', end: '6/9/2025', type: ClosureType.OneDay }];
      const now = DateTime.fromISO('2025-06-09T10:00:00', { zone: timezone });
      const result = getSlotCapacityMapForDayAndSchedule(now, schedule, {}, closures);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty map for a multi-day closure period', () => {
      const schedule = makeDailySchedule();
      const closures: Closure[] = [{ start: '6/9/2025', end: '6/13/2025', type: ClosureType.Period }];
      const now = DateTime.fromISO('2025-06-11T10:00:00', { zone: timezone }); // Wednesday mid-range
      const result = getSlotCapacityMapForDayAndSchedule(now, schedule, {}, closures);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return slots for a normal working day', () => {
      const schedule = makeDailySchedule();
      // Monday June 9
      const now = DateTime.fromISO('2025-06-09T10:00:00', { zone: timezone });
      const result = getSlotCapacityMapForDayAndSchedule(now, schedule, {}, undefined);
      // Should have time slots for the working hours
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });

  describe('mapSlotListItemToStartTimesArray', () => {
    it('should extract start times from slot list', () => {
      const items: SlotListItem[] = [
        {
          slot: { resourceType: 'Slot', status: 'free', schedule: { reference: 's1' }, start: '2025-06-09T08:00:00Z' },
          owner: { resourceType: 'Location', id: 'loc1', name: 'Clinic' },
          timezone,
        },
        {
          slot: { resourceType: 'Slot', status: 'free', schedule: { reference: 's1' }, start: '2025-06-09T09:00:00Z' },
          owner: { resourceType: 'Location', id: 'loc1', name: 'Clinic' },
          timezone,
        },
      ];
      expect(mapSlotListItemToStartTimesArray(items)).toEqual(['2025-06-09T08:00:00Z', '2025-06-09T09:00:00Z']);
    });

    it('should throw when a slot has no start time', () => {
      const items: SlotListItem[] = [
        {
          slot: { resourceType: 'Slot', status: 'free', schedule: { reference: 's1' } },
          owner: { resourceType: 'Location', id: 'loc1', name: 'Clinic' },
          timezone,
        },
      ];
      expect(() => mapSlotListItemToStartTimesArray(items)).toThrow('All slots must have a start time');
    });
  });
});
