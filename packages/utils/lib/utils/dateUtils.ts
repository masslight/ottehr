import { Appointment, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { formatDate } from 'utils';
import { Capacity, FIRST_AVAILABLE_SLOT_OFFSET_IN_MINUTES, SlotCapacityMap } from './scheduleUtils';

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

export const divideHourlyCapacityBySlotInverval = (
  now: DateTime,
  firstSlotTimeForHour: DateTime,
  capacity: number,
  closingTime: DateTime,
  minutesToDistributeInHour: number
): SlotCapacityMap => {
  const timeSlots: { [slot: string]: number } = {};
  const minutesPerSlot = Math.ceil(minutesToDistributeInHour / capacity);
  let tempTime = firstSlotTimeForHour;
  for (let i = 0; i < capacity; i++) {
    if (i > 0) {
      let getNewTempTime = firstSlotTimeForHour.plus({ minutes: minutesPerSlot * i });
      const minutes = getNewTempTime.minute;
      const adjustedMinutes = findNearest15Minute(minutes);
      getNewTempTime = getNewTempTime.set({ minute: adjustedMinutes, second: 0, millisecond: 0 });
      tempTime = getNewTempTime;
    }

    if (tempTime < now || tempTime >= closingTime) {
      continue;
    }
    if (!timeSlots[tempTime.toISO() || '']) {
      timeSlots[tempTime.toISO() || ''] = 0;
    }
    timeSlots[tempTime.toISO() || '']++;
  }
  console.log(timeSlots);
  return timeSlots;
};

/*
"Do it all at once rather than calling this on each hour"
export const getSlotsWithCapacity = (
  now: DateTime,
  startTime: DateTime,
  capacity: number,
  closingTime: DateTime
): SlotCapacityMap => {
  if (capacity === 0) {
    return {};
  }
  const minutesToDistributeInHour = 60;
  const minutesPerSlot = minutesToDistributeInHour / capacity;
  const timeSlots: { [slot: string]: number } = {};
  const diff = now.diff(startTime.plus({ hour: 1 })).toMillis();
  console.log('diffy', diff);
  const startFromNow = diff > 0;
  const startFrom = startFromNow ? now : startTime;

  console.log('closing time', closingTime.toISO(), minutesPerSlot);

  console.log('starting from', startFrom.toISO());

  for (let i = startFrom; i < closingTime; i = i.plus({ minutes: minutesPerSlot })) {
    timeSlots[i.toISO()] = 1;
  }

  console.log('timeslots from capacity', timeSlots);

  return evenlyDistributeSlots(timeSlots);
};
*/

export const removeSlotsForOpeningBuffer = (
  hourlyCapcity: Capacity[],
  slots: { [slot: string]: number },
  buffer: number,
  openingTime: DateTime,
  closingTime: DateTime
): { [slot: string]: number } => {
  const openingTimeWithBuffer = openingTime.plus({ minutes: buffer });
  const openingHourCapacity = hourlyCapcity.find((detail) => detail.hour === openingTimeWithBuffer.hour)?.capacity || 0;

  let filteredSlots: { [slot: string]: number } = {};
  // simple slot distribution
  if (buffer % 60 === 0 || openingHourCapacity > 4) {
    for (const [slot, value] of Object.entries(slots)) {
      const slotDateTime = DateTime.fromISO(slot);
      if (slotDateTime >= openingTimeWithBuffer) {
        filteredSlots[slot] = value;
      }
    }
  } else {
    // do not handle distributing slots on first hour of slots
    for (const [slot, value] of Object.entries(slots)) {
      const slotDateTime = DateTime.fromISO(slot, { setZone: true });
      if (slotDateTime.hour > openingTimeWithBuffer.hour) {
        filteredSlots[slot] = value;
      }
    }

    // handle first hour of slots distribution
    filteredSlots = {
      ...divideHourlyCapacityBySlotInverval(
        openingTimeWithBuffer,
        openingTimeWithBuffer,
        openingHourCapacity,
        closingTime,
        60 - openingTimeWithBuffer.minute
      ),
      ...filteredSlots,
    };
  }

  return filteredSlots;
};

export const removeSlotsForFirstBookableBuffer = (
  slots: { [slot: string]: number },
  buffer: number,
  now: DateTime
): { [slot: string]: number } => {
  const firstBookable = now.plus({ minute: buffer });
  const minutesToAdd = (15 - (firstBookable.minute % 15)) % 15;
  const firstBookableSlotTime = firstBookable.plus({ minutes: minutesToAdd }).set({ second: 0, millisecond: 0 }); // rounded up to nearest quarter hour
  const filteredSlots: { [slot: string]: number } = {};
  for (const [slot, value] of Object.entries(slots)) {
    const slotDateTime = DateTime.fromISO(slot);
    if (slotDateTime >= firstBookableSlotTime) {
      filteredSlots[slot] = value;
    }
  }
  return filteredSlots;
};

export const removeSlotsForClosingBuffer = (
  hourlyCapcity: Capacity[],
  slots: { [slot: string]: number },
  buffer: number,
  closingTime: DateTime
): { [slot: string]: number } => {
  const closingTimeWithBuffer = closingTime.minus({ minutes: buffer });
  let filteredSlots: { [slot: string]: number } = {};
  for (const [slot, value] of Object.entries(slots)) {
    const slotDateTime = DateTime.fromISO(slot);
    if (slotDateTime < closingTimeWithBuffer) {
      filteredSlots[slot] = value;
    }
  }

  // check slot distribution if buffer is not on the hour, ie not 0 or 60
  if (buffer % 60 !== 0) {
    const closingHourCapacity =
      hourlyCapcity.find((detail) => detail.hour === closingTimeWithBuffer.hour)?.capacity || 0;
    if (closingHourCapacity < 4) {
      filteredSlots = {
        ...filteredSlots,
        ...divideHourlyCapacityBySlotInverval(
          closingTimeWithBuffer.startOf('hour'),
          closingTimeWithBuffer.startOf('hour'),
          closingHourCapacity,
          closingTimeWithBuffer,
          closingTimeWithBuffer.minute
        ),
      };
    }
  }

  return filteredSlots;
};

interface ApplyBuffersInput {
  hourlyCapacity: Capacity[];
  slots: SlotCapacityMap;
  openingBufferMinutes: number;
  closingBufferMinutes: number;
  openingTime: DateTime;
  closingTime: DateTime;
  now: DateTime;
}
export const applyBuffersToSlots = (input: ApplyBuffersInput): SlotCapacityMap => {
  const { hourlyCapacity, slots, openingBufferMinutes, closingBufferMinutes, openingTime, closingTime, now } = input;
  const closingBufferApplied = removeSlotsForClosingBuffer(hourlyCapacity, slots, closingBufferMinutes, closingTime);
  const openingBufferApplied = removeSlotsForOpeningBuffer(
    hourlyCapacity,
    closingBufferApplied,
    openingBufferMinutes,
    openingTime,
    closingTime.minus({ minutes: closingBufferMinutes })
  );
  const firstBookableBufferApplied = removeSlotsForFirstBookableBuffer(
    openingBufferApplied,
    FIRST_AVAILABLE_SLOT_OFFSET_IN_MINUTES,
    now
  );
  return firstBookableBufferApplied;
};

export function settleSlots(timeSlotMap: { [slot: string]: number }): { [slot: string]: number } {
  const accumulator: { [slot: string]: number } = {};
  let accumlatedRoundage = 0;
  const entries = Object.entries(timeSlotMap);
  if (!entries.length) {
    return timeSlotMap;
  }
  // rounds all the non-integer slot capacities to make integers, keeping tabs
  // on what was sawed off / tacked on in the rounding
  const remapped = entries.reduce((accum, current) => {
    const [time, slots] = current;
    if (slots % 1 === 0) {
      accum[time] = slots;
    } else {
      accumlatedRoundage += slots - Math.round(slots);
      accum[time] = Math.round(slots);
    }
    return accum;
  }, accumulator);
  // represents how much we're over/under capacity as a result of rounding to integers
  const residue = Math.round(accumlatedRoundage);
  if (residue !== 0) {
    const residueArray = Array(Math.abs(residue)).fill(residue / Math.abs(residue));
    residueArray.forEach((unit, index) => {
      const item = Object.entries(remapped)[index * 2];
      remapped[item[0]] = item[1] += unit;
    });
  }
  return remapped;
}

export const findNearest15Minute = (minute: number): number => {
  const minuteMod = minute % 15;
  if (minuteMod === 0) {
    return minute;
  } else {
    if (minuteMod > 15 / 2) {
      if (minute + (15 - minuteMod) === 60) {
        return 0;
      } else {
        return minute + (15 - minuteMod);
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
