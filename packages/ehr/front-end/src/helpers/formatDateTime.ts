import { DateTime } from 'luxon';

export function formatHourNumber(hour: number): string {
  return DateTime.fromFormat(String(hour), 'h').toFormat('h a');
}

export function formatDateUsingSlashes(date: string | undefined): string | undefined {
  if (!date) {
    return date;
  }
  return DateTime.fromISO(date).toLocaleString(DateTime.DATE_SHORT);
}
