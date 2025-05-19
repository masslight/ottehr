import Oystehr from '@oystehr/sdk';
import { assert, vi } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import { randomUUID } from 'crypto';
import {
  addClosureDay,
  addClosurePeriod,
  adjustHoursOfOperation,
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  DEFAULT_TEST_TIMEZONE,
  HoursOfOpConfig,
  makeSchedule,
} from '../helpers/testScheduleUtils';
import { getAllSlotsAsCapacityMap, getAvailableSlots, GetAvailableSlotsInput, getTimezone } from 'utils';
import { DateTime } from 'luxon';

describe('closure and override tests', () => {
  let oystehr: Oystehr | null = null;
  let token = null;
  let processId: string | null = null;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
  });
  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    await cleanupTestScheduleResources(processId, oystehr);
  });

  it('one day closure today results in no slots for today but all slots for tomorrow', () => {
    const startDate = DateTime.now().setZone(DEFAULT_TEST_TIMEZONE).startOf('day');
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

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
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
    const startDate = DateTime.now().setZone(DEFAULT_TEST_TIMEZONE).startOf('day');
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

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
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
    const startDate = DateTime.now().setZone(DEFAULT_TEST_TIMEZONE).startOf('day');
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

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
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
    const startDate = DateTime.now().setZone(DEFAULT_TEST_TIMEZONE).startOf('day');
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

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
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
    const startDate = DateTime.now().setZone(DEFAULT_TEST_TIMEZONE).startOf('day');
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

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
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
  it('Open override makes slots available where they would not otherwise be', () => {
    const startTime = DateTime.now().startOf('day').setZone(DEFAULT_TEST_TIMEZONE).set({ hour: 11 });
    const todayDoW = startTime.weekdayLong?.toLocaleLowerCase();
    assert(todayDoW);
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 16, close: 22, workingDay: true }];
    const scheduleExtension = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, hoursInfo);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
    const schedule = makeSchedule({ scheduleObject: scheduleExtension });
    const timezone = getTimezone(schedule);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startTime,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();

    // first we verify that there are no slots available until 16:00
    const earliestExpectedSlot = startTime.plus({ hours: 5 }).startOf('hour');
    availableSlots.forEach((slot) => {
      const slotDateTime = DateTime.fromISO(slot, { zone: timezone });
      expect(slotDateTime >= earliestExpectedSlot).toBeTruthy();
    });
    /*const overrideInfo = {
      date: DateTime.now().startOf('day').set({ hour: 11 }),
      open: 9 as HourOfDay,
      close: 12 as HourOfDay,
      openingBuffer: 0,
      closingBuffer: 0,
      hourlyCapacity: 15,
    };*/
    // const { schedule, location } = makeLocationWithSchedule(hoursInfo, 15, 0, 0, overrideInfo);
  });
});
