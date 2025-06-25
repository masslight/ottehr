import { getScheduleExtension, getTimezone, isWalkinOpen } from 'utils';
import { assert, vi } from 'vitest';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import {
  addClosureDay,
  addClosurePeriod,
  addOverrides,
  adjustHoursOfOperation,
  applyBuffersToScheduleExtension,
  DEFAULT_SCHEDULE_JSON,
  getScheduleDay,
  makeSchedule,
  OverrideScheduleConfig,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

describe('walkin availability tests', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  it('should make walkin available before close time, but not at exactly close time', () => {
    // a reasonable requirement might be that some kind of buffer be applied so that walkin visits
    // can't be checked in right up to the brink of closing time, but that is not a feature thus far.
    let timeNow = startOfDayWithTimezone().plus({ hours: 17, minutes: 59, seconds: 59 });

    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    const schedule = makeSchedule({ scheduleObject: adjustedScheduleJSON });
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    timeNow = timeNow.plus({ seconds: 1 });
    walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });

  it('should make walkin available right at opening time, but not a moment before', () => {
    let timeNow = startOfDayWithTimezone().plus({ hours: 8, minutes: 0, seconds: 0 });

    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: false,
      },
    ]);

    const schedule = makeSchedule({ scheduleObject: adjustedScheduleJSON });
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    timeNow = timeNow.minus({ seconds: 1 });
    walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });

  it('should disregard opening buffer when determining walk-in availability', () => {
    // buffers control the start and end periods where prebook slots can be created, but should not affect
    // walkin availability.
    let timeNow = startOfDayWithTimezone().plus({ hours: 8, minutes: 0, seconds: 0 });
    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: false,
      },
    ]);
    const bufferedSchedule = applyBuffersToScheduleExtension(adjustedScheduleJSON, {
      openingBuffer: 30,
    });
    const schedule = makeSchedule({ scheduleObject: bufferedSchedule });
    expect(schedule).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    timeNow = timeNow.minus({ seconds: 1 });
    walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });
  it('should disregard closing buffer when determining walk-in availability', () => {
    // buffers control the start and end periods where prebook slots can be created, but should not affect
    // walkin availability.
    let timeNow = startOfDayWithTimezone().plus({ hours: 17, minutes: 59, seconds: 59 });

    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: false,
      },
    ]);
    const bufferedSchedule = applyBuffersToScheduleExtension(adjustedScheduleJSON, {
      closingBuffer: 30,
    });
    const schedule = makeSchedule({ scheduleObject: bufferedSchedule });
    expect(schedule).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    timeNow = timeNow.plus({ seconds: 1 });
    walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });
  it('should make walkin closed when a Closure is applied to a schedule that would otherwise make walk-in open', () => {
    // buffers control the start and end periods where prebook slots can be created, but should not affect
    // walkin availability.
    const timeNow = startOfDayWithTimezone().plus({ hours: 14 });

    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: false,
      },
    ]);

    const schedule = makeSchedule({ scheduleObject: adjustedScheduleJSON });
    expect(schedule).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    // apply day closure
    const closedForADaySchedule = addClosureDay(adjustedScheduleJSON, timeNow);

    walkinOpen = isWalkinOpen(closedForADaySchedule, timezone, timeNow);
    expect(walkinOpen).toBe(false);

    // apply period closure
    const closedForAPeriodSchedule = addClosurePeriod(
      adjustedScheduleJSON,
      timeNow.minus({ days: 1 }).startOf('day'),
      2
    );
    walkinOpen = isWalkinOpen(closedForAPeriodSchedule, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });

  it('should make walkin closed when an Override is applied to a schedule that would otherwise make walk-in open', () => {
    // buffers control the start and end periods where prebook slots can be created, but should not affect
    // walkin availability.
    const timeNow = startOfDayWithTimezone().plus({ hours: 14 });

    const adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: false,
      },
    ]);

    const schedule = makeSchedule({ scheduleObject: adjustedScheduleJSON });
    expect(schedule).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    let walkinOpen = isWalkinOpen(scheduleExtension, timezone, timeNow);
    expect(walkinOpen).toBe(true);

    const existingConfig = getScheduleDay(scheduleExtension, timeNow);
    assert(existingConfig);

    // apply override that moves open time to after the current time
    let overrideInfo: OverrideScheduleConfig = {
      date: timeNow.startOf('day'),
      open: 15,
      close: existingConfig.close,
      openingBuffer: existingConfig.openingBuffer,
      closingBuffer: existingConfig.closingBuffer,
      hourlyCapacity: 4,
    };
    const notOpenYetSchedule = addOverrides(scheduleExtension, [overrideInfo]);

    walkinOpen = isWalkinOpen(notOpenYetSchedule, timezone, timeNow);
    expect(walkinOpen).toBe(false);

    // apply override that moves closed time to before the current time
    overrideInfo = {
      date: timeNow.startOf('day'),
      open: existingConfig.open,
      close: 14,
      openingBuffer: existingConfig.openingBuffer,
      closingBuffer: existingConfig.closingBuffer,
      hourlyCapacity: 4,
    };
    const alreadyClosedSchedule = addOverrides(scheduleExtension, [overrideInfo]);
    walkinOpen = isWalkinOpen(alreadyClosedSchedule, timezone, timeNow);
    expect(walkinOpen).toBe(false);
  });
});
