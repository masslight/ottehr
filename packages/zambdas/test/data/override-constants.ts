import { DateTime } from 'luxon';
import { Closure, ClosureType, HourOfDay, OVERRIDE_DATE_FORMAT } from 'utils';

export const todaySlotScheduleOverride = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }),
    open: 18 as HourOfDay,
    close: 22 as HourOfDay,
    openingBuffer: 15,
    closingBuffer: 0,
    hourlyCapacity: 3,
  },
];

export const overrideScheduleA = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }),
    open: 13 as HourOfDay,
    close: 14 as HourOfDay,
    openingBuffer: 15,
    closingBuffer: 15,
    hourlyCapacity: 15,
  },
];

export const pastScheduleOverride1 = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }).minus({ week: 1 }),
    open: 13 as HourOfDay,
    close: 14 as HourOfDay,
    openingBuffer: 15,
    closingBuffer: 15,
    hourlyCapacity: 15,
  },
];

export const futureScheduleOverride1 = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }).plus({ week: 1 }),
    open: 13 as HourOfDay,
    close: 14 as HourOfDay,
    openingBuffer: 15,
    closingBuffer: 15,
    hourlyCapacity: 15,
  },
];

export const pastScheduleOverride2 = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }).minus({ week: 1 }),
    open: 20 as HourOfDay,
    close: 22 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const futureScheduleOverride2 = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }).plus({ week: 1 }),
    open: 20 as HourOfDay,
    close: 22 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const todayScheduleOverride = [
  {
    date: DateTime.now().startOf('day').set({ hour: 13 }),
    open: 17 as HourOfDay,
    close: 22 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const todayClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const pastClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').minus({ week: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').minus({ week: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const futureClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').plus({ week: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').plus({ week: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const tomorrowClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').plus({ day: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').plus({ day: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const closureOverrideForPeriod: Closure[] = [
  {
    type: ClosureType.Period,
    start: DateTime.now().startOf('day').toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').plus({ week: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const todayScheduleOverride2 = [
  {
    date: DateTime.now().startOf('day').set({ hour: 11 }),
    open: 9 as HourOfDay,
    close: 12 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const todayScheduleOverrideMidnight = [
  {
    date: DateTime.now().startOf('day').set({ hour: 19 }),
    open: 17 as HourOfDay,
    close: 24 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const closureOverrideFourDays: Closure[] = [
  {
    type: ClosureType.Period,
    start: DateTime.now().startOf('day').set({ weekday: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 3 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const tuesdayScheduleOverride = [
  {
    date: DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 1 }),
    open: 8 as HourOfDay,
    close: 20 as HourOfDay,
    openingBuffer: 0,
    closingBuffer: 0,
    hourlyCapacity: 15,
  },
];

export const tuesdayClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').set({ weekday: 1 }).plus({ day: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').set({ weekday: 1 }).plus({ day: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];

export const mondayClosureOverrideForOneDay: Closure[] = [
  {
    type: ClosureType.OneDay,
    start: DateTime.now().startOf('day').set({ weekday: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
    end: DateTime.now().endOf('day').set({ weekday: 1 }).toFormat(OVERRIDE_DATE_FORMAT),
  },
];
