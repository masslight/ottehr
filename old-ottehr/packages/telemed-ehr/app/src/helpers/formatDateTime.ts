import { HealthcareService, Location, Practitioner } from 'fhir/r4';
import { DateTime } from 'luxon';
import { TIMEZONE_EXTENSION_URL } from '../constants';

export const OVERRIDE_DATE_FORMAT = 'M/d/yyyy';

export const DATE_FORMAT = 'MM/dd/yyyy';

export function formatHourNumber(hour: number): string {
  return DateTime.fromFormat(String(hour), 'h').toFormat('h a');
}

export function formatDateUsingSlashes(date: string | undefined): string | undefined {
  if (!date) {
    return date;
  }
  return DateTime.fromISO(date).toFormat(DATE_FORMAT);
}

export function datesCompareFn(format: string) {
  return (d1: string, d2: string): number => {
    return DateTime.fromFormat(d1, format).toSeconds() - DateTime.fromFormat(d2, format).toSeconds();
  };
}

export function formatISODateToLocaleDate(date: string | undefined): string | undefined {
  if (!date) {
    return date;
  }

  const dateTime = DateTime.fromISO(date);

  const formattedDate = dateTime.toFormat('LLL dd, yyyy');

  return formattedDate;
}

export function calculateDuration(startISO: string, endISO: string): number {
  const start = DateTime.fromISO(startISO);
  const end = DateTime.fromISO(endISO);

  const duration = end.diff(start).as('minutes');

  return duration;
}

export function calculatePatientAge(date: string | undefined): string | undefined {
  if (!date) {
    return date;
  }

  const dob = DateTime.fromISO(date);
  const now = DateTime.now();
  const age = now.diff(dob, ['days', 'months', 'years']).toObject();

  if (age.years && age.years < 2) {
    if (age.months && age.months < 2) {
      return `(${age.days} d)`;
    } else {
      return `(${age.months} m)`;
    }
  } else {
    return `(${age.years} y)`;
  }
}

export function formatISOStringToDateAndTime(isoString: string): string {
  const dateTime = DateTime.fromISO(isoString);

  const formattedDateTime = dateTime.toFormat(`${DATE_FORMAT}, HH:mm`);

  return formattedDateTime;
}

export function getTimezone(resource: Location | Practitioner | HealthcareService | undefined): string {
  let timezone = 'America/New_York';
  if (resource) {
    const timezoneTemp = resource.extension?.find(
      (extensionTemp) => extensionTemp.url === TIMEZONE_EXTENSION_URL,
    )?.valueString;
    if (timezoneTemp) timezone = timezoneTemp;
  }

  return timezone;
}
