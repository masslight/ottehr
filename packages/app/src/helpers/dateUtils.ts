import { capitalize } from '@mui/material';
import { DateTime, DateTimeJSOptions } from 'luxon';
import i18n from '../lib/i18n';

interface timezone {
  value: string;
  label: string;
}

export const availableTimezones = (date: DateTime | undefined): timezone[] => {
  if (!date) {
    date = DateTime.now();
  }
  const timezones = [
    { value: 'America/New_York', label: '' },
    { value: 'America/Chicago', label: '' },
    { value: 'America/Denver', label: '' },
    { value: 'America/Los_Angeles', label: '' },
  ];
  timezones.forEach((zone) => {
    if (date) {
      zone.label = date.setZone(zone.value).toFormat('ZZZZ');
    } else {
      throw new Error('Date in availableTimezones is undefined');
    }
  });
  return timezones;
};

export function createLocalDateTime(dateTime: DateTime | undefined, timezone: string): DateTime | undefined {
  let localDateTime: DateTime | undefined;
  if (dateTime !== undefined) {
    localDateTime = dateTime.setZone(timezone);
  }
  return localDateTime;
}

export function getBestTimezone(): string {
  // This gets the browser's current timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTimezoneLabel = DateTime.now().setZone(userTimezone).toFormat('ZZZZ');

  const availableTimezonesNow = availableTimezones(DateTime.now());

  const availableTimezoneForUser = availableTimezonesNow.find((timezone) => timezone.label === userTimezoneLabel);
  if (availableTimezoneForUser != null) {
    return availableTimezoneForUser.value;
  } else {
    // If the user isn't in the accepted list of timezones, set it to the first one (ET)
    return availableTimezonesNow[0].value;
  }
}

export function createDateTimeFromMDYString(dateString?: string, options?: DateTimeJSOptions): DateTime {
  return DateTime.fromFormat(dateString || '', 'MM/dd/yyyy', options) || '';
}

/*
    FHIR wants an iso string without time/timezone information. JS Date parser treats such
    a string as an invitation to convert from the local timezone to UTC, which can result
    in the string displayed in the date input text field being one day off from the actual
    value passed in.
    Converting from yyyy-mm-dd to MM/dd/yyyy prevents this parsing behavior from happening.
    https://stackoverflow.com/questions/7556591/is-the-javascript-date-object-always-one-day-off/31732581#31732581:~:text=All%20of%20this,an%20average%20person.


    The two functions below are for mapping back and forth from iso to mdy. While the user is inputting values we want
    to keep the date in mdy form. Before sending to the back end we want to map to the fhir-approved iso form.
    In no case do we want any time or timezone info in the date strings.

    If an input is provided in the format of the desired output, the input is simply returned.
  */

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

export const formatDateToMMDDYYYY = (date: any): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
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
    return mdyStringFromISOString(d || '');
  } catch (e) {
    return d;
  }
};

export function getLocaleDateTimeString(
  dateTime: DateTime | undefined,
  format: 'full' | 'weekday' | 'short',
  turnIntoCapital = true
): string {
  if (dateTime == null) {
    return '';
  }
  let dateFormat = '';
  switch (format) {
    case 'full':
      dateFormat = 'MMMM d, yyyy, h:mm a';
      break;
    case 'short':
      dateFormat = 'MMM d, h:mm a';
      break;
    case 'weekday':
      dateFormat = 'cccc, MMMM d';
      break;
  }
  const dateTimeString = dateTime.setLocale(i18n.language).toFormat(dateFormat);
  let returnString = turnIntoCapital ? capitalize(dateTimeString) : dateTimeString;
  if (format === 'full') {
    returnString += ' ' + dateTime.toFormat('ZZZZ');
  }
  return returnString;
}

// for now assuming timestamp will be in ISO format
export function getQueuedTimeFromTimestamp(timestamp: string): string {
  const now = new Date();
  const queuedDate = new Date(timestamp);

  const difference = now.getTime() - queuedDate.getTime();

  const minutes = Math.floor(difference / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours} hours`;
  return `${minutes} mins`;
}
