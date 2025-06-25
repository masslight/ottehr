import { DateTime } from 'luxon';
import {
  Capacity,
  getAllSlotsAsCapacityMap,
  getAvailableSlots,
  GetAvailableSlotsInput,
  getTimezone,
  HourOfDay,
} from 'utils';
import { assert, vi } from 'vitest';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import {
  addClosureDay,
  addClosurePeriod,
  addOverrides,
  adjustHoursOfOperation,
  changeAllCapacities,
  DEFAULT_SCHEDULE_JSON,
  getScheduleDay,
  HoursOfOpConfig,
  makeSchedule,
  OverrideScheduleConfig,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

describe('closure and override tests', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  it('one day closure today results in no slots for today but all slots for tomorrow', () => {
    const startDate = startOfDayWithTimezone();
    const scheduleExtension = addClosureDay(DEFAULT_SCHEDULE_JSON, startDate);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const schedule = makeSchedule({ scheduleObject: scheduleExtension });

    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 2,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    const tomorrowStart = startDate.plus({ days: 1 });
    const tomorrowEnd = tomorrowStart.endOf('day');
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now <= tomorrowEnd) {
      if (now >= tomorrowStart) {
        expectedList.push(now.toISO());
      }
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 2 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now <= tomorrowEnd) {
      const capacity = capacityMap[now.toISO()!];
      if (now >= tomorrowStart) {
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toBeUndefined();
      }
      now = now.plus({ minutes: 15 });
    }
  });
  it("closure starting tomorrow has no affect on today's slots, but does eliminate tomorrow's", () => {
    const startDate = startOfDayWithTimezone();
    const closureDate = startDate.plus({ days: 1 });
    let scheduleExtension = addClosurePeriod(DEFAULT_SCHEDULE_JSON, closureDate, 1);
    scheduleExtension = addClosureDay(scheduleExtension, closureDate);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const schedule = makeSchedule({ scheduleObject: scheduleExtension });

    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 2,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    const tomorrowStart = startDate.plus({ days: 1 });
    const tomorrowEnd = tomorrowStart.endOf('day');
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList: string[] = [];

    while (now <= tomorrowEnd) {
      if (now < tomorrowStart) {
        expectedList.push(now.toISO()!);
      }
      now = now.plus({ minutes: 15 });
    }

    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 2 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now <= tomorrowEnd) {
      const capacity = capacityMap[now.toISO()!];
      if (now < tomorrowStart) {
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toBeUndefined();
      }
      now = now.plus({ minutes: 15 });
    }
  });
  it('period closure starting today results in no slots for either today or tomorrow (period.end is inclusive of the entire day)', () => {
    const startDate = startOfDayWithTimezone();
    const scheduleExtension = addClosurePeriod(DEFAULT_SCHEDULE_JSON, startDate, 1);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const schedule = makeSchedule({ scheduleObject: scheduleExtension });

    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 2,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(0);
    const tomorrowStart = startDate.plus({ days: 1 });
    const tomorrowEnd = tomorrowStart.endOf('day');
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList: string[] = [];

    expect(expectedList.length).toEqual(0);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 2 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now <= tomorrowEnd) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeUndefined();
      now = now.plus({ minutes: 15 });
    }
  });

  it("closure one week ago has no impact on today's slots", () => {
    const startDate = startOfDayWithTimezone();
    const closureDate = startDate.minus({ weeks: 1 });
    let scheduleExtension = addClosurePeriod(DEFAULT_SCHEDULE_JSON, closureDate, 1);
    scheduleExtension = addClosureDay(scheduleExtension, closureDate);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const schedule = makeSchedule({ scheduleObject: scheduleExtension });

    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    const tomorrowStart = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrowStart) {
      expectedList.push(now.toISO()!);
      now = now.plus({ minutes: 15 });
    }

    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }
  });

  it("closure one year ago has no impact on today's slots", () => {
    const startDate = startOfDayWithTimezone();
    const closureDate = startDate.minus({ years: 1 });
    let scheduleExtension = addClosurePeriod(DEFAULT_SCHEDULE_JSON, closureDate, 1);
    scheduleExtension = addClosureDay(scheduleExtension, closureDate);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const schedule = makeSchedule({ scheduleObject: scheduleExtension });

    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    const tomorrowStart = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrowStart) {
      expectedList.push(now.toISO()!);
      now = now.plus({ minutes: 15 });
    }

    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }
  });
  // do some override tests
  it('applies open override makes slots available where they would not otherwise be', () => {
    const startTime = startOfDayWithTimezone().set({ hour: 11 });
    const todayDoW = startTime.weekdayLong?.toLocaleLowerCase();
    assert(todayDoW);
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
    const scheduleExtension = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, hoursInfo);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
    const schedule = makeSchedule({ scheduleObject: scheduleExtension });
    const timezone = getTimezone(schedule);

    let getSlotsInput: GetAvailableSlotsInput = {
      now: startTime,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    let availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(24);

    // first we verify that there are no slots available until 16:00
    let earliestExpectedSlot = startTime.plus({ hours: 5 }).startOf('hour');
    availableSlots.forEach((slot) => {
      const slotDateTime = DateTime.fromISO(slot, { zone: timezone });
      expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
    });
    const overrideInfo: OverrideScheduleConfig = {
      date: startTime.startOf('day'),
      open: 9 as HourOfDay,
      close: 12 as HourOfDay,
      openingBuffer: 0,
      closingBuffer: 0,
      hourlyCapacity: 4,
    };
    const newScheduleExtension = addOverrides(scheduleExtension, [overrideInfo]);
    expect(newScheduleExtension).toBeDefined();
    assert(newScheduleExtension);
    const newSchedule = makeSchedule({ scheduleObject: newScheduleExtension });
    getSlotsInput = {
      now: startTime.startOf('day'),
      schedule: newSchedule,
      numDays: 1,
      busySlots: [],
    };
    availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(12);

    earliestExpectedSlot = startTime.startOf('day').plus({ hours: 9 }).startOf('hour');
    const latestExpectedSlot = startTime.startOf('day').plus({ hours: 12 }).startOf('hour').minus({ minutes: 15 });

    availableSlots.forEach((slot) => {
      const slotDateTime = DateTime.fromISO(slot, { zone: timezone });
      expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
      expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
    });

    let now = DateTime.fromISO(startTime.startOf('day').toISO()!, { zone: timezone });
    const tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startTime.startOf('day'),
      finishDate: startTime.startOf('day').plus({ days: 1 }),
      scheduleExtension: newScheduleExtension,
      timezone,
    });

    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toBeUndefined();
      }
      now = now.plus({ minutes: 15 });
    }
  });
  it('applies closed override to make slots unavailable where they would otherwise be available', () => {
    const startTime = startOfDayWithTimezone();
    const todayDoW = startTime.weekdayLong?.toLocaleLowerCase();
    assert(todayDoW);
    const schedule = makeSchedule({ scheduleObject: DEFAULT_SCHEDULE_JSON });
    const timezone = getTimezone(schedule);

    let getSlotsInput: GetAvailableSlotsInput = {
      now: startTime,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    let availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);

    const overrideInfo: OverrideScheduleConfig = {
      date: startTime.startOf('day'),
      open: 9 as HourOfDay,
      close: 12 as HourOfDay,
      openingBuffer: 0,
      closingBuffer: 0,
      hourlyCapacity: 4,
    };
    const newScheduleExtension = addOverrides(DEFAULT_SCHEDULE_JSON, [overrideInfo]);
    expect(newScheduleExtension).toBeDefined();
    assert(newScheduleExtension);
    const newSchedule = makeSchedule({ scheduleObject: newScheduleExtension });
    getSlotsInput = {
      now: startTime.startOf('day'),
      schedule: newSchedule,
      numDays: 1,
      busySlots: [],
    };
    availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(12);

    const earliestExpectedSlot = startTime.startOf('day').plus({ hours: 9 }).startOf('hour');
    const latestExpectedSlot = startTime.startOf('day').plus({ hours: 12 }).startOf('hour').minus({ minutes: 15 });

    availableSlots.forEach((slot) => {
      const slotDateTime = DateTime.fromISO(slot, { zone: timezone });
      expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
      expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
    });

    let now = DateTime.fromISO(startTime.startOf('day').toISO()!, { zone: timezone });
    const tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startTime.startOf('day'),
      finishDate: startTime.startOf('day').plus({ days: 1 }),
      scheduleExtension: newScheduleExtension,
      timezone,
    });

    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toBeUndefined();
      }
      now = now.plus({ minutes: 15 });
    }
  });

  it('applies buffer overrides to make slots unavailable where they would otherwise be available', () => {
    const startTime = startOfDayWithTimezone();
    const todayDoW = startTime.weekdayLong?.toLocaleLowerCase();
    assert(todayDoW);
    const schedule = makeSchedule({ scheduleObject: DEFAULT_SCHEDULE_JSON });
    const timezone = getTimezone(schedule);

    let getSlotsInput: GetAvailableSlotsInput = {
      now: startTime,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    let availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);

    const existingConfig = getScheduleDay(DEFAULT_SCHEDULE_JSON, startTime);
    assert(existingConfig);

    const overrideInfo: OverrideScheduleConfig = {
      date: startTime.startOf('day'),
      open: existingConfig.open,
      close: existingConfig.close,
      openingBuffer: 60,
      closingBuffer: 60,
      hourlyCapacity: 4,
    };
    const newScheduleExtension = addOverrides(DEFAULT_SCHEDULE_JSON, [overrideInfo]);
    expect(newScheduleExtension).toBeDefined();
    assert(newScheduleExtension);
    const newSchedule = makeSchedule({ scheduleObject: newScheduleExtension });
    getSlotsInput = {
      now: startTime.startOf('day'),
      schedule: newSchedule,
      numDays: 1,
      busySlots: [],
    };
    availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(88);

    const earliestExpectedSlot = startTime.startOf('day').plus({ hours: 1 }).startOf('hour');
    const latestExpectedSlot = startTime.plus({ days: 1 }).minus({ hours: 1, minutes: 15 });

    console.log('earliestExpectedSlot', earliestExpectedSlot.toISO());
    console.log('latestExpectedSlot', latestExpectedSlot.toISO());

    availableSlots.forEach((slot) => {
      const slotDateTime = DateTime.fromISO(slot, { zone: timezone });
      expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
      expect(slotDateTime <= latestExpectedSlot).toBeTruthy();
    });

    let now = DateTime.fromISO(startTime.startOf('day').toISO()!, { zone: timezone });
    const tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startTime.startOf('day'),
      finishDate: startTime.startOf('day').plus({ days: 1 }),
      scheduleExtension: newScheduleExtension,
      timezone,
    });

    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      if (now >= earliestExpectedSlot && now <= latestExpectedSlot) {
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toBeUndefined();
      }
      now = now.plus({ minutes: 15 });
    }
  });

  it('applies capacity overrides to make slots unavailable where they would otherwise be available', () => {
    const startTime = startOfDayWithTimezone();
    const todayDoW = startTime.weekdayLong?.toLocaleLowerCase();
    assert(todayDoW);
    const scheduleExtension = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 1);
    console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
    const schedule = makeSchedule({ scheduleObject: scheduleExtension });
    const timezone = getTimezone(schedule);

    let getSlotsInput: GetAvailableSlotsInput = {
      now: startTime,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    let availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();

    console.log('availableSlots last test', availableSlots);
    expect(availableSlots.length).toEqual(24);

    const existingConfig = getScheduleDay(DEFAULT_SCHEDULE_JSON, startTime);
    assert(existingConfig);

    const granularHours: Capacity[] = [
      { hour: 0, capacity: 4 },
      { hour: 1, capacity: 8 },
      { hour: 2, capacity: 4 },
      { hour: 3, capacity: 8 },
      { hour: 4, capacity: 4 },
      { hour: 5, capacity: 8 },
      { hour: 6, capacity: 4 },
      { hour: 7, capacity: 8 },
      { hour: 8, capacity: 4 },
      { hour: 9, capacity: 8 },
      { hour: 10, capacity: 4 },
      { hour: 11, capacity: 8 },
      { hour: 12, capacity: 4 },
      { hour: 13, capacity: 8 },
      { hour: 14, capacity: 4 },
      { hour: 15, capacity: 8 },
      { hour: 16, capacity: 4 },
      { hour: 17, capacity: 8 },
      { hour: 18, capacity: 4 },
      { hour: 19, capacity: 8 },
      { hour: 20, capacity: 4 },
      { hour: 21, capacity: 8 },
      { hour: 22, capacity: 4 },
      { hour: 23, capacity: 8 },
    ];

    const overrideInfo: OverrideScheduleConfig = {
      date: startTime.startOf('day'),
      open: existingConfig.open,
      close: existingConfig.close,
      openingBuffer: existingConfig.openingBuffer,
      closingBuffer: existingConfig.closingBuffer,
      hourlyCapacity: 4,
      granularCapacityOverride: granularHours,
    };
    const newScheduleExtension = addOverrides(DEFAULT_SCHEDULE_JSON, [overrideInfo]);
    expect(newScheduleExtension).toBeDefined();
    assert(newScheduleExtension);
    const newSchedule = makeSchedule({ scheduleObject: newScheduleExtension });
    getSlotsInput = {
      now: startTime.startOf('day'),
      schedule: newSchedule,
      numDays: 1,
      busySlots: [],
    };
    availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);

    let now = DateTime.fromISO(startTime.startOf('day').toISO()!, { zone: timezone });
    const tomorrowStart = startTime.startOf('day').plus({ days: 1 }).startOf('day');

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startTime.startOf('day'),
      finishDate: startTime.startOf('day').plus({ days: 1 }),
      scheduleExtension: newScheduleExtension,
      timezone,
    });

    while (now < tomorrowStart) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      const hour = now.hour;
      if (hour % 2 === 0) {
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toEqual(2);
      }
      now = now.plus({ minutes: 15 });
    }
  });
});
