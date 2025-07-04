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
  scheduleCapacityList: Capacity[],
  startDate: DateTime,
  slotLength?: number
): SlotCapacityMap => {
  const startOfDate = startDate.startOf('day');
  const timeSlots: { [slot: string]: number } = {};
  // console.log('scheduleCapacityList', scheduleCapacityList);
  scheduleCapacityList.forEach((entry) => {
    const { capacity, hour } = entry;
    const bucketedCapacity = divideHourlyCapacityBySlotInterval(capacity, slotLength);
    Object.entries(bucketedCapacity).forEach(([key, value]) => {
      const time = DateTime.fromISO(startOfDate.toISO()!).plus({ hour: hour, minute: parseInt(key) });
      timeSlots[time.toISO()!] = value;
    });
  });
  return timeSlots;
};

// todo: get rid of magic numbers...
const divideHourlyCapacityBySlotInterval = (capacity: number, slotLength = 15): { [slot: number]: number } => {
  const minutesToDistributeInHour = 60;
  const numBuckets = Math.floor(minutesToDistributeInHour / slotLength);
  const timeSlots: { [slot: number]: number } = {};
  const highUnitsPerBucket = Math.ceil(capacity / numBuckets);
  const lowUnitsPerBucket = Math.floor(capacity / numBuckets);
  // this is how much slots additional capacity units we would need to fill all the buckets evenly
  const capacityShortage = Math.max(numBuckets - (capacity % numBuckets), 0);

  for (let i = 0; i < numBuckets; i += 1) {
    const key = i * slotLength;
    if (capacityShortage === 0) {
      timeSlots[key] = highUnitsPerBucket;
    } else if (capacityShortage === 1) {
      // if there is a shortage of 1, we leave 1 less slot in the last bucket
      if (i === numBuckets - capacityShortage) {
        timeSlots[key] = lowUnitsPerBucket;
      } else {
        timeSlots[key] = highUnitsPerBucket;
      }
    } else {
      // otherwise we space out the shortage across the buckets, alternating between high and low
      // as we move through the buckets
      // i.e. :00 = n, :15 = n-1, :30 = n, :45 = n-1, etc.
      if (i % 2 === 0 && i <= numBuckets - capacityShortage) {
        timeSlots[key] = highUnitsPerBucket;
      } else {
        timeSlots[key] = lowUnitsPerBucket;
      }
    }
  }
  // console.log('timeSlots pre-bucketing', timeSlots);

  return timeSlots;
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

/**
 * Compares two dates.
 * The most recent date will be first,
 * invalid dates will be last
 */
export const compareDates = (a: string | undefined, b: string | undefined): number => {
  const dateA = DateTime.fromISO(a || '');
  const dateB = DateTime.fromISO(b || '');
  const isDateAValid = dateA.isValid;
  const isDateBValid = dateB.isValid;

  if (isDateAValid && !isDateBValid) return -1;
  if (!isDateAValid && isDateBValid) return 1;
  if (!isDateAValid && !isDateBValid) return 0;

  return dateB.toMillis() - dateA.toMillis();
};

export const formatDateForLabs = (datetime: string | undefined | null, timezone: string | undefined): string => {
  if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
  return DateTime.fromISO(datetime).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
};
