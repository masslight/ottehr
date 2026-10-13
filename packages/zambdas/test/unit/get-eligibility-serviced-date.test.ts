import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { makeCoverageEligibilityRequest } from '../../src/patient/get-eligibility/helpers';
import { getLocalDateOfService } from '../../src/shared/helpers';

const requestInput = {
  coverageReference: 'Coverage/coverage-1',
  payorReference: 'https://rcm-api.zapehr.com/v1/payer/60054',
  providerReference: 'Organization/billing-1',
  patientReference: 'Patient/patient-1',
};

const locationIn = (timezone: string): Location => ({
  resourceType: 'Location',
  id: 'location-1',
  extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: timezone }],
});

describe('get-eligibility — serviced date', () => {
  it("asks about the visit's date of service when one is given", () => {
    const request = makeCoverageEligibilityRequest({ ...requestInput, servicedDate: '2026-09-02' });
    expect(request.servicedDate).toBe('2026-09-02');
    expect(request.created).toBe(DateTime.now().toISODate());
  });

  it('falls back to today when the check is not for a visit', () => {
    const request = makeCoverageEligibilityRequest(requestInput);
    expect(request.servicedDate).toBe(DateTime.now().toISODate());
  });

  it("dates an evening visit by the location's time zone, not UTC", () => {
    // 7:30pm in Los Angeles is already the next day in UTC.
    expect(getLocalDateOfService('2026-10-14T02:30:00.000Z', locationIn('America/Los_Angeles'))).toBe('2026-10-13');
    expect(getLocalDateOfService('2026-10-13T19:30:00.000-07:00', locationIn('America/Los_Angeles'))).toBe(
      '2026-10-13'
    );
  });

  it('uses the default time zone when the visit has no location', () => {
    expect(getLocalDateOfService('2026-10-14T02:30:00.000Z', undefined)).toBe('2026-10-13');
  });
});
