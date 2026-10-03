import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { isFhirDateString, removeTimeFromDate } from './date';

describe('isFhirDateString', () => {
  it.each(['1990-01-15', '1990-01', '1990', '2024-02-29'])('accepts the FHIR date %s', (date) => {
    expect(isFhirDateString(date)).toBe(true);
  });

  // The whole point of the helper: Luxon reads all of these as valid dates, but FHIR's `date` type
  // only allows YYYY[-MM[-DD]] with dashes. Writing one of these to Patient.birthDate is what the
  // server answered with `Invalid date format - POST /Patient`.
  it.each([
    ['basic format', '19900115'],
    ['ordinal date', '1990-015'],
    ['week date', '1990-W03-1'],
    ['basic week date', '1990W031'],
    ['expanded year', '+001990-01-15'],
    ['year zero', '0000-01-15'],
  ])('rejects the Luxon-valid but FHIR-invalid %s %s', (_label, date) => {
    expect(DateTime.fromISO(date).isValid).toBe(true);
    expect(isFhirDateString(date)).toBe(false);
  });

  // The regex alone allows day 01-31 in every month, so the Luxon check still has to run.
  it.each(['1990-02-30', '1990-04-31'])('rejects the correctly shaped but non-existent date %s', (date) => {
    expect(isFhirDateString(date)).toBe(false);
  });

  it.each(['', 'not-a-date', '01/15/1990', '1990-1-5', '1990-13-01', ' 1990-01-15', '1990-01-15 '])(
    'rejects %s',
    (date) => {
      expect(isFhirDateString(date)).toBe(false);
    }
  );

  // Callers validate what removeTimeFromDate hands to FHIR, not the raw input, so a datetime has to
  // survive the round trip.
  it.each(['1990-01-15T00:00:00.000Z', '1990-01-15T12:30:00-05:00'])('accepts the date half of %s', (dateTime) => {
    expect(isFhirDateString(removeTimeFromDate(dateTime))).toBe(true);
  });
});
