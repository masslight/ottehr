import { DateTime } from 'luxon';
import {
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
  setSlotLengthInMinutes,
  startOfDayWithTimezone,
} from '../helpers/testScheduleUtils';

describe('slot availability tests', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

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

    const startDate = startOfDayWithTimezone({ timezone });

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
      now: startDate,
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

    const startDate = startOfDayWithTimezone({ timezone });

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

    const startDate = startOfDayWithTimezone({ timezone });

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

    // slots are de-duplicated before being returned by getAvailableSlots, so we check the capacity map
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

    const startDate = startOfDayWithTimezone({ timezone });

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

    const startDate = startOfDayWithTimezone({ timezone });

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
    const startDate = startOfDayWithTimezone({ timezone });
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity7 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 7);
    const capacity7Map = getAllSlotsAsCapacityMap({
      now: startDate,
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
      now: startDate,
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
    const startDate = startOfDayWithTimezone();
    const tomorrow = startDate.startOf('day').plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity2 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 2);
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
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
      now: startDate,
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
    const startDate = startOfDayWithTimezone();
    const tomorrow = startDate.plus({ days: 1 });
    let now = DateTime.fromISO(startDate.toISO()!, { zone: timezone });
    const scheduleExtensionCapacity6 = changeAllCapacities(DEFAULT_SCHEDULE_JSON, 6);
    const capacityMap = getAllSlotsAsCapacityMap({
      now: startDate,
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
      now: startDate,
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

    const startDate = startOfDayWithTimezone({ timezone });

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
      now: startDate,
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

    const startDate = startOfDayWithTimezone({ timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
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

    const startDate = startOfDayWithTimezone();

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
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
      now: startDate,
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

    const startDate = startOfDayWithTimezone({ timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
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

    const startDate = startOfDayWithTimezone({ timezone });

    const getSlotsInput: GetAvailableSlotsInput = {
      now: startDate,
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
      now = now.plus({ minutes: 60 });
    }
  });
});
