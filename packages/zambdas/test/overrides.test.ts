/* eslint-disable @typescript-eslint/no-unused-vars */
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import React from 'react';
import {
  AvailableLocationInformation,
  getAvailableSlots,
  getLocationInformation,
  getScheduleExtension,
  getSlotCapacityMapForDayAndSchedule,
} from 'utils';
import { vi } from 'vitest';
import { useCheckOfficeOpen } from '../../../apps/intake/src/hooks/useCheckOfficeOpen';
import { getNextOpeningDateTime } from '../src/patient/get-schedule';
import * as overrideData from './data/override-constants';
import * as slotData from './data/slot-constants';
import { addDateToSlotTimes } from './data/slot-constants';
import { HoursOfOpConfig, makeLocationWithSchedule, OverrideScheduleConfig } from './helpers/testScheduleUtils';

describe.skip('test schedule override for getAvailableSlots function, i.e., front end slot display', () => {
  test('1: it should return slots between 6pm and 10pm today if opening buffer 15, capacity 3, and schedule override is applied for today open @6pm close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todaySlotScheduleOverride;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, overrideInfo);

    const testSlots = getAvailableSlots({
      now: time,
      schedule,
      numDays: 1,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.overrideSlotMapGroupC);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: it should return slots between 1pm and 5pm for today and tomorrow if opening buffer 15, capacity 3, and schedule override is applied for past week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 12 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
    ];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.pastScheduleOverride2;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, overrideInfo);
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupC),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupC),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('3: it should return slots between 1pm and 5pm for today and tomorrow if opening buffer 15, capacity 3, and schedule override is applied for future week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 12 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
    ];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.futureScheduleOverride2;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, overrideInfo);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupC),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupC),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('4: it should return slots between 8pm and 12am for today if capacity 3 and no schedule override', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 20, close: 24, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0);
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotMapZ);
    expect(testSlots).toEqual(expectedSlots);
  });
});

describe.skip('test closure override for getAvailableSlots function, i.e., front end slot display', () => {
  test('1: it should return tomorrow slots if opening buffer 15, capacity 3, and closure override is applied for today', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
    ];
    const closures = overrideData.todayClosureOverrideForOneDay;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, undefined, closures);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupC);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: it should return slots for today and tomorrow if opening buffer 15, capacity 3, and closure override is applied for past week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 12 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
    ];
    const closures = overrideData.pastClosureOverrideForOneDay;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, undefined, closures);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupC),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupC),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('3: it should return slots for today and tomorrow if opening buffer 15, capacity 3, and closure override is applied for future week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 12 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 13, close: 17, workingDay: true },
    ];
    const closures = overrideData.futureClosureOverrideForOneDay;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0, undefined, closures);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupC),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupC),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });
});

describe.skip('test schedule override for getSlotCapacityMapForDayAndSchedule function', () => {
  test('1: capacity 15, no buffers, open @10am close @3pm; schedule override capacity 15, opening buffer 15, closing buffer 15, open @1pm close @2pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.overrideScheduleA;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const scheduleDetails = getScheduleExtension(schedule);

    expect(scheduleDetails).toBeDefined();

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const testSlotCapacityMap = getSlotCapacityMapForDayAndSchedule(
      time,
      scheduleDetails.schedule,
      scheduleDetails.scheduleOverrides,
      scheduleDetails.closures
    );
    const expectedSlotMap = slotData.addDateToSlotMap(time, slotData.overrideSlotMapA);
    expect(testSlotCapacityMap).toEqual(expectedSlotMap);
  });

  test('2: capacity 15, no buffers, open @10am close @3pm; schedule past override but same week day', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.pastScheduleOverride1;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const testSlotCapacityMap = getSlotCapacityMapForDayAndSchedule(
      time,
      scheduleDetails.schedule,
      scheduleDetails.scheduleOverrides,
      scheduleDetails.closures
    );
    const expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapA);
    expect(testSlotCapacityMap).toEqual(expectedSlotMap);
  });

  test('3: capacity 15, no buffers, open @10am close @3pm; schedule future override but same week day', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.futureScheduleOverride1;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const testSlotCapacityMap = getSlotCapacityMapForDayAndSchedule(
      time,
      scheduleDetails.schedule,
      scheduleDetails.scheduleOverrides,
      scheduleDetails.closures
    );
    const expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapA);
    expect(testSlotCapacityMap).toEqual(expectedSlotMap);
  });

  test('4: capacity 15, no buffers, open @8pm close @12am; no schedule override', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 20, close: 24, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = [];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const testSlotCapacityMap = getSlotCapacityMapForDayAndSchedule(
      time,
      scheduleDetails.schedule,
      scheduleDetails.scheduleOverrides,
      scheduleDetails.closures
    );
    const expectedSlotMap = slotData.addDateToSlotMap(time, slotData.slotMapB);
    expect(testSlotCapacityMap).toEqual(expectedSlotMap);
  });
});

describe.skip('test schedule override for officeOpen', () => {
  let originalUseMemo: typeof React.useMemo;

  beforeAll(() => {
    originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((fn) => {
      const memoizedValue = fn();
      return memoizedValue;
    }) as typeof React.useMemo;
  });

  afterAll(() => {
    React.useMemo = originalUseMemo;
  });

  test('1: it should return officeOpen as true if current time is 8am today, open @12am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 0, close: 23, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('2: it should return officeOpen as false if current time is 8am today, open @2pm, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 14, close: 23, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(false);

    spy.mockRestore();
  });

  test('3: it should return officeOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for past week with open @8pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.pastScheduleOverride2;
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('4: it should return officeOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for future week with open @8pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.futureScheduleOverride2;
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('5: it should return officeOpen as false if current time is 1pm today, open @9am, close @10pm and schedule override is applied today with open @5pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(false);

    spy.mockRestore();
  });

  test('6: it should return officeOpen as true if current time is 11am today, open @4pm, close @10pm and schedule override is applied today with open @9am, close @12pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 11 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride2;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('7: it should return officeOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 19 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('8: it should return officeOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @12am', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 19 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverrideMidnight;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });
});

describe.skip('test schedule override for walkinOpen', () => {
  let originalUseMemo: typeof React.useMemo;

  beforeAll(() => {
    originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((fn) => {
      const memoizedValue = fn();
      return memoizedValue;
    }) as typeof React.useMemo;
  });

  afterAll(() => {
    React.useMemo = originalUseMemo;
  });

  test('1: it should return walkinOpen as true if current time is 8am today, open @12am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 0, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  // case where walkin should be open 15 minutes prior to the office opening time
  test('2: it should return walkinOpen as true if current time is 8:50am today, open @9am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8, minute: 50 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('3: it should return walkinOpen as false if current time is 9pm today, open @2pm, close @5pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 21 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 14, close: 17, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(false);

    spy.mockRestore();
  });

  test('4: it should return walkinOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for past week with open @8pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.pastScheduleOverride2;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('5: it should return walkinOpen as true if current time is 1pm today, open @9am, close @10pm and schedule override is applied for future week with open @8pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.futureScheduleOverride2;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('6: it should return walkinOpen as false if current time is 1pm today, open @9am, close @10pm and schedule override is applied today with open @5pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(false);

    spy.mockRestore();
  });

  test('7: it should return walkin as true if current time is 11am today, open @4pm, close @10pm and schedule override is applied today with open @9am, close @12pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 11 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride2;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('8: it should return walkinOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @10pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 19 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverride;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('9: it should return walkinOpen as true if current time is 7pm today, open @9am, close @12pm and schedule override is applied today with open @5pm, close @12am', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 19 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 12, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.todayScheduleOverrideMidnight;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('10: it should return walkinOpen as false if current time is 4pm today, open @9am, close @11pm, but it is a non-working day, i.e., workingDay = false', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 16 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: false }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, [], []);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(false);

    spy.mockRestore();
  });
});

describe.skip('test closure override for officeHasClosureOverrideToday', () => {
  let originalUseMemo: typeof React.useMemo;

  beforeAll(() => {
    originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((fn) => {
      const memoizedValue = fn();
      return memoizedValue;
    }) as typeof React.useMemo;
  });

  afterAll(() => {
    React.useMemo = originalUseMemo;
  });

  test('1: it should return officeHasClosureOverrideToday as true if current time is 8am today, open @8am, close @3pm and closure override is applied for today', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.todayClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideToday).toBe(true);

    spy.mockRestore();
  });

  test('2: it should return officeHasClosureOverrideToday as false if current time is 8am today, open @8am, close @3pm and closure override is applied for past week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.pastClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideToday).toBe(false);

    spy.mockRestore();
  });

  test('3: it should return officeHasClosureOverrideToday as false if current time is 8am today, open @8am, close @3pm and closure override is applied for future week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.futureClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideToday).toBe(false);

    spy.mockRestore();
  });
});

describe.skip('test closure override for officeHasClosureOverrideTomorrow', () => {
  let originalUseMemo: typeof React.useMemo;

  beforeAll(() => {
    originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((fn) => {
      const memoizedValue = fn();
      return memoizedValue;
    }) as typeof React.useMemo;
  });

  afterAll(() => {
    React.useMemo = originalUseMemo;
  });

  test('1: it should return officeHasClosureOverrideTomorrow as true if current time is 8am today, open @8am, close @3pm and closure override is applied for tomorrow', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.tomorrowClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideTomorrow).toBe(true);

    spy.mockRestore();
  });

  test('2: it should return officeHasClosureOverrideTomorrow as false if current time is 8am today, open @8am, close @3pm and closure override is applied for past week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.pastClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideTomorrow).toBe(false);

    spy.mockRestore();
  });

  test('3: it should return officeHasClosureOverrideTomorrow as false if current time is 8am today, open @8am, close @3pm and closure override is applied for future week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.futureClosureOverrideForOneDay;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideTomorrow).toBe(false);

    spy.mockRestore();
  });

  test('4: it should return officeHasClosureOverrideToday and officeHasClosureOverrideTomorrow as true if current time is 8am today, open @8am, close @3pm and closure override is applied for period starting today until next week', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 15, workingDay: true }];
    const closures = overrideData.closureOverrideForPeriod;
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, undefined, closures);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testResult = useCheckOfficeOpen(selectedLocation);
    expect(testResult.officeHasClosureOverrideTomorrow && testResult.officeHasClosureOverrideTomorrow).toBe(true);

    spy.mockRestore();
  });
});

describe.skip('test prebookStillOpenForToday, officeOpen, and walkinOpen when no slots are available', () => {
  let originalUseMemo: typeof React.useMemo;

  beforeAll(() => {
    originalUseMemo = React.useMemo;
    React.useMemo = jest.fn((fn) => {
      const memoizedValue = fn();
      return memoizedValue;
    }) as typeof React.useMemo;
  });

  afterAll(() => {
    React.useMemo = originalUseMemo;
  });

  test('1: it should return officeOpen as true if no slots are available for today, current time is 10pm today, closing buffer 60, open @9am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 22 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testOfficeOpen = useCheckOfficeOpen(selectedLocation);
    expect(testOfficeOpen.officeOpen).toBe(true);

    spy.mockRestore();
  });

  test('2: it should return walkinOpen as true if no slots are available for today, current time is 10pm today, closing buffer 60, open @9am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 22 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testWalkinOpen = useCheckOfficeOpen(selectedLocation);
    expect(testWalkinOpen.walkinOpen).toBe(true);

    spy.mockRestore();
  });

  test('3: it should return prebookStillOpenForToday as true if no slots are available for today, current time is 9:59pm today, closing buffer 60, open @9am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 21, minute: 59 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testPrebookOpen = useCheckOfficeOpen(selectedLocation);
    expect(testPrebookOpen.prebookStillOpenForToday).toBe(true);

    spy.mockRestore();
  });

  test('4: it should return prebookStillOpenForToday as false if current time is 10:30pm today, closing buffer 60, open @9am, close @11pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 22, minute: 30 });
    const spy = vi.spyOn(DateTime, 'now');
    spy.mockReturnValue(time);

    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const selectedLocation: AvailableLocationInformation = getLocationInformation(location, schedule);
    const testPrebookOpen = useCheckOfficeOpen(selectedLocation);
    expect(testPrebookOpen.prebookStillOpenForToday).toBe(false);

    spy.mockRestore();
  });
});

describe.skip('test getNextOpeningDateTime', () => {
  test('1: it should return opening time for today if walkin is closed and current time is before opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 30 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 18, close: 23, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now().set({ hour: 18, minute: 0 }).setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });

  test('2: it should return opening time for tomorrow if walkin is closed and current time is after opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 18, minute: 30 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 9, close: 23, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now()
      .set({ hour: 5, minute: 0 })
      .setZone('utc')
      .plus({ day: 1 })
      .toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });

  test('3: it should return opening time for 5th day from today if walkin is closed, it is a working day, no schedule override, closure override for 4 days, and current time is after opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: 'monday', open: 10, close: 18, workingDay: true },
      { dayOfWeek: 'friday', open: 3, close: 18, workingDay: true },
    ];
    const closures = overrideData.closureOverrideFourDays;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60, undefined, closures);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now()
      .set({ weekday: 1, hour: 3, minute: 0 })
      .plus({ day: 4 })
      .setZone('utc')
      .toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });

  test('4: it should return opening time of schedule override for tomorrow if walkin is closed, it is a working day, schedule override is for tomorrow, closure override is for today, and current time is after opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: 'monday', open: 7, close: 18, workingDay: true }];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.tuesdayScheduleOverride;
    const closures = overrideData.mondayClosureOverrideForOneDay;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60, overrideInfo, closures);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now()
      .set({ weekday: 1, hour: 8, minute: 0 })
      .plus({ day: 1 })
      .setZone('utc')
      .toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });

  test('5: it should return opening time for 3rd day from today if walkin is closed, it is a non-working day, no schedule override, closure override is for tomorrow, and current time is after opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: 'monday', open: 7, close: 18, workingDay: false },
      { dayOfWeek: 'wednesday', open: 7, close: 18, workingDay: true },
    ];
    const closures = overrideData.tuesdayClosureOverrideForOneDay;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60, [], closures);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now()
      .set({ weekday: 1, hour: 7, minute: 0 })
      .plus({ day: 2 })
      .setZone('utc')
      .toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });

  test('6: it should return opening time of schedule override for tomorrow if walkin is closed, it is a non-working day, schedule override is for tomorrow, no closure override, and current time is after opening time', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 18, minute: 30, weekday: 1 });
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: 'monday', open: 7, close: 18, workingDay: true },
      { dayOfWeek: 'tuesday', open: 16, close: 18, workingDay: true },
    ];
    const overrideInfo: OverrideScheduleConfig[] = overrideData.tuesdayScheduleOverride;
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 60, overrideInfo);
    const testResult = getNextOpeningDateTime(time, schedule);
    const expectedResult = DateTime.now()
      .set({ weekday: 1, hour: 8, minute: 0 })
      .plus({ day: 1 })
      .setZone('utc')
      .toFormat('HH:mm MM-dd-yyyy z');
    expect(testResult).toBe(expectedResult);
  });
});
