import { DateTime } from 'luxon';

export const MINIMUM_AGE = 5;
export const MAXIMUM_AGE = 26;
export const DATETIME_FULL_NO_YEAR = 'MMMM d, h:mm a ZZZZ';
export const DATE_FULL_NO_YEAR = 'EEEE, MMMM d';

export function createLocalDateTime(dateTime: DateTime | undefined, timezone: string): DateTime | undefined {
  let localDateTime: DateTime | undefined;
  if (dateTime !== undefined) {
    localDateTime = dateTime.setZone(timezone);
  }
  return localDateTime;
}

export const isoStringFromMDYString = (mdyString: string): string => {
  const [month, day, year] = mdyString.split('/');
  if (month && day && year) {
    return `${year}-${month}-${day}`;
  }

  const [y, m, d] = mdyString.split('-');

  if (y && m && d) {
    return mdyString;
  }
  throw new Error('Invalid format provided. Could not parse yyyy-mm-dd date from input.');
};

export const ymdStringFromDateString = (dateString: string): string => {
  if (dateString.includes('/')) {
    return DateTime.fromFormat(dateString || '', 'MM/dd/yyyy').toISODate() || '';
  }

  if (DateTime.fromISO(dateString)) {
    return DateTime.fromISO(dateString || '').toISODate() || '';
  }

  throw new Error('Invalid format provided. Could not parse yyyy-mm-dd date from input.');
};

export const mdyStringFromISOString = (isoString: string): string => {
  const dateOnly = isoString.split('T')[0];
  const [year, month, day] = dateOnly.split('-');

  if (year && month && day) {
    return `${month}/${day}/${year}`;
  }

  const [m, d, y] = isoString.split('/');
  if (m && d && y) {
    return isoString;
  }
  throw new Error('Invalid format provided. Could not parse MM/dd/yyyy date from input.');
};

export const yupDateTransform = (d: any): string => {
  try {
    return ymdStringFromDateString(d || '');
  } catch (e) {
    return d;
  }
};

export function ageIsInRange(dateOfBirth: string): boolean {
  // make sure string is in iso format
  const iso = isoStringFromMDYString(dateOfBirth);
  const age = Math.floor(-DateTime.fromISO(iso).diffNow('years').years);
  return age >= MINIMUM_AGE && age <= MAXIMUM_AGE;
}

export function createMinimumAndMaximumTime(date: DateTime, buffer?: number): { minimum: DateTime; maximum: DateTime } {
  const minimum = date.plus({ hours: buffer ?? 24 });
  // Could do #plus({ months: 1 }), but 30 days is easier to test
  const maximum = date.plus({ days: 30 });
  return { minimum: minimum, maximum: maximum };
}
