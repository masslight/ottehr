import { Appointment } from 'fhir/r4';
import { DateTime } from 'luxon';

export const DATETIME_FULL_NO_YEAR = "MMMM d 'at' h:mm a ZZZZ";

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function formatDateTimeToLocaleString(datetime: string, format: 'date' | 'datetime', timezone?: string): string {
  if (!datetime) return '';
  if (format === 'date') {
    return DateTime.fromISO(datetime).toLocaleString(DateTime.DATE_SHORT);
  } else {
    if (!timezone) {
      throw new Error('No timezone provided');
    }

    const datetimeWithTimezone = DateTime.fromISO(datetime).setZone(timezone);

    if (!datetimeWithTimezone.isValid) {
      throw new Error('Invalid timezone');
    }

    return datetimeWithTimezone.toLocaleString({ ...DateTime.DATETIME_SHORT, timeZoneName: 'short' });
  }
}

export function createMinimumAndMaximumTime(date: DateTime, buffer?: number): { minimum: string; maximum: string } {
  const minimum = formatDate(date);
  const tomorrow = date.plus({ days: buffer ?? 1 });
  const maximum = formatDate(tomorrow.endOf('day'));
  return { minimum: minimum, maximum: maximum };
}

export const getDateTimeFromDateAndTime = (date: DateTime, hour: number): DateTime => {
  let combinedDateTime = null;
  combinedDateTime = date
    .set({
      hour: hour,
    })
    .startOf('hour');

  return combinedDateTime;
};

export const isISODateTime = (dateTimeString: string): boolean => {
  const test = DateTime.fromISO(dateTimeString);
  if (!test?.invalidReason) {
    return true;
  } else {
    return false;
  }
};

export const getAvailableSlots = (dateStrings: string[], timezone: string): string[] => {
  const CUTOFF_HOUR = 17;
  const currentTime = DateTime.now().setZone(timezone);
  const cutoffTime = currentTime.set({ hour: CUTOFF_HOUR, minute: 0, second: 0, millisecond: 0 });
  const isAfterCutoff = currentTime >= cutoffTime;

  const availableSlots = dateStrings.filter((dateString) => {
    const date = DateTime.fromISO(dateString).setZone(timezone);

    if (isAfterCutoff) {
      return date >= cutoffTime;
    } else {
      return date.toISODate() === currentTime.toISODate();
    }
  });

  return availableSlots;
};

export const distributeTimeSlots = (
  startTime: DateTime,
  capacity: number,
  openingTime: DateTime,
  closingTime: DateTime,
  currentAppointments: Appointment[],
): string[] => {
  // console.log(1, startTime, capacity, openingTime, closingTime);
  const ROUND_MINUTES = 15;

  // const minutesToDistributeInHour = Math.min(
  //   60,
  //   startTime.diff(openingTime, 'minutes').minutes,
  //   startTime.diff(closingTime, 'minutes').minutes
  // );

  // adjust startTime if minutes are not 00 to get an accurate minutesToDistributeInHour
  const adjustedStart: DateTime = startTime.minute !== 0 ? startTime.minus({ minutes: startTime.minute }) : startTime;

  const openingDifference = openingTime.diff(adjustedStart, 'minutes').minutes;
  const closingDifference = closingTime.diff(startTime, 'minutes').minutes;
  let minutesToDistributeInHour = 60;

  if (openingDifference > 0 && openingDifference < 60) {
    minutesToDistributeInHour = 30;
  } else if (closingDifference > 0 && closingDifference < 60) {
    minutesToDistributeInHour = 30;
  }

  const minutesPerSlot = minutesToDistributeInHour / capacity;
  const timeSlots: { [slot: string]: number } = {};
  let tempTime = startTime;
  // console.log(startTime.toISO(), capacity);
  for (let i = 0; i < capacity; i++) {
    let tempUpdatedRoundedMinute = Math.round(tempTime.minute / ROUND_MINUTES) * ROUND_MINUTES;
    // todo check if this is right
    if (tempUpdatedRoundedMinute === 60) {
      tempUpdatedRoundedMinute = 60 - ROUND_MINUTES;
    }
    const tempRoundedTime = tempTime.set({ minute: tempUpdatedRoundedMinute, second: 0, millisecond: 0 });
    tempTime = tempTime.plus({ minutes: minutesPerSlot });
    const timesSlotIndex = tempRoundedTime.toISO() || '';
    // console.log(1, tempRoundedTime.toISO());

    // Appointments are bookable an hour away from the current time
    if (tempRoundedTime < DateTime.now().setZone('UTC').plus({ hours: 1 })) {
      continue;
    }

    // If opening time is 10am the first slot is 10am.
    // If closing time is 7pm the last slot is 6:45pm.
    if (tempRoundedTime < openingTime || tempRoundedTime >= closingTime) {
      continue;
    }

    if (!timeSlots[timesSlotIndex]) {
      timeSlots[timesSlotIndex] = 0;
    }

    timeSlots[timesSlotIndex]++;
  }

  const availableSlots = Object.keys(timeSlots).filter((timeSlot) => {
    const numSlots = timeSlots[timeSlot];
    let numAppointments = 0;
    currentAppointments.forEach((appointmentTemp) => {
      if (appointmentTemp.start && appointmentTemp.start === DateTime.fromISO(timeSlot).setZone('UTC').toISO()) {
        numAppointments++;
      }
    });

    return numSlots > numAppointments;
  });
  // console.log(4, availableSlots);
  return availableSlots;
};
