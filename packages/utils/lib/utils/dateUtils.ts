import { Appointment, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { formatDate } from 'utils';
import { Capacity, SlotCapacityMap } from './scheduleUtils';

export function createMinimumAndMaximumTime(date: DateTime, numDays: number): { minimum: string; maximum: string } {
  const startTime = formatDate(date.startOf('day').toISO() as string);
  const finishTime = date.plus({ days: numDays });
  const maximum = formatDate(finishTime.endOf('day').toISO() as string);
  return { minimum: startTime, maximum: maximum };
}

export const isISODateTime = (dateTimeString: string): boolean => {
  const test = DateTime.fromISO(dateTimeString);
  if (!test?.invalidReason) {
    return true;
  } else {
    return false;
  }
};

export const convertCapacityListToBucketedTimeSlots = (
  scheduleCapcityList: Capacity[],
  startDate: DateTime
): SlotCapacityMap => {
  const startOfDate = startDate.startOf('day');
  const timeSlots: { [slot: string]: number } = {};
  scheduleCapcityList.forEach((entry) => {
    const { capacity, hour } = entry;
    const bucketedCapacity = divideHourlyCapacityBySlotInterval(capacity);
    Object.entries(bucketedCapacity).forEach(([key, value]) => {
      const time = DateTime.fromISO(startOfDate.toISO()!).plus({ hour: hour, minute: parseInt(key) });
      timeSlots[time.toISO()!] = value;
    });
  });
  return timeSlots;
};

const divideHourlyCapacityBySlotInterval = (capacity: number): { [slot: number]: number } => {
  const minutesToDistributeInHour = 60;
  const timeSlots: { [slot: number]: number } = {};
  const minutesPerSlot = Math.ceil(minutesToDistributeInHour / capacity);

  for (let i = 0; i < minutesToDistributeInHour; i += minutesPerSlot) {
    timeSlots[i] = 1;
  }
  console.log('timeSlots pre-bucketing', timeSlots);

  // the capacity is less than the number of times an hour is divisible by the slot length
  const undercapacity = Object.entries(timeSlots).length < 4; // 60 / slot length - todo: get rid of magic numbers

  const bucketedTimeSlots: { [slot: string]: number } = Object.entries(timeSlots).reduce(
    (acc, [key, value]) => {
      const bucketedKey = findNearestBucketForSlotStart(parseInt(key), 15, undercapacity);
      if (bucketedKey === 45) {
        console.log('bucketedKey = 45, originalKey =, minute mod =; ', key, parseInt(key) % 15);
      }
      const currentCount = acc[bucketedKey] ?? 0;
      acc[bucketedKey] = currentCount + value;
      return acc;
    },
    {} as { [slot: string]: number }
  );
  console.log('bucketedTimeSlots', bucketedTimeSlots);
  return bucketedTimeSlots;
};

const findNearestBucketForSlotStart = (minute: number, slotLength: number, undercapacity: boolean): number => {
  const minuteMod = minute % slotLength;
  const bucketSize = 60 / slotLength;
  console.log('bucketSize', bucketSize);
  if (minuteMod === 0) {
    return minute;
  } else {
    // the capacity is less than the number of times an hour is divisible by the slot length
    if (undercapacity) {
      return minute - minuteMod;
    }
    if (minuteMod > slotLength / 2) {
      if (minute + (slotLength - minuteMod) === 60) {
        return 0;
      } else {
        return minute + (slotLength - minuteMod);
      }
    } else {
      return minute - minuteMod;
    }
  }
};

export const convertCapacityMapToSlotList = (timeSlots: { [slot: string]: number }): string[] => {
  const allSlots = Object.keys(timeSlots).reduce((acc, timeSlot) => {
    const capacity = timeSlots[timeSlot];
    let returnedCount = 0;
    while (returnedCount < capacity) {
      acc.push(timeSlot);
      returnedCount++;
    }
    return acc;
  }, [] as string[]);
  return allSlots;
};

export const distributeTimeSlots = (
  timeSlots: { [slot: string]: number },
  currentAppointments: Appointment[],
  busySlots: Slot[]
): string[] => {
  const availableSlots = Object.keys(timeSlots).filter((timeSlot) => {
    const numSlots = timeSlots[timeSlot];
    let numAppointments = 0;
    let numBusySlots = 0;
    currentAppointments.forEach((appointmentTemp) => {
      if (+DateTime.fromISO(appointmentTemp.start || '') === +DateTime.fromISO(timeSlot)) {
        numAppointments++;
      }
    });
    busySlots.forEach((slot) => {
      if (+DateTime.fromISO(slot.start || '') === +DateTime.fromISO(timeSlot)) {
        numBusySlots++;
      }
    });
    return numSlots > numAppointments + numBusySlots;
  });

  return availableSlots;
};

export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'MM/dd/yyyy';

export function calculatePatientAge(date: string | null | undefined): string | null | undefined {
  if (!date) {
    return date;
  }

  const INVALID_DATE_FALLBACK = '';
  const dob = DateTime.fromISO(date);

  if (!dob.isValid) {
    return INVALID_DATE_FALLBACK;
  }

  const now = DateTime.now();

  if (dob > now) {
    return '0 d';
  }

  const MINIMUM_AGE_IN_YEARS_TO_DISPLAY_YEARS = 2;
  const MINIMUM_AGE_IN_MONTHS_TO_DISPLAY_MONTHS = 2;

  const diff = now.diff(dob, ['years', 'months', 'days']);
  const { years, months } = diff.toObject();

  if (years && years >= MINIMUM_AGE_IN_YEARS_TO_DISPLAY_YEARS) {
    return `${Math.floor(years)} y`;
  }

  const fullMonths = (years || 0) * 12 + (months || 0);

  if (fullMonths >= MINIMUM_AGE_IN_MONTHS_TO_DISPLAY_MONTHS) {
    return `${Math.floor(fullMonths)} m`;
  }

  const fullDays = now.diff(dob).as('days');
  return `${Math.floor(fullDays)} d`;
}

export const formatDOB = (birthDate: string | undefined): string | undefined => {
  if (!birthDate) return undefined;
  const birthday = DateTime.fromFormat(birthDate, DATE_FORMAT).toFormat(DISPLAY_DATE_FORMAT);
  const age = calculatePatientAge(birthDate);
  return `${birthday} (${age})`;
};
