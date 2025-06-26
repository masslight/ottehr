import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getAllSlotsAsCapacityMap,
  getAvailableSlots,
  getAvailableSlotsForSchedules,
  GetAvailableSlotsInput,
  getScheduleExtension,
  getSlotsInWindow,
  GetSlotsInWindowInput,
  getTimezone,
  SlotServiceCategory,
} from 'utils';
import { assert, vi } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import { SECRETS } from '../data/secrets';
import {
  adjustHoursOfOperation,
  changeAllCapacities,
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  persistSchedule,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

describe('busy slots tests', () => {
  let oystehr: Oystehr;
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

  it('when capacity is 1, no slot will be available for an hour that has a booked slot', async () => {
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const { schedule } = await persistSchedule({ scheduleExtension: adjustedScheduleJSON, processId }, oystehr);
    expect(schedule.id).toBeDefined();
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);

    const startDate = startOfDayWithTimezone({ timezone });

    let getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // verify that the schedule is set up correctly
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(10);

    let now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const close = now.plus({ hours: 10 });

    const expectedList = [];

    while (now < close) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 60 });
    }

    expect(expectedList.length).toEqual(10);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    while (now < close) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 60 });
    }

    // book some slots and verify that they're no no longer available in the slot list
    const bookedSlotTimes = [
      timeNow.plus({ hours: 1 }).toISO()!,
      timeNow.plus({ hours: 2 }).toISO()!,
      timeNow.plus({ hours: 4 }).toISO()!,
      timeNow.plus({ hours: 7 }).toISO()!,
    ];

    const slotInputs: BatchInputPostRequest<Slot>[] = bookedSlotTimes.map((time) => ({
      method: 'POST',
      resource: {
        resourceType: 'Slot',
        status: 'busy',
        start: time,
        end: DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO()!,
        serviceCategory: [SlotServiceCategory.inPersonServiceMode],
        schedule: {
          reference: `Schedule/${schedule.id}`,
        },
      },
      url: '/Slot',
    }));
    await oystehr.fhir.batch({ requests: slotInputs });

    const getBusySlotsInput: GetSlotsInWindowInput = {
      scheduleIds: [schedule.id],
      fromISO: startDate.toISO()!,
      toISO: startDate.plus({ days: 1 }).toISO()!,
      status: ['busy'],
    };
    const allBusySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);
    expect(allBusySlots).toBeDefined();
    expect(allBusySlots.length).toEqual(4);

    getSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: allBusySlots,
    };
    const availableSlots2 = getAvailableSlots(getSlotsInput);
    expect(availableSlots2).toBeDefined();
    expect(availableSlots2.length).toEqual(6);

    now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const expectedList2 = [];
    while (now < close) {
      if (!bookedSlotTimes.includes(now.toISO()!)) {
        expectedList2.push(now.toISO());
      }
      now = now.plus({ minutes: 60 });
    }
    expect(expectedList2.length).toEqual(6);
    expect(availableSlots2).toEqual(expectedList2);
  });

  it('removes busy slots from list returned by getAvailableSlotsForSchedules', async () => {
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'BusySlotsTestLocation',
      description: 'We only just met but I will be gone soon',
      address: {
        use: 'work',
        type: 'physical',
        line: ['12345 Test St'],
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
      },
      telecom: [
        {
          system: 'phone',
          use: 'work',
          value: '1234567890',
        },
        {
          system: 'url',
          use: 'work',
          value: 'https://example.com',
        },
      ],
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    expect(schedule.id).toBeDefined();
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);
    expect(owner).toBeDefined();
    assert(owner);

    const startDate = startOfDayWithTimezone({ timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // verify that the schedule is set up correctly
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(10);

    let now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const close = now.plus({ hours: 10 });

    const expectedList = [];

    while (now < close) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 60 });
    }

    expect(expectedList.length).toEqual(10);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    while (now < close) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 60 });
    }

    // book some slots and verify that they're no no longer available in the slot list
    const bookedSlotTimes = [
      timeNow.plus({ hours: 1 }).toISO()!,
      timeNow.plus({ hours: 2 }).toISO()!,
      timeNow.plus({ hours: 4 }).toISO()!,
      timeNow.plus({ hours: 7 }).toISO()!,
    ];

    const slotInputs: BatchInputPostRequest<Slot>[] = bookedSlotTimes.map((time) => ({
      method: 'POST',
      resource: {
        resourceType: 'Slot',
        status: 'busy',
        start: time,
        end: DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO()!,
        serviceCategory: [SlotServiceCategory.inPersonServiceMode],
        schedule: {
          reference: `Schedule/${schedule.id}`,
        },
      },
      url: '/Slot',
    }));
    await oystehr.fhir.batch({ requests: slotInputs });

    const getBusySlotsInput: GetSlotsInWindowInput = {
      scheduleIds: [schedule.id],
      fromISO: startDate.toISO()!,
      toISO: startDate.plus({ days: 1 }).toISO()!,
      status: ['busy'],
    };
    const allBusySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);
    expect(allBusySlots).toBeDefined();
    expect(allBusySlots.length).toEqual(4);

    const availableSlots2 = (
      await getAvailableSlotsForSchedules(
        {
          scheduleList: [{ schedule, owner }],
          now: timeNow,
          numDays: 1,
        },
        oystehr
      )
    ).availableSlots;

    expect(availableSlots2).toBeDefined();
    const slotStartTimes = availableSlots2.map((si) => si.slot.start);
    expect(slotStartTimes.length).toEqual(6);

    now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const expectedList2 = [];
    while (now < close) {
      if (!bookedSlotTimes.includes(now.toISO()!)) {
        expectedList2.push(now.toISO());
      }
      now = now.plus({ minutes: 60 });
    }
    expect(expectedList2.length).toEqual(6);
    expect(slotStartTimes).toEqual(expectedList2);
  });
  it('removes busy-tentative and busy-unavailable slots from list returned by getAvailableSlotsForSchedules', async () => {
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'BusySlotsTestLocation',
      description: 'We only just met but I will be gone soon',
      address: {
        use: 'work',
        type: 'physical',
        line: ['12345 Test St'],
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
      },
      telecom: [
        {
          system: 'phone',
          use: 'work',
          value: '1234567890',
        },
        {
          system: 'url',
          use: 'work',
          value: 'https://example.com',
        },
      ],
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    expect(schedule.id).toBeDefined();
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);
    expect(owner).toBeDefined();
    assert(owner);

    // book some slots and verify that they're no no longer available in the slot list
    const bookedSlotTimes = [
      timeNow.plus({ hours: 1 }).toISO()!,
      timeNow.plus({ hours: 2 }).toISO()!,
      timeNow.plus({ hours: 4 }).toISO()!,
      timeNow.plus({ hours: 7 }).toISO()!,
    ];

    const slotInputs: BatchInputPostRequest<Slot>[] = bookedSlotTimes.map((time, idx) => ({
      method: 'POST',
      resource: {
        resourceType: 'Slot',
        status: idx % 2 === 0 ? 'busy-tentative' : 'busy-unavailable',
        start: time,
        end: DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO()!,
        serviceCategory: [SlotServiceCategory.inPersonServiceMode],
        schedule: {
          reference: `Schedule/${schedule.id}`,
        },
      },
      url: '/Slot',
    }));
    await oystehr.fhir.batch({ requests: slotInputs });

    const startDate = startOfDayWithTimezone({ timezone });
    const getBusySlotsInput: GetSlotsInWindowInput = {
      scheduleIds: [schedule.id],
      fromISO: startDate.toISO()!,
      toISO: startDate.plus({ days: 1 }).toISO()!,
      status: ['busy-tentative', 'busy-unavailable'],
    };
    const allBusySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);
    expect(allBusySlots).toBeDefined();
    expect(allBusySlots.length).toEqual(4);

    const availableSlots = (
      await getAvailableSlotsForSchedules(
        {
          scheduleList: [{ schedule, owner }],
          now: timeNow,
          numDays: 1,
        },
        oystehr
      )
    ).availableSlots;

    expect(availableSlots).toBeDefined();
    const slotStartTimes = availableSlots.map((si) => si.slot.start);
    expect(slotStartTimes.length).toEqual(6);

    let now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const close = now.plus({ hours: 10 });
    const expectedList = [];
    while (now < close) {
      if (!bookedSlotTimes.includes(now.toISO()!)) {
        expectedList.push(now.toISO());
      }
      now = now.plus({ minutes: 60 });
    }
    expect(expectedList.length).toEqual(6);
    expect(slotStartTimes).toEqual(expectedList);
  });
  it('makes busy-tentative slots available again after 10 minutes', async () => {
    const timeNow = startOfDayWithTimezone().plus({ hours: 8 });

    let adjustedScheduleJSON = adjustHoursOfOperation(DEFAULT_SCHEDULE_JSON, [
      {
        dayOfWeek: timeNow.toLocaleString({ weekday: 'long' }).toLowerCase(),
        open: 8,
        close: 18,
        workingDay: true,
      },
    ]);

    adjustedScheduleJSON = changeAllCapacities(adjustedScheduleJSON, 1);

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'BusySlotsTestLocation',
      description: 'We only just met but I will be gone soon',
      address: {
        use: 'work',
        type: 'physical',
        line: ['12345 Test St'],
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
      },
      telecom: [
        {
          system: 'phone',
          use: 'work',
          value: '1234567890',
        },
        {
          system: 'url',
          use: 'work',
          value: 'https://example.com',
        },
      ],
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    expect(schedule.id).toBeDefined();
    assert(schedule.id);
    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    const timezone = getTimezone(schedule);
    expect(owner).toBeDefined();
    assert(owner);

    // book some slots and verify that they're no no longer available in the slot list
    const bookedSlotTimes = [
      timeNow.plus({ hours: 1 }).toISO()!,
      timeNow.plus({ hours: 2 }).toISO()!,
      timeNow.plus({ hours: 4 }).toISO()!,
      timeNow.plus({ hours: 7 }).toISO()!,
    ];

    const slotInputs: BatchInputPostRequest<Slot>[] = bookedSlotTimes.map((time) => ({
      method: 'POST',
      resource: {
        resourceType: 'Slot',
        status: 'busy-tentative',
        start: time,
        end: DateTime.fromISO(time, { zone: timezone }).plus({ minutes: 15 }).toISO()!,
        serviceCategory: [SlotServiceCategory.inPersonServiceMode],
        schedule: {
          reference: `Schedule/${schedule.id}`,
        },
      },
      url: '/Slot',
    }));
    await oystehr.fhir.batch({ requests: slotInputs });

    const startDate = startOfDayWithTimezone({ timezone });
    const getBusySlotsInput: GetSlotsInWindowInput = {
      scheduleIds: [schedule.id],
      fromISO: startDate.toISO()!,
      toISO: startDate.plus({ days: 1 }).toISO()!,
      status: ['busy-tentative'],
    };
    const allBusySlots = await getSlotsInWindow(getBusySlotsInput, oystehr);
    expect(allBusySlots).toBeDefined();
    expect(allBusySlots.length).toEqual(4);

    const availableSlots = (
      await getAvailableSlotsForSchedules(
        {
          scheduleList: [{ schedule, owner }],
          now: timeNow,
          numDays: 1,
          slotExpirationBiasInSeconds: -10 * 60 - 2,
        },
        oystehr
      )
    ).availableSlots;

    expect(availableSlots).toBeDefined();
    const slotStartTimes = availableSlots.map((si) => si.slot.start);
    expect(slotStartTimes.length).toEqual(10);

    let now = DateTime.fromISO(timeNow.toISO()!, { zone: timezone });
    const close = now.plus({ hours: 10 });
    const expectedList = [];
    while (now < close) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 60 });
    }
    expect(expectedList.length).toEqual(10);
    expect(slotStartTimes).toEqual(expectedList);
  });
});
