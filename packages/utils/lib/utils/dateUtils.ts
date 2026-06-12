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

/**
 * The cadence (interval between offered slot start times) the slot
 * generator falls back to when no explicit cadence is configured on the
 * service. Computed as gcd(durationMinutes, 60) — gives the longest stride
 * that still keeps slot starts hour-aligned for any duration:
 *   - 15 / 30 / 60 min → matching cadence (slots back-to-back)
 *   - 45 min          → 15-min cadence
 *   - 90 min          → 30-min cadence
 *   - 120 min         → 60-min cadence
 *
 * When gcd(d, 60) collapses below 10 (e.g. prime durations like 37 or 41
 * yield gcd 1; 25/35/55 yield 5; 14/22/26 yield 2), the default falls
 * back to the duration itself. Slot starts step every `durationMinutes`
 * — no overlap, predictable, and the admin can still override via an
 * explicit cadence if they want finer-grained starts. Without this
 * fallback, a duration like 37 min produces a slot start every minute
 * of every open hour, which is practically useless even though it's
 * mathematically what gcd asks for.
 *
 * Returns 15 as a safe default when durationMinutes isn't a positive number
 * (e.g. the admin form hasn't been filled in yet).
 *
 * Single source of truth for the default-cadence rule — used by the slot
 * generator (convertCapacityListToBucketedTimeSlots) and by admin UIs that
 * display "Default (X min)" labels in cadence pickers.
 */
const MIN_REASONABLE_DEFAULT_CADENCE = 10;
export const getDefaultCadenceMinutes = (durationMinutes: number): number => {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 15;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const gcdValue = gcd(durationMinutes, 60);
  return gcdValue >= MIN_REASONABLE_DEFAULT_CADENCE ? gcdValue : durationMinutes;
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

  // Resolve cadence once up front so the branch below can decide on what
  // the path actually needs (slot length divides 60 AND cadence == slot
  // length), not on whether the caller passed an explicit value. An admin
  // who explicitly sets cadence to its default value used to take the
  // session path and silently lose fractional-providers hours; same input
  // now produces the same output as leaving cadence unset.
  const effectiveCadenceMinutes =
    cadenceMinutes !== undefined && cadenceMinutes > 0 ? cadenceMinutes : getDefaultCadenceMinutes(effectiveSlotLength);

  // Per-hour bucket math (each slot fits in one open hour, capacity
  // distributed across sub-hour buckets) vs session-based math (slots may
  // straddle hours, capacity is min providers across hours touched). The
  // bucket path can't express a cadence finer than slot length, so it's
  // only valid when those two are equal.
  // Resolve effective providers per hour: prebookSlots × slotLen/60, else
  // providers as-is, else legacy capacity/4 (legacy = bookings/hr at 15-min cadence).
  const effectiveProviders = (entry: Capacity): number => {
    if (entry.prebookSlots !== undefined && entry.prebookSlots !== null) {
      return (entry.prebookSlots * effectiveSlotLength) / 60;
    }
    if (entry.providers !== undefined && entry.providers !== null) {
      return entry.providers;
    }
    return (entry.capacity ?? 0) / 4;
  };

  if (effectiveSlotLength <= 60 && 60 % effectiveSlotLength === 0 && effectiveCadenceMinutes === effectiveSlotLength) {
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

  const stepMinutes = effectiveCadenceMinutes;

  for (const sessionHours of sessions) {
    const sessionStartHour = sessionHours[0];
    const sessionEndHour = sessionHours[sessionHours.length - 1] + 1; // exclusive
    const sessionMinutes = (sessionEndHour - sessionStartHour) * 60;
    if (sessionMinutes < effectiveSlotLength) continue;

    for (let offset = 0; offset + effectiveSlotLength <= sessionMinutes; offset += stepMinutes) {
      const candidateStart = startOfDate.plus({ hour: sessionStartHour, minute: offset });

      // Hours the slot touches, computed from offset arithmetic so the
      // math stays correct for slots that end exactly at the day boundary
      // (e.g., 22:30 + 90min on a 24-hour-open schedule). End-exclusive
      // when the slot ends on the hour: a 9:00–10:00 slot consumes hour
      // 9's capacity, not hour 10's.
      const startH = sessionStartHour + Math.floor(offset / 60);
      const slotEndOffsetMinutes = offset + effectiveSlotLength;
      const slotEndAbsoluteHour = sessionStartHour + Math.floor(slotEndOffsetMinutes / 60);
      const slotEndIsExactlyOnHour = slotEndOffsetMinutes % 60 === 0;
      const lastH = slotEndIsExactlyOnHour ? slotEndAbsoluteHour - 1 : slotEndAbsoluteHour;

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
