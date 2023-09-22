import { DateTime } from 'luxon';

export function formatDate(date: DateTime): string {
  return `${date.toISO()}`;
}
