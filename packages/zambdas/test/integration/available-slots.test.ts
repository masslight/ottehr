import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { assert, vi } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import { Schedule } from 'fhir/r4b';
import { randomUUID } from 'crypto';
import {
  applyBuffersToScheduleExtension,
  changeAllCapacities,
  DEFAULT_SCHEDULE_JSON,
  makeSchedule,
  tagForProcessId,
} from '../helpers/testScheduleUtils';
import {
  getAllSlotsAsCapacityMap,
  getAvailableSlots,
  GetAvailableSlotsInput,
  getScheduleExtension,
  getTimezone,
  ScheduleExtension,
} from 'utils';
import { DateTime } from 'luxon';

describe('slot availability tests', () => {
  let oystehr: Oystehr | null = null;
  let token = null;
  let processId: string | null = null;
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  const persistSchedule = async (scheduleExtension: ScheduleExtension, oystehr: Oystehr): Promise<Schedule> => {
    if (processId === null) {
      throw new Error('processId is null');
    }
    const resource = {
      ...makeSchedule({
        processId,
        scheduleObject: scheduleExtension,
      }),
      id: undefined,
    };

    const schedule = await oystehr.fhir.create<Schedule>(resource);
    console.log('schedule', JSON.stringify(schedule, null, 2));
    return schedule;
  };

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
    const schedules = (
      await oystehr.fhir.search<Schedule>({
        resourceType: 'Schedule',
        params: [
          {
            name: '_tag',
            value: tagForProcessId(processId),
          },
        ],
      })
    ).unbundle();

    const deleteRequests: BatchInputDeleteRequest[] = schedules.map((schedule) => {
      return {
        method: 'DELETE',
        url: `Schedule/${schedule.id}`,
      };
    });
    try {
      await oystehr.fhir.batch({ requests: deleteRequests });
    } catch (error) {
      console.error('Error deleting schedules', error);
      console.log(`ProcessId ${processId} may need manual cleanup`);
    }
  });

  it('24/7 schedule with capacity divisible by 4 should make n/4 slots available every 15 minutes', async () => {
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const schedule = await persistSchedule(DEFAULT_SCHEDULE_JSON, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(DEFAULT_SCHEDULE_JSON));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).startOf('day');

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96); // 24 hours * 4 slots per hour
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
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
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }

    // double the capicity and do the same checks
    const scheduleExtensionDoubleCapacity = changeAllCapacities(scheduleExtension, 8);
    const doubleCapacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionDoubleCapacity,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    console.log('doubleCapacityMap', doubleCapacityMap);
    while (now < tomorrow) {
      const capacity = doubleCapacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(2);
      now = now.plus({ minutes: 15 });
    }
    const schedule2 = await persistSchedule(scheduleExtensionDoubleCapacity, oystehr);
    expect(schedule2).toBeDefined();

    const getSlotsInput2: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule2,
      numDays: 1,
      busySlots: [],
    };

    // available slots deduplicates, so we expect the same number of slots as before
    const availableSlots2 = getAvailableSlots(getSlotsInput2);
    expect(availableSlots2).toBeDefined();
    expect(availableSlots2.length).toEqual(96); // 24 hours * 4 slots per hour
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList2 = [];

    while (now < tomorrow) {
      expectedList2.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList2.length).toEqual(96);
    expect(availableSlots2).toEqual(expectedList);
  });

  it('opening buffers should remove slots from the beginning of the available slots list as expected', async () => {
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const bufferedSchedule = applyBuffersToScheduleExtension(DEFAULT_SCHEDULE_JSON, {
      openingBuffer: 30,
    });
    const schedule = await persistSchedule(bufferedSchedule, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).startOf('day');

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(94); // 24 hours * 4 slots per hour - 2 slots for the opening buffer
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone }).plus({ minutes: 30 });
    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(94);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone }).plus({ minutes: 30 });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }
  });
  it('closing buffers should remove slots from the end of the available slots list as expected', async () => {
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const bufferedSchedule = applyBuffersToScheduleExtension(DEFAULT_SCHEDULE_JSON, {
      closingBuffer: 30,
    });
    const schedule = await persistSchedule(bufferedSchedule, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).startOf('day');

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(94); // 24 hours * 4 slots per hour - 2 slots for the closing buffer
    const tomorrow = startDate.plus({ days: 1 }).minus({ minutes: 30 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(94);
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
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }
  });

  it('24/7 schedule with capacity % 4 = 1 will skip the slot on the 45th minute when distributing the last 3 slots', async () => {
    // if we have capacity = 3 and need to distribute those slots in 15 minute windows accross a single hour
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const scheduleAdjusted = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 3);
    const schedule = await persistSchedule(scheduleAdjusted, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).startOf('day');

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(72); // 24 hours * 3 slots per hour
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      if (now.minute !== 45) {
        expectedList.push(now.toISO());
      }
      now = now.plus({ minutes: 15 });
    }

    expect(expectedList.length).toEqual(72);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before beinf returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    console.log('capacity3map', capacityMap);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      if (now.minute !== 45) {
        const capacity = capacityMap[now.toISO()!];
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      }
      now = now.plus({ minutes: 15 });
    }

    const scheduleExtensionCapacity7 = changeAllCapacities(scheduleExtension, 7);
    const capacity7Map = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionCapacity7,
      timezone,
    });
    console.log('capacity7map', capacity7Map);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacity7Map[now.toISO()!];
      expect(capacity).toBeDefined();
      if (now.minute !== 45) {
        expect(capacity).toEqual(2);
      } else {
        expect(capacity).toEqual(1);
      }
      now = now.plus({ minutes: 15 });
    }
    const schedule2 = await persistSchedule(scheduleExtensionCapacity7, oystehr);
    expect(schedule2).toBeDefined();

    const getSlotsInput2: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule2,
      numDays: 1,
      busySlots: [],
    };

    // available slots deduplicates, so we expect the same number of slots as before
    const availableSlots2 = getAvailableSlots(getSlotsInput2);
    expect(availableSlots2).toBeDefined();
    expect(availableSlots2.length).toEqual(96);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList2 = [];

    while (now < tomorrow) {
      expectedList2.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList2.length).toEqual(96);
    expect(availableSlots2).toEqual(expectedList2);
  });

  it('huge capacity test', async () => {
    // if we have capacity = 3 and need to distribute those slots in 15 minute windows accross a single hour
    if (!oystehr) {
      throw new Error('oystehr is null');
    }
    const scheduleAdjusted = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 1000);
    const schedule = await persistSchedule(scheduleAdjusted, oystehr);
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).startOf('day');

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96); // 24 hours * 3 slots per hour
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
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
    console.log('capacity map', capacityMap);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(250);
      now = now.plus({ minutes: 15 });
    }
  });
});
