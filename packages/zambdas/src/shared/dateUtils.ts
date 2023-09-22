import { DateTime } from 'luxon';

export function removeTimeFromDate(date: string): string {
  return date.split('T')[0];
}

export function createDateTimeInET(date: string): DateTime {
  return DateTime.fromISO(date, { zone: 'America/New_York' });
}

export function formatDateForFHIR(date: string): string {
  const parts = date.split('/');
  const year = parts[2];
  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const outputDate = `${year}-${month}-${day}`;
  return outputDate;
}

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function createMinimumAndMaximumTime(date: DateTime, buffer?: number): { minimum: string; maximum: string } {
  const minimum = formatDate(date);
  const tomorrow = date.plus({ days: buffer ?? 1 });
  const maximum = formatDate(tomorrow.endOf('day'));
  return { minimum: minimum, maximum: maximum };
}

export const getDateTimeFromDateAndTime = (currentDate: DateTime, currentTime: string): DateTime => {
  const time = DateTime.fromFormat(currentTime, 'HH:mm:ss');
  // Combine date and time into a single DateTime object
  const combinedDateTime = currentDate
    .set({
      hour: time.hour,
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

export const getAvailableSlots = (dateStrings: string[]): string[] => {
  const currentTime = DateTime.local();
  const cutoff5pm = currentTime.set({ hour: 17, minute: 0, second: 0 });

  const isAfterCutoff = currentTime >= cutoff5pm;

  const availableSlots = dateStrings.filter((dateString) => {
    const date = DateTime.fromISO(dateString);

    if (isAfterCutoff) {
      return date >= cutoff5pm;
    } else {
      return date.hasSame(currentTime, 'day');
    }
  });

  return availableSlots;
};
