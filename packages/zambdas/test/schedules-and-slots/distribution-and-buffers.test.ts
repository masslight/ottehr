import { DateTime } from 'luxon';
import {
  DOW,
  getAllSlotsAsCapacityMap,
  getAvailableSlots,
  GetAvailableSlotsInput,
  getPostTelemedSlots,
  getScheduleExtension,
  getTimezone,
} from 'utils';
import { assert, vi } from 'vitest';
import { DEFAULT_TEST_TIMEOUT } from '../appointment-validation.test';
import {
  applyBuffersToScheduleExtension,
  changeAllCapacities,
  DEFAULT_SCHEDULE_JSON,
  makeSchedule,
  setClosingHourForAllDays,
  setSlotLengthInMinutes,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

describe('slot availability tests', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  // Use a fixed date that doesn't fall on a DST transition to avoid flaky slot count assertions.
  // January 6, 2025 is a Monday in America/New_York with no DST change.
  const NON_DST_DATE = DateTime.fromISO('2025-01-06T00:00:00', { zone: 'America/New_York' });

  it('24/7 schedule with capacity divisible by 4 should make n/4 slots available every 15 minutes', () => {
    const schedule = makeSchedule({ scheduleObject: DEFAULT_SCHEDULE_JSON });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(DEFAULT_SCHEDULE_JSON));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96); // 24 hours * 4 slots per hour
    let tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    tomorrow = now.plus({ days: 1 });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      if (capacity === undefined) {
        expect(now.toISO()!).toBe('hello');
      }
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 15 });
    }

    // double the capacity and do the same checks
    const scheduleExtensionDoubleCapacity = changeAllCapacities(scheduleExtension, 8);
    const doubleCapacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionDoubleCapacity,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = doubleCapacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(2);
      now = now.plus({ minutes: 15 });
    }
    const schedule2 = makeSchedule({ scheduleObject: scheduleExtensionDoubleCapacity });
    expect(schedule2).toBeDefined();

    const getSlotsInput2: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
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

  it('for a 24/7 schedule, should have post-telemed slots available every 30 minutes on the hour and half hour, open to close', () => {
    const schedule = makeSchedule({ scheduleObject: DEFAULT_SCHEDULE_JSON });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(DEFAULT_SCHEDULE_JSON));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const ptmSlots = getPostTelemedSlots(startDate, schedule, []);
    expect(ptmSlots).toBeDefined();
    expect(ptmSlots.length).toEqual(96); // 24 hours * 4 slots per hour

    const expectedList = [];
    const dayAfterTomorrow = startDate.plus({ days: 2 });
    let now = startDate.startOf('day');
    while (now < dayAfterTomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 30 });
    }
    expect(expectedList.length).toEqual(96);
    expect(ptmSlots).toEqual(expectedList);
  });

  it('opening buffers should remove slots from the beginning of the available slots list as expected', () => {
    const bufferedSchedule = applyBuffersToScheduleExtension(DEFAULT_SCHEDULE_JSON, {
      openingBuffer: 30,
    });
    const schedule = makeSchedule({ scheduleObject: bufferedSchedule });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
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

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
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

  it('closing buffers should remove slots from the end of the available slots list as expected', () => {
    const bufferedSchedule = applyBuffersToScheduleExtension(DEFAULT_SCHEDULE_JSON, {
      closingBuffer: 30,
    });
    const schedule = makeSchedule({ scheduleObject: bufferedSchedule });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
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
      now: startDate.setZone('UTC'),
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

  it('24/7 schedule where 4 % capacity == 1 && capacity < 4 will skip the slot on the 45th minute when distributing the last 3 slots', () => {
    // if we have capacity = 3 and need to distribute those slots in 15 minute windows across a single hour
    const scheduleAdjusted = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 3);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
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

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
    // to verify that the number of slots in each time slot is correct
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      if (now.minute !== 45) {
        const capacity = capacityMap[now.toISO()!];
        expect(capacity).toBeDefined();
        expect(capacity).toEqual(1);
      }
      now = now.plus({ minutes: 15 });
    }
  });

  it('24/7 schedule where 4 % capacity == 1 && capacity > 4 will skip the slot on the 45th minute when distributing the last 3 slots', () => {
    // if we have capacity = 7 and need to distribute the last 3 slots in 15 minute windows across a single hour
    const timezone = 'America/New_York';
    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity7 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 7);
    const capacity7Map = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionCapacity7,
      timezone,
    });

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
    const schedule = makeSchedule({ scheduleObject: scheduleExtensionCapacity7 });
    expect(schedule).toBeDefined();

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // available slots deduplicates, so we expect the same number of slots as before
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);
  });

  it('24/7 schedule where 4 % capacity == 2 && capacity > 4 will skip the slots on the 15th and 45th minutes when distributing the slots', () => {
    const timezone = 'America/New_York';
    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE });
    const tomorrow = startDate.startOf('day').plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity2 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 2);
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionCapacity2,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      if (now.minute === 0 || now.minute === 30) {
        if (capacity !== 1) {
          console.log('now logged', now.toISO());
        }
        expect(capacity).toEqual(1);
      } else {
        expect(capacity).toEqual(0);
      }
      now = now.plus({ minutes: 15 });
    }
    const schedule = makeSchedule({ scheduleObject: scheduleExtensionCapacity2 });
    expect(schedule).toBeDefined();

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // available slots deduplicates, so we expect the same number of slots as before
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(48);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      if (now.minute !== 45 && now.minute !== 15) {
        expectedList.push(now.toISO());
      }
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(48);
    expect(availableSlots).toEqual(expectedList);
  });

  it('24/7 schedule where 4 % capacity == 2 && capacity < 4 will skip the slots on the 15th and 45th minutes when distributing the slots', () => {
    const timezone = 'America/New_York';
    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE });
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity6 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 6);
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension: scheduleExtensionCapacity6,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      if (now.minute !== 45 && now.minute !== 15) {
        expect(capacity).toEqual(2);
      } else {
        expect(capacity).toEqual(1);
      }
      now = now.plus({ minutes: 15 });
    }
    const schedule = makeSchedule({ scheduleObject: scheduleExtensionCapacity6 });
    expect(schedule).toBeDefined();

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }
    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);
  });

  it('huge capacity test', async () => {
    const scheduleAdjusted = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 100000);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);
    expect(JSON.stringify(scheduleExtension)).toEqual(JSON.stringify(scheduleAdjusted));
    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(96);
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 15 });
    }

    expect(expectedList.length).toEqual(96);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(25000);
      now = now.plus({ minutes: 15 });
    }
  });
  it('should produce 1 slot every 30 minutes, on the hour and half hour, when slot-length is 30 minutes and capacity is 2', async () => {
    const scheduleAdjusted = setSlotLengthInMinutes(changeAllCapacities(DEFAULT_SCHEDULE_JSON, 2), 30);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(48); // 24 hours * 2 slots per hour
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 30 });
    }

    expect(expectedList.length).toEqual(48);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });
    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 30 });
    }
  });

  it('should produce 2 slots every 30 minutes, on the hour and half hour, when slot-length is 30 minutes and capacity is 4', async () => {
    const scheduleAdjusted = setSlotLengthInMinutes(changeAllCapacities(DEFAULT_SCHEDULE_JSON, 4), 30);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(48); // 24 hours * 2 slots per hour
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 30 });
    }

    expect(expectedList.length).toEqual(48);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(2);
      now = now.plus({ minutes: 30 });
    }
  });

  it('should produce 1 slot every hour on the hour when slot-length is 30 minutes and capacity is 1', async () => {
    const scheduleAdjusted = setSlotLengthInMinutes(changeAllCapacities(DEFAULT_SCHEDULE_JSON, 1), 30);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(24);
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 60 });
    }

    expect(expectedList.length).toEqual(24);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 60 });
    }
  });

  it('should produce 1 slot every hour on the hour when slot-length is 60 minutes and capacity is 1', async () => {
    const scheduleAdjusted = setSlotLengthInMinutes(changeAllCapacities(DEFAULT_SCHEDULE_JSON, 1), 60);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    expect(availableSlots.length).toEqual(24);
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });

    const expectedList = [];

    while (now < tomorrow) {
      expectedList.push(now.toISO());
      now = now.plus({ minutes: 60 });
    }

    expect(expectedList.length).toEqual(24);
    expect(availableSlots).toEqual(expectedList);

    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate.setZone('UTC'),
      finishDate: startDate.plus({ days: 1 }),
      scheduleExtension,
      timezone,
    });

    now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    while (now < tomorrow) {
      const capacity = capacityMap[now.toISO()!];
      expect(capacity).toBeDefined();
      expect(capacity).toEqual(1);
      now = now.plus({ minutes: 60 });
    }
  });

  it('should make slots available up until the last 45 minute slot when there is no buffer and no busy slots', async () => {
    const scheduleAdjusted = setClosingHourForAllDays(DEFAULT_SCHEDULE_JSON, 22);
    const schedule = makeSchedule({ scheduleObject: scheduleAdjusted, timezone: 'America/Chicago' });
    expect(schedule).toBeDefined();
    expect(schedule.id).toBeDefined();

    const scheduleExtension = getScheduleExtension(schedule);
    expect(scheduleExtension).toBeDefined();
    assert(scheduleExtension);

    const timezone = getTimezone(schedule);
    expect(timezone).toBeDefined();

    const startDate = DateTime.now().setZone(timezone).set({ hour: 21, minute: 10, second: 0 });

    console.log('startDate', startDate.toISO(), startDate.weekdayLong);
    const close = scheduleExtension.schedule[startDate.weekdayLong!.toLowerCase() as DOW].close;
    console.log('close', close);
    expect(close).toBeDefined();
    expect(close).toEqual(22);

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate.setZone('UTC'),
      schedule: schedule,
      numDays: 1,
      busySlots: [],
    };

    // this gives us a list of strings representing the start time of some 15 minute slots
    const availableSlots = getAvailableSlots(getSlotsInput);
    expect(availableSlots).toBeDefined();
    console.log('availableSlots', availableSlots);
    const last3Slots = availableSlots.slice(-3);
    expect(last3Slots.length).toEqual(3);
    const startString = startDate.toISO()!.split(':')[0];
    const endString = startDate.toISO()!.split('-').pop()!;
    expect(last3Slots[0]).toEqual(`${startString}:15:00.000-${endString}`);
    expect(last3Slots[1]).toEqual(`${startString}:30:00.000-${endString}`);
    expect(last3Slots[2]).toEqual(`${startString}:45:00.000-${endString}`);
  });

  // Existing tests above cover buffers + the legacy 15-min slot length (the
  // per-hour bucket path). The following exercise the same buffer feature
  // on the session-based path (super-hour slot lengths and explicit
  // cadence). applyBuffersToSlots gets slotLengthMinutes passed through
  // and trims by slot-end (not slot-start), so a 90-min slot whose end
  // would fall past close − closingBuffer is excluded even when its start
  // is still inside the open window.
  describe('buffers + session-based slot path (super-hour slot length / explicit cadence)', () => {
    // 24/7 schedule → effective close at 23:30 (with 30-min closing buffer),
    // effective open at 00:30 (with 30-min opening buffer). Easy to assert
    // exact slot counts and the first/last slot times.

    const makeBufferedSchedule = (opts: {
      openingBuffer?: number;
      closingBuffer?: number;
    }): ReturnType<typeof makeSchedule> => {
      const bufferedJson = applyBuffersToScheduleExtension(DEFAULT_SCHEDULE_JSON, {
        openingBuffer: opts.openingBuffer ?? 0,
        closingBuffer: opts.closingBuffer ?? 0,
      });
      return makeSchedule({ scheduleObject: bufferedJson });
    };

    const minutesFromMidnight = (iso: string, timezone: string): number => {
      const dt = DateTime.fromISO(iso, { zone: timezone });
      return dt.hour * 60 + dt.minute;
    };

    it('90-min slot + 30-min closing buffer: last admissible start is 22:00 (ends 23:30 = close − buffer); 22:30 is excluded', () => {
      const schedule = makeBufferedSchedule({ closingBuffer: 30 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 90,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // Default cadence for 90 = gcd(90, 60) = 30. Slot ends ≤ 23:30 → starts ≤ 22:00.
      // Starts at 0, 30, 60, …, 22*60 = 1320 → 45 entries.
      expect(minutes.length).toBe(45);
      expect(minutes[0]).toBe(0);
      expect(minutes[minutes.length - 1]).toBe(22 * 60);
      // Negative assertion: the 22:30 start (whose end would be 24:00,
      // strictly past close − buffer = 23:30) must not appear.
      expect(minutes).not.toContain(22 * 60 + 30);
    });

    it('90-min slot + 30-min opening buffer: first admissible start is 00:30 (open + buffer); 00:00 is excluded', () => {
      const schedule = makeBufferedSchedule({ openingBuffer: 30 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 90,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // 46 candidates (0, 30, …, 1350) − 1 trimmed by opening buffer (0:00).
      expect(minutes.length).toBe(45);
      expect(minutes[0]).toBe(30);
      expect(minutes[minutes.length - 1]).toBe(22 * 60 + 30);
      expect(minutes).not.toContain(0);
    });

    it('90-min slot + 30-min opening AND closing buffers: window narrows on both ends; 00:00 and 22:30 are excluded', () => {
      const schedule = makeBufferedSchedule({ openingBuffer: 30, closingBuffer: 30 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 90,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // First start 0:30 (open + 30). Last start 22:00 (close − 30 − slot 90).
      // Starts every 30 from 30 to 1320 inclusive → 44 entries.
      expect(minutes.length).toBe(44);
      expect(minutes[0]).toBe(30);
      expect(minutes[minutes.length - 1]).toBe(22 * 60);
      expect(minutes).not.toContain(0);
      expect(minutes).not.toContain(22 * 60 + 30);
    });

    it('45-min slot + 30-min closing buffer: default cadence 15; last start 22:45, 23:00 excluded', () => {
      const schedule = makeBufferedSchedule({ closingBuffer: 30 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 45,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // Default cadence = gcd(45, 60) = 15. Slot ends ≤ 23:30 → starts ≤ 22:45.
      // 22:45 = 1365 min; offsets 0, 15, …, 1365 → 92 entries.
      expect(minutes.length).toBe(92);
      expect(minutes[minutes.length - 1]).toBe(22 * 60 + 45);
      // 23:00 start (ends 23:45 > 23:30) must not appear.
      expect(minutes).not.toContain(23 * 60);
    });

    it('100-min slot + 20-min closing buffer (odd-divisor sanity): default cadence 20; last start 22:00, 22:20 excluded', () => {
      const schedule = makeBufferedSchedule({ closingBuffer: 20 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 100,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // Default cadence = gcd(100, 60) = 20. Effective close 24:00 − 20 = 23:40.
      // Slot ends ≤ 23:40 → starts ≤ 22:00 (22:00 + 100 = 23:40 exactly).
      // Offsets 0, 20, 40, …, 1320 → 67 entries.
      expect(minutes.length).toBe(67);
      expect(minutes[minutes.length - 1]).toBe(22 * 60);
      // 22:20 start (ends 24:00 > 23:40) must not appear.
      expect(minutes).not.toContain(22 * 60 + 20);
    });

    it('90-min slot with explicit cadence=15 + 30-min closing buffer: cadence is honored AND buffer trims the tail', () => {
      const schedule = makeBufferedSchedule({ closingBuffer: 30 });
      const timezone = getTimezone(schedule);
      assert(timezone);
      const startDate = startOfDayWithTimezone({ date: NON_DST_DATE, timezone });

      const availableSlots = getAvailableSlots({
        now: startDate.setZone('UTC'),
        schedule,
        numDays: 1,
        busySlots: [],
        slotLengthMinutes: 90,
        cadenceMinutes: 15,
      });

      const minutes = availableSlots.map((iso) => minutesFromMidnight(iso, timezone));
      // With explicit cadence=15, stride is 15. Effective close 23:30 → max
      // start 22:00 (ends 23:30). Offsets 0, 15, …, 1320 → 89 entries.
      expect(minutes.length).toBe(89);
      expect(minutes[0]).toBe(0);
      expect(minutes[1] - minutes[0]).toBe(15); // confirm cadence is honored, not gcd default of 30
      expect(minutes[minutes.length - 1]).toBe(22 * 60);
      // Both 22:15 (offset 1335 → ends 23:45 > 23:30) and 22:30 (ends 24:00)
      // must be excluded by the buffer despite being on the cadence grid.
      expect(minutes).not.toContain(22 * 60 + 15);
      expect(minutes).not.toContain(22 * 60 + 30);
    });
  });
});
