import Oystehr from '@oystehr/sdk';
import { assert, vi } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import { randomUUID } from 'crypto';
import {
  addOverrides,
  changeAllCapacities,
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  getScheduleDay,
  makeSchedule,
  OverrideScheduleConfig,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';
import { Capacity, getAllSlotsAsCapacityMap, getAvailableSlots, GetAvailableSlotsInput, getTimezone } from 'utils';
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

  it('dummy copy paste test to be replaced', () => {
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
