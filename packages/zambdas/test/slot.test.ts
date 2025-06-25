/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomUUID } from 'crypto';
import { Appointment, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Closure,
  ClosureType,
  convertCapacityMapToSlotList,
  DOW,
  getAllSlotsAsCapacityMap,
  getAvailableSlots,
  getScheduleExtension,
  getSlotCapacityMapForDayAndSchedule,
  getTimezone,
  OVERRIDE_DATE_FORMAT,
} from 'utils';
import { vi } from 'vitest';
import * as slotData from './data/slot-constants';
import { addDateToSlotMap, addDateToSlotTimes } from './data/slot-constants';
import {
  HoursOfOpConfig,
  makeLocationWithSchedule,
  replaceSchedule,
  setHourlyCapacity,
} from './helpers/testScheduleUtils';
export const DEFAULT_TEST_TIMEOUT = 100000;
/*

export async function getTodayAndTomorrowAppointments(
  now: DateTime,
  location: Location,
  oystehr: Oystehr
): Promise<Appointment[]> {
  // convert now to location timezone
  const timeZone = getTimezone(location);
  const nowForTimeZone = now.setZone(timeZone);

  // get iso date string for today and end of tomorrow
  const { minimum: today, maximum: tomorrow } = createMinimumAndMaximumTime(nowForTimeZone);

  // search for appointment resources using the specific location and get all appointments starting today and end of tomorrow
  console.log(`searching for appointments based on location ${location.id}, for dates ${today} and ${tomorrow}`);
  console.time('get_appointments_at_location');
  const appointmentResources = (await oystehr.fhir.search<Appointment>({
    resourceType: 'Appointment',
    params: [
      {
        name: 'location',
        value: `Location/${location.id}`,
      },
      {
        name: 'status:not',
        value: 'cancelled',
      },
      {
        name: 'status:not',
        value: 'noshow',
      },
      { name: 'date', value: `ge${today}` },
      { name: 'date', value: `le${tomorrow}` },
      { name: '_count', value: '1000' },
    ],
  })).unbundle();
  console.timeEnd('get_appointments_at_location');
  return appointmentResources;
}
*/
interface MakeAppointmentsInput {
  times: DateTime[];
  statuses: Appointment['status'][];
  statusAll?: Appointment['status'];
  timezone?: string;
}

const makeAppointments = (input: MakeAppointmentsInput): Appointment[] => {
  return input.times.map((time, idx) => {
    let zoneSensitiveStart: DateTime = time;
    if (input.timezone) {
      zoneSensitiveStart = time.setZone(input.timezone);
    }
    const status = input.statusAll ?? input.statuses[idx];
    const appt: Appointment = {
      resourceType: 'Appointment',
      id: randomUUID(),
      start: zoneSensitiveStart.toISO() || '',
      status,
      participant: [],
    };
    return appt;
  });
};

const slotFromStartISO = (start: string, lengthInHours?: number, scheduleId?: string): Slot => {
  const slot: Slot = {
    resourceType: 'Slot',
    id: randomUUID(),
    start: start,
    status: 'busy',
    end:
      DateTime.fromISO(start)
        .plus({ hours: lengthInHours ?? 0.25 })
        .toISO() || '',
    schedule: scheduleId ? { reference: `Schedule/${scheduleId}` } : { reference: `Schedule/${randomUUID()}` },
  };
  return slot;
};

interface MakeSlotsInput {
  times: DateTime[];
  statuses: Slot['status'][];
  statusAll?: Slot['status'];
  timezone?: string;
}

const makeSlots = (input: MakeSlotsInput): Slot[] => {
  return input.times.map((time, idx) => {
    let zoneSensitiveStart: DateTime = time;
    if (input.timezone) {
      zoneSensitiveStart = time.setZone(input.timezone);
    }
    const status = input.statusAll ?? input.statuses[idx];
    const slot: Slot = {
      resourceType: 'Slot',
      id: randomUUID(),
      start: zoneSensitiveStart.toISO() || '',
      status,
      end: time.plus({ hours: 1 }).toISO() || '',
      schedule: { reference: 'Schedule/some' },
    };
    return slot;
  });
};

describe.skip('test front end slot display: different capacities, no buffers, no busy slots, no appointments', () => {
  vi.setConfig({ testTimeout: DEFAULT_TEST_TIMEOUT });

  test('1: capacity 4, now 2pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const scheduleDTO = getScheduleExtension(schedule);

    if (!scheduleDTO) throw new Error('location does not have schedule');

    const allSlotsForDay = convertCapacityMapToSlotList(
      getAllSlotsAsCapacityMap({
        scheduleExtension: scheduleDTO,
        now: time,
        finishDate: time.plus({ days: 1 }),
        timezone: getTimezone(schedule),
      })
    );
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    expect(allSlotsForDay).toEqual(testSlots);
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:15:00.000-04:00', 'T14:30:00.000-04:00', ...slotData.slotsTimesGroupA]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: capacity 6, now 2pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 6, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:15:00.000-04:00', 'T14:30:00.000-04:00', ...slotData.slotsTimesGroupA]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('3: capacity 3, now 2pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:15:00.000-04:00', ...slotData.slotsTimesGroupB]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap3),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('4: capacity 2, now 8am, opens @10am, closes @3pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupM);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('5: capacity 1, now 8am, open @12am close @12am', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 0, close: 0, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 1, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupQ);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('6: capacity 4, now 2:15pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14, minute: 15 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:30:00.000-04:00', ...slotData.slotsTimesGroupA]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('7: capacity 4, now 2:13pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14, minute: 13 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:30:00.000-04:00', ...slotData.slotsTimesGroupA]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('8: capacity 4, now 2:21pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14, minute: 21 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupA),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('9: capacity 4, now 3:03pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 15, minute: 3 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupA.slice(3)),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('10.1: capacity 4, now 2:37pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14, minute: 37 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupA.slice(1)),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('10.2: capacity 4, now 1:53pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 13, minute: 53 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, ['T14:15:00.000-04:00', 'T14:30:00.000-04:00', ...slotData.slotsTimesGroupA]),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('10.3: capacity 4, now 2:25pm, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 14, minute: 25 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase(); // missing locale info
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupA),
      ...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap4),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('11: test first slot display (40 minutes from now), now 10:04am, office is opened', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 4 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:30:00.000-04:00', ...slotData.slotsTimesGroupZ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('11.5: test first slot display (40 minutes from now), now 10:06am, office is opened', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 6 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:30:00.000-04:00', ...slotData.slotsTimesGroupZ]);
    expect(testSlots).toEqual(expectedSlots);
  });
});

describe.skip('test front end slot display: straight forward opening and closing buffers, capacity 4, no busy slots, no appointments', () => {
  test('1: opening buffer 15', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForOpeningBuffer15,
      ...slotData.slotsTimesForOpeningBuffer30,
      ...slotData.slotsTimesForOpeningBuffer45,
      ...slotData.slotsTimesForOpeningBuffer60,
      ...slotData.slotsTimesForOpeningBufferBase,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('1.5: opening buffer 15, capacity 1', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 1, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesForOpeningBufferWith1Cap);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: opening buffer 30', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 30, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForOpeningBuffer30,
      ...slotData.slotsTimesForOpeningBuffer45,
      ...slotData.slotsTimesForOpeningBuffer60,
      ...slotData.slotsTimesForOpeningBufferBase,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: opening buffer 45', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 45, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForOpeningBuffer45,
      ...slotData.slotsTimesForOpeningBuffer60,
      ...slotData.slotsTimesForOpeningBufferBase,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('3: opening buffer 60', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 60, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForOpeningBuffer60,
      ...slotData.slotsTimesForOpeningBufferBase,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('4: opening buffer 90', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 90, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesForOpeningBufferBase);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('5: closing buffer 15', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 15);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForClosingBufferBase,
      ...slotData.slotsTimesForClosingBuffer60,
      ...slotData.slotsTimesForClosingBuffer45,
      ...slotData.slotsTimesForClosingBuffer30,
      ...slotData.slotsTimesForClosingBuffer15,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('5.5: closing buffer 15, capacity 3', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesForClosingBufferWith3Cap);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('6: closing buffer 30', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 30);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForClosingBufferBase,
      ...slotData.slotsTimesForClosingBuffer60,
      ...slotData.slotsTimesForClosingBuffer45,
      ...slotData.slotsTimesForClosingBuffer30,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('6.5: closing buffer 30, capacity 2', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 30);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesForClosingBufferWith2Cap);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('7: closing buffer 45', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 45);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForClosingBufferBase,
      ...slotData.slotsTimesForClosingBuffer60,
      ...slotData.slotsTimesForClosingBuffer45,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('8: closing buffer 60', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 60);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      ...slotData.slotsTimesForClosingBufferBase,
      ...slotData.slotsTimesForClosingBuffer60,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('9: closing buffer 90', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 16, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 90);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesForClosingBufferBase);
    expect(testSlots).toEqual(expectedSlots);
  });
});

describe.skip('test front end slot display: opening and closing buffers, varied capacity, varied busy slot & appointments', () => {
  test('1: opening buffer 15 & capacity 3', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 0);

    // no busy slots, no appointments booked
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupC);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('2: opening buffer 30 & capacity 3', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 30, 0);

    // no busy slots, no appointments booked
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupD);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('3: closing buffer 30 & capacity 3', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    // no busy slots, no appointments booked
    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupE);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('4: closing buffer 30 & capacity 3, 2 appointments', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const apptTimes = [time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 5, minutes: 45 })];
    const busySlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(busySlots.length).toBe(2);
    // 2 appointments booked (2 busy slots)
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupN);
    expect(testSlots).toEqual(expectedSlots);
  });

  // same as above but with capacity 4
  test('4.5: closing buffer 30 & capacity 4, 2 appointments', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 30);

    const apptTimes = [time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 5, minutes: 45 })];
    const busySlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(busySlots.length).toBe(2);
    // 2 appointments booked
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupF);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('5: closing buffer 30 & capacity 3, 2 busy slots', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 6 })];
    const busySlots = makeSlots({
      times: slotTimes,
      statuses: [],
      statusAll: 'busy-tentative',
    });
    expect(busySlots.length).toBe(2);
    // 2 busy slots, no appointments booked
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupG);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('6: closing buffer 30 & capacity 3, 3 busy slots', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 6 })];
    const slots = makeSlots({
      times: slotTimes,
      statuses: [],
      statusAll: 'busy-tentative',
    });
    expect(slots.length).toBe(3);
    // 2 busy slots, no appointments booked
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: slots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupH);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('7: closing buffer 30 & capacity 3, 3 busy slots, 2 appointments', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const slotTimes = [time.plus({ hour: 5 }), time.plus({ hour: 5, minutes: 15 }), time.plus({ hour: 6 })];
    const slots = makeSlots({
      times: slotTimes,
      statuses: [],
      statusAll: 'busy-tentative',
    });
    const apptTimes = [time.plus({ hour: 5, minutes: 45 }), time.plus({ hour: 7, minutes: 15 })];
    const appointmentSlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(slots.length).toBe(3);
    expect(appointmentSlots.length).toBe(2);
    // 2 busy slots, 3 appointments booked
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: [...slots, ...appointmentSlots],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupI);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('8: closing buffer 30 & capacity 3, 1 appointment in middle hour', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const apptTimes = [time.plus({ hour: 7, minutes: 15 })];
    const appointmentSlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(appointmentSlots.length).toBe(1);
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: appointmentSlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupJ);
    expect(testSlots).toEqual(expectedSlots);
  });

  // currently expecting this to fail
  test('9: closing buffer 30 & capacity 3, 1 appointment at unexpected time (expecting failure atm)', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 30);

    const apptTimes = [time.plus({ hour: 7, minutes: 30 })];
    const appointmentSlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(appointmentSlots.length).toBe(1);
    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: appointmentSlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupK);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('10: opening buffer 15, closing buffer 15 & capacity 3', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 15);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupL);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('11: closing buffer 15 & capacity 4', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 0, 15);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupO);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('12: open @8pm close @12am, capacity 3 with 60 minute closing buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 20, close: 0, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 60);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupP);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('13: open @10am close @5pm, capacity 4, 30 min open + close buffers, specific capacity on 2 hours', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 17, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 4, 30, 30);

    // set specific hourly capacities
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const updatedDailySchedule = setHourlyCapacity(
      setHourlyCapacity(scheduleDetails.schedule, todayDoW, 11, 2),
      todayDoW,
      13,
      2
    );
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupR);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('14: open @1pm close @5pm, capacity 4, specific capacity 1 during hour 13, 15 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 4, 15, 0);

    // set specific hourly capacity
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const updatedDailySchedule = setHourlyCapacity(scheduleDetails.schedule, todayDoW, 13, 1);
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupS);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('15: open @1pm close @5pm, capacity 1, no buffers, 1 appointment on the hour', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 1, 0, 0);

    const apptTimes = [time.plus({ hour: 7, minutes: 0 })];
    const appointmentSlots = makeAppointments({
      times: apptTimes,
      statuses: [],
      statusAll: 'booked',
    }).map((appt) => slotFromStartISO(appt.start!, 0.25, schedule.id!));
    expect(appointmentSlots.length).toBe(1);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: appointmentSlots,
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupT);
    expect(testSlots).toEqual(expectedSlots);
  });

  // same as above but with a busy slot instead of an appointment
  test('15.5: open @1pm close @5pm, capacity 1, no buffers, 1 busy on the hour', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 13, close: 17, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 1, 0, 0);

    const slotTimes = [time.plus({ hour: 7 })];
    const slots = makeSlots({
      times: slotTimes,
      statuses: [],
      statusAll: 'busy-tentative',
    });
    expect(slots.length).toBe(1);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupT);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('16: open @2pm close @6pm, capacity 3, 15 minute opening + closing buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 15, 15);

    // set specific hourly capacities
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const updatedDailySchedule = setHourlyCapacity(scheduleDetails.schedule, todayDoW, 14, 1);
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupU);
    expect(testSlots).toEqual(expectedSlots);
  });

  // todo check all of the below changes
  test('17: open @2pm close @6pm, capacity 1, 15 minute opening + closing buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 15, minute: 6 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
    ];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 1, 15, 15);

    // set specific hourly capacities
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const updatedDailySchedule = setHourlyCapacity(scheduleDetails.schedule, todayDoW, 16, 0);
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupV),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupV2),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('18: open @2pm close @6pm, capacity 2, 15 minute opening + closing buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 15, minute: 6 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 14, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
    ];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 1, 15, 15);
    // set specific hourly capacities
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    let updatedDailySchedule = setHourlyCapacity(scheduleDetails.schedule, todayDoW, 16, 0);
    updatedDailySchedule = setHourlyCapacity(updatedDailySchedule, todayDoW, 17, 2);
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = [
      ...addDateToSlotTimes(time, slotData.slotsTimesGroupW),
      ...addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupV2),
    ];
    expect(testSlots).toEqual(expectedSlots);
  });

  test('19: now is 8am (before hour where we show tomorrow slots), today slots are 0, with buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8, minute: 6 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 7, close: 10, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
    ];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 1, 15, 15);
    // set specific hourly capacities
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const updatedDailySchedule = setHourlyCapacity(scheduleDetails.schedule, todayDoW, 9, 0);
    scheduleDetails.schedule = updatedDailySchedule;
    const updatedSchedule = replaceSchedule(schedule, scheduleDetails);

    const testSlots = getAvailableSlots({
      now: time,
      numDays: 1,
      schedule: updatedSchedule,
      busySlots: [],
    });
    const expectedSlots = addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupV2);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('19.5: now is 816am (before hour where we show tomorrow slots) and today slots are 0, without buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8, minute: 16 });
    const todayDoW: DOW = time.weekdayLong.toLocaleLowerCase() as DOW;
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 7, close: 9, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 14, close: 18, workingDay: true },
    ];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 1, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(tomorrow, slotData.slotsTimesGroupV3);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('20: open @8am, close @1pm, now 937am, capacity 3, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 37 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:15:00.000-04:00',
      ...slotData.slotsTimesGroupA1,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('20.1: open @8am, close @1pm, now 925am, capacity 3, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 25 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T09:45:00.000-04:00',
      'T10:00:00.000-04:00',
      'T10:15:00.000-04:00',
      ...slotData.slotsTimesGroupA1,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('20.2: open @8am, close @1pm, now 920am, capacity 3, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 20 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T09:45:00.000-04:00',
      'T10:00:00.000-04:00',
      'T10:15:00.000-04:00',
      ...slotData.slotsTimesGroupA1,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('21: open @8am, close @1pm, now 920am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 20 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:30:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('21.1: open @8am, close @1pm, now 927am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 27 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:30:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('21.2: open @8am, close @1pm, now 940am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 40 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:30:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('21.3: open @8am, close @1pm, now 955am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 55 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 8, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:30:00.000-04:00', ...slotData.slotsTimesGroupA2]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('22: open @10am, close @1pm, now 7am, capacity 2, 15 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 7 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:15:00.000-04:00',
      'T10:45:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('22.1: open @10am, close @1pm, now 7am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 7 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:30:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.1: open @10am, close @1pm, now 10:01am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:30:00.000-04:00', ...slotData.slotsTimesGroupA2]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.2: open @10am, close @1pm, now 10:01am, capacity 2, 15 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:15:00.000-04:00', ...slotData.slotsTimesGroupA3.slice(1)]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.3: open @10am, close @1pm, now 10:01am, capacity 2, 30 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 30, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA3);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.4: open @10am, close @1pm, now 10:01am, capacity 2, 60 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 60, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA2);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.5: open @10am, close @1pm, now 9:43am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, [
      'T10:00:00.000-04:00',
      'T10:30:00.000-04:00',
      ...slotData.slotsTimesGroupA2,
    ]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.6: open @10am, close @1pm, now 9:43am, capacity 2, 15 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:15:00.000-04:00', ...slotData.slotsTimesGroupA3.slice(1)]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.7: open @10am, close @1pm, now 9:43am, capacity 2, 30 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 43 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 30, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA3);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.8: open @10am, close @1pm, now 9:49am, capacity 2, no buffers', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 49 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 0, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:30:00.000-04:00', ...slotData.slotsTimesGroupA2]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.9: open @10am, close @1pm, now 9:52am, capacity 2, 15 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 15, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, ['T10:15:00.000-04:00', ...slotData.slotsTimesGroupA3.slice(1)]);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.10: open @10am, close @1pm, now 9:52am, capacity 2, 30 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 30, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA3);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('23.11: open @10am, close @1pm, now 9:52am, capacity 2, 60 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 9, minute: 52 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 2, 60, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA3.slice(2));
    expect(testSlots).toEqual(expectedSlots);
  });

  test('24: open @10am, close @1pm, now 10:01am, capacity 4, 60 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 60, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA4);
    expect(testSlots).toEqual(expectedSlots);
  });

  test('24.1: open @10am, close @1pm, now 10:01am, capacity 4, 90 minute opening buffer', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 10, minute: 1 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 13, workingDay: true }];
    const { location, schedule } = makeLocationWithSchedule(hoursInfo, 4, 90, 0);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = addDateToSlotTimes(time, slotData.slotsTimesGroupA4.slice(2));
    expect(testSlots).toEqual(expectedSlots);
  });
});

describe.skip('test back end slot generation', () => {
  test('1: capacity 15, no buffers, open @10am close @3pm ', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [{ dayOfWeek: todayDoW, open: 10, close: 15, workingDay: true }];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 15, 0, 0);
    const scheduleDetails = getScheduleExtension(schedule);

    if (!scheduleDetails) throw new Error('location does not have schedule');

    const testSlotCapacityMap = getSlotCapacityMapForDayAndSchedule(
      time,
      scheduleDetails.schedule,
      scheduleDetails.scheduleOverrides,
      scheduleDetails.closures
    );

    const expectedSlotMap = addDateToSlotMap(time, slotData.slotMapA);
    expect(testSlotCapacityMap).toEqual(expectedSlotMap);
  });
});

describe.skip('test closures', () => {
  test('1: today closed now 8am, opens @10am, closes @6pm', async () => {
    const time = DateTime.now().startOf('day').set({ hour: 8 });
    const todayDoW = time.weekdayLong.toLocaleLowerCase();
    const tomorrow = time.plus({ day: 1 });
    const tomorrowDoW = tomorrow.weekdayLong.toLocaleLowerCase();
    const hoursInfo: HoursOfOpConfig[] = [
      { dayOfWeek: todayDoW, open: 10, close: 18, workingDay: true },
      { dayOfWeek: tomorrowDoW, open: 10, close: 18, workingDay: true },
    ];
    const closures: Closure[] = [
      {
        type: ClosureType.OneDay,
        start: time.startOf('day').toFormat(OVERRIDE_DATE_FORMAT),
        end: time.endOf('day').toFormat(OVERRIDE_DATE_FORMAT),
      },
    ];
    const { schedule } = makeLocationWithSchedule(hoursInfo, 3, 0, 0, undefined, closures);

    const testSlots = getAvailableSlots({ now: time, schedule, numDays: 1, busySlots: [] });
    const expectedSlots = [...addDateToSlotTimes(tomorrow, slotData.slotTimesAllDay10to6Cap3)];
    expect(testSlots).toEqual(expectedSlots);
  });
});
