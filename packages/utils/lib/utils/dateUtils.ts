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
  slotLength?: number,
  cadenceMinutes?: number
): SlotCapacityMap => {
  const startOfDate = startDate.startOf('day');
  const timeSlots: { [slot: string]: number } = {};
  const effectiveSlotLength = slotLength ?? 15;

  // When the caller supplies an explicit cadence (e.g. group admin picked
  // "every 15 minutes"), that always wins and we route through the
  // session-based path — the per-hour bucket fast path can't express a cadence
  // finer than the slot length.
  const hasExplicitCadence = cadenceMinutes !== undefined && cadenceMinutes > 0;

  // Two branches:
  //   - slotLength evenly divides 60 (15/30/60) AND no explicit cadence:
  //     per-hour bucket math. Each slot fits within one open hour; capacity is
  //     distributed across sub-hour buckets. Preserves legacy behaviour.
  //   - everything else (20, 45, 90, 120, …, or explicit cadence): session-
  //     based math. Slots may straddle hours; offered starts step at the
  //     caller's cadence (if any) else gcd(slotLength, 60) (e.g. 45-min →
  //     15-min cadence). Per-slot capacity is the minimum providers count
  //     across every hour the slot touches (a 45-min visit needs a provider
  //     free for the whole 45 minutes).
  // Resolve the effective concurrent-provider count for an hour entry, picking
  // whichever field the admin filled in. Precedence:
  //   1. `prebookSlots` (Location semantic): slots × slotLength / 60.
  //   2. `providers`    (Practitioner semantic): used as-is.
  //   3. legacy `capacity` (bookings/hr at 15-min cadence): capacity × 15/60
  //      = capacity/4, which matches the old math for the 15-min-only world.
  const effectiveProviders = (entry: Capacity): number => {
    if (entry.prebookSlots !== undefined && entry.prebookSlots !== null) {
      return (entry.prebookSlots * effectiveSlotLength) / 60;
    }
    if (entry.providers !== undefined && entry.providers !== null) {
      return entry.providers;
    }
    return (entry.capacity ?? 0) / 4;
  };

  if (!hasExplicitCadence && effectiveSlotLength <= 60 && 60 % effectiveSlotLength === 0) {
    scheduleCapacityList.forEach((entry) => {
      const providersForHour = effectiveProviders(entry);
      const totalBookings = Math.max(0, Math.floor((providersForHour * 60) / effectiveSlotLength));
      const bucketedCapacity = divideHourlyCapacityBySlotInterval(totalBookings, slotLength);
      Object.entries(bucketedCapacity).forEach(([key, value]) => {
        const time = DateTime.fromISO(startOfDate.toISO()!).plus({ hour: entry.hour, minute: parseInt(key) });
        timeSlots[time.toISO()!] = value;
      });
    });
    return timeSlots;
  }

  // Super-hour / non-divisor path. Build a per-hour providers map.
  const providersByHour: Record<number, number> = {};
  for (const entry of scheduleCapacityList) {
    const p = effectiveProviders(entry);
    if (p > 0) providersByHour[entry.hour] = p;
  }

  // Group consecutive open hours into sessions (e.g. [9,10,11] then [13,14]).
  const openHours = Object.keys(providersByHour)
    .map(Number)
    .sort((a, b) => a - b);
  const sessions: number[][] = [];
  for (const h of openHours) {
    const last = sessions[sessions.length - 1];
    if (last && last[last.length - 1] === h - 1) last.push(h);
    else sessions.push([h]);
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  // Explicit cadence wins; otherwise step by gcd(slotLength, 60) — gives legacy
  // cadence for 15/30/60 (step == slotLength), 15-min cadence for 45 (gcd
  // 45,60 = 15), 20-min cadence for 20, 30-min for 90, 60-min for 120, etc.
  const stepMinutes = hasExplicitCadence ? cadenceMinutes! : gcd(effectiveSlotLength, 60);

  for (const sessionHours of sessions) {
    const sessionStartHour = sessionHours[0];
    const sessionEndHour = sessionHours[sessionHours.length - 1] + 1; // exclusive
    const sessionMinutes = (sessionEndHour - sessionStartHour) * 60;
    if (sessionMinutes < effectiveSlotLength) continue;

    for (let offset = 0; offset + effectiveSlotLength <= sessionMinutes; offset += stepMinutes) {
      const candidateStart = startOfDate.plus({ hour: sessionStartHour, minute: offset });
      const candidateEnd = candidateStart.plus({ minutes: effectiveSlotLength });

      // Hours the slot touches. End-exclusive when the slot ends on the hour.
      const startH = candidateStart.hour;
      const lastH = candidateEnd.minute === 0 ? candidateEnd.hour - 1 : candidateEnd.hour;

      let minProviders = Infinity;
      for (let h = startH; h <= lastH; h++) {
        const p = providersByHour[h];
        if (p === undefined) {
          minProviders = 0;
          break;
        }
        minProviders = Math.min(minProviders, p);
      }
      // Long-duration concurrent capacity is integer providers (you need a
      // provider free for the full duration; fractional providers can't
      // straddle a multi-hour visit).
      const concurrent = Number.isFinite(minProviders) ? Math.floor(minProviders) : 0;
      if (concurrent > 0) {
        timeSlots[candidateStart.toISO()!] = concurrent;
      }
    }
  }

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
  busySlots: Slot[],
  slotLengthMinutes?: number
): string[] => {
  const availableSlots = Object.keys(timeSlots).filter((timeSlot) => {
    const numSlots = timeSlots[timeSlot];
    let numAppointments = 0;
    let numBusySlots = 0;

    // Time-window overlap subtraction. A candidate slot [candStart, candEnd) is
    // consumed by a busy slot if their intervals overlap — not only when start
    // times match. Matters once visit durations vary (e.g. a 45-min booking at
    // 1:00 must hide the 1:15 and 1:30 candidate 15-min slots).
    const candStart = DateTime.fromISO(timeSlot);
    const candEnd = slotLengthMinutes ? candStart.plus({ minutes: slotLengthMinutes }) : candStart;

    currentAppointments.forEach((appointmentTemp) => {
      const apStart = DateTime.fromISO(appointmentTemp.start || '');
      if (slotLengthMinutes && appointmentTemp.end) {
        const apEnd = DateTime.fromISO(appointmentTemp.end);
        if (+apStart < +candEnd && +apEnd > +candStart) numAppointments++;
      } else if (+apStart === +candStart) {
        numAppointments++;
      }
    });

    busySlots.forEach((slot) => {
      const busyStart = DateTime.fromISO(slot.start || '');
      if (slotLengthMinutes && slot.end) {
        const busyEnd = DateTime.fromISO(slot.end);
        if (+busyStart < +candEnd && +busyEnd > +candStart) numBusySlots++;
      } else if (+busyStart === +candStart) {
        numBusySlots++;
      }
    });

    return numSlots > numAppointments + numBusySlots;
  });

  return availableSlots;
};

export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'MM/dd/yyyy';
export const DISPLAY_DATE_AND_TIME_FORMAT = DISPLAY_DATE_FORMAT + ' HH:mm';

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

export function formatDateForDisplay(date?: string, timezone?: string): string {
  if (!date) return '';

  const dt = DateTime.fromISO(date);
  if (!dt.isValid) return '';

  return (timezone ? dt.setZone(timezone) : dt).toFormat(DISPLAY_DATE_FORMAT);
}

export function formatDateConfigurable(input: {
  isoDate?: string;
  date?: DateTime;
  format?: string;
  timezone?: string;
}): string | undefined {
  const { isoDate, date, format = DISPLAY_DATE_FORMAT, timezone } = input;
  let targetDate = date || (isoDate ? DateTime.fromISO(isoDate) : null);

  if (!targetDate || !targetDate.isValid) return undefined;
  if (timezone) targetDate = targetDate.setZone(timezone);

  return targetDate.toFormat(format);
}

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
