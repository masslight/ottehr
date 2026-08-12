import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TIMEZONE_EXTENSION_URL } from 'utils';

export const OVERRIDE_DATE_FORMAT = 'M/d/yyyy';

export const DATE_FORMAT = 'MM/dd/yyyy';

export function formatHourNumber(hour: number): string {
  return DateTime.fromFormat(String(hour), 'h').toFormat('h a');
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

/**
 * Renders a visit's date and time in the office's own zone rather than the reader's, and names that
 * zone — a visit at 9:30 AM in the office must not read as 6:30 AM to staff in another timezone.
 * Prefer the office's IANA zone so a stable regional abbreviation can be shown while the time still
 * observes daylight saving. Older payloads only carry an offset in the ISO value; those continue to
 * render an explicit UTC offset.
 */
export function formatVisitDateTimeWithZone(isoString: string, timezone?: string): string {
  const dateTime = DateTime.fromISO(isoString, { setZone: true });
  if (!timezone) return dateTime.toFormat('MM/dd/yyyy hh:mm a ZZZZ');

  const officeDateTime = dateTime.setZone(timezone);
  if (!officeDateTime.isValid) return dateTime.toFormat('MM/dd/yyyy hh:mm a ZZZZ');

  // shortGeneric yields the design's stable regional label (for example ET) instead of changing
  // between EST and EDT. The instant still observes daylight-saving time through the IANA zone.
  const zoneLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortGeneric',
  })
    .formatToParts(officeDateTime.toJSDate())
    .find((part) => part.type === 'timeZoneName')?.value;
  return `${officeDateTime.toFormat('MM/dd/yyyy hh:mm a')} ${zoneLabel ?? officeDateTime.toFormat('ZZZZ')}`;
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
