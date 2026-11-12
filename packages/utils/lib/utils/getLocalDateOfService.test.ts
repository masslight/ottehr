import { Location } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { TIMEZONE_EXTENSION_URL } from '../types/constants';
import { InsuranceEligibilityCheckStatus } from '../types/data/paperwork/paperwork.types';
import { mapEligibilityCheckResultToSimpleStatus } from '../types/data/telemed/eligibility.types';
import { getLocalDateOfService } from './scheduleUtils';

const locationIn = (timezone: string): Location => ({
  resourceType: 'Location',
  extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: timezone }],
});

describe('getLocalDateOfService', () => {
  // 03:00Z on the 5th is still the evening of the 4th in the US.
  const start = '2025-03-05T03:00:00.000Z';

  it('is the calendar day in the location timezone, not UTC', () => {
    expect(getLocalDateOfService(start, locationIn('America/Los_Angeles'))).toBe('2025-03-04');
  });

  it('uses the default timezone when there is no location', () => {
    expect(getLocalDateOfService(start, undefined)).toBe('2025-03-04');
  });
});

describe('mapEligibilityCheckResultToSimpleStatus', () => {
  const base = { dateISO: '2026-01-01T00:00:00.000Z', servicedDate: '2025-03-04' };

  it.each([
    [InsuranceEligibilityCheckStatus.eligibilityConfirmed, 'ELIGIBLE'],
    [InsuranceEligibilityCheckStatus.eligibilityNotConfirmed, 'NOT ELIGIBLE'],
    [InsuranceEligibilityCheckStatus.eligibilityNotChecked, 'UNKNOWN'],
  ])('carries the date of service through for %s', (status, simple) => {
    const result = mapEligibilityCheckResultToSimpleStatus({ ...base, status });
    expect(result).toMatchObject({ status: simple, dateISO: base.dateISO, servicedDate: base.servicedDate });
  });
});
