import { DateTime, DateTimeJSOptions } from 'luxon';

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

export const ymdStringFromDateString = (dateString: string): string => {
  if (dateString.includes('/')) {
    return DateTime.fromFormat(dateString || '', 'MM/dd/yyyy').toISODate() || '';
  }

  if (DateTime.fromISO(dateString)) {
    return DateTime.fromISO(dateString || '').toISODate() || '';
  }

  throw new Error('Invalid format provided. Could not parse yyyy-mm-dd date from input.');
};

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

export const alphanumericRegex = /^[a-zA-Z0-9]+/;

export const yupSimpleDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

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
export const yupFHIRDateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
