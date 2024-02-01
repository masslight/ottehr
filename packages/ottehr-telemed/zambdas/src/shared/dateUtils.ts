import { DateTime } from 'luxon';

export function createDateTimeInET(date: string): DateTime {
  return DateTime.fromISO(date, { zone: 'America/New_York' });
}

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}

export function formatDateForFHIR(date: string): string {
  const parts = date.split('/');
  const year = parts[2];
  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const outputDate = `${year}-${month}-${day}`;
  return outputDate;
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

export function removeTimeFromDate(date: string): string {
  return date.split('T')[0];
}
