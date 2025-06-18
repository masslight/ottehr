import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TIMEZONE_EXTENSION_URL } from 'utils';

export const OVERRIDE_DATE_FORMAT = 'M/d/yyyy';

export const DATE_FORMAT = 'MM/dd/yyyy';

export function formatHourNumber(hour: number): string {
  return DateTime.fromFormat(String(hour), 'h').toFormat('h a');
}

export function formatDateUsingSlashes(date: string | undefined, timezone?: string): string | undefined {
  if (!date) {
    return date;
  }
  if (timezone) {
    return DateTime.fromISO(date).setZone(timezone).toFormat(DATE_FORMAT);
  } else {
    return DateTime.fromISO(date).toFormat(DATE_FORMAT);
  }
}

export function datesCompareFn(format: string) {
  return (d1: string, d2: string): number => {
    const seconds1 = DateTime.fromFormat(d1, format).toSeconds();
    const seconds2 = DateTime.fromFormat(d2, format).toSeconds();
    if (isNaN(seconds1) || isNaN(seconds2)) {
      return NaN;
    }
    return seconds1 - seconds2;
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

export function formatISOStringToDateAndTime(isoString: string, timezone?: string): string {
  let dateTime = DateTime.fromISO(isoString);
  if (timezone) {
    dateTime = dateTime.setZone(timezone);
  }

  const formattedDateTime = dateTime.toFormat(`${DATE_FORMAT}, HH:mm`);

  return formattedDateTime;
}

export function getTimezone(resource: Location | Practitioner | HealthcareService | undefined): string {
  let timezone = 'America/New_York';
  if (resource) {
    const timezoneTemp = resource.extension?.find((extensionTemp) => extensionTemp.url === TIMEZONE_EXTENSION_URL)
      ?.valueString;
    if (timezoneTemp) timezone = timezoneTemp;
  }

  return timezone;
}
