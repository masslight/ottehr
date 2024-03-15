import { DateTime } from 'luxon';

export function flagDateOfBirth(dateString: string): boolean {
  const currentDate = DateTime.now();
  const targetDate = DateTime.fromISO(dateString);

  // Calculate the difference in days
  const daysDifference = currentDate.diff(targetDate, 'days').days;

  // Check if the target date is within 90 days from now
  const isWithin90Days = daysDifference >= 0 && daysDifference <= 90;

  return isWithin90Days;
}
