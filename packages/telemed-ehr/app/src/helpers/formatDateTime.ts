import { DateTime } from 'luxon';
import { Location } from 'fhir/r4';

export function formatHourNumber(hour: number): string {
  return DateTime.fromFormat(String(hour), 'h').toFormat('h a');
}

export function formatDateUsingSlashes(date: string | undefined, location?: Location): string | undefined {
  let locationTimeZone = 'America/New_York';
  if (location) {
    locationTimeZone = getTimezone(location);
  }

  if (!date) {
    return date;
  }
  return DateTime.fromISO(date).setZone(locationTimeZone).toFormat('MM/dd/yyyy');
}

export function datesCompareFn(d1: string, d2: string): number {
  return DateTime.fromFormat(d1, 'D').toSeconds() - DateTime.fromFormat(d2, 'D').toSeconds();
}

export function formatISODateToLocaleDate(date: string): string {
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

export function formatISOStringToDateAndTime(isoString: string): string {
  const dateTime = DateTime.fromISO(isoString);

  const formattedDateTime = dateTime.toFormat('MM/dd/yyyy, HH:mm');

  return formattedDateTime;
}

export function getTimezone(location: Location | undefined): string {
  let timezone = 'America/New_York';
  if (location) {
    const timezoneTemp = location.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;
    if (timezoneTemp) timezone = timezoneTemp;
  }

  return timezone;
}
