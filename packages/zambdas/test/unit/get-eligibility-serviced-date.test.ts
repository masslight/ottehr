import Oystehr from '@oystehr/sdk';
import { Appointment, CoverageEligibilityResponse, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { parseCoverageEligibilityResponse } from 'utils/lib/fhir/billing';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { isFullFhirDateString } from 'utils/lib/utils/date';
import { describe, expect, it } from 'vitest';
import { makeCoverageEligibilityRequest } from '../../src/patient/get-eligibility/helpers';
import { getAppointmentDateOfService, validateRequestParameters } from '../../src/patient/get-eligibility/validation';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const LOCATION_ID = '22222222-2222-4222-8222-222222222222';

const requestInput = {
  coverageReference: 'Coverage/c1',
  payorReference: 'https://rcm-api.zapehr.com/v1/payer/60054',
  providerReference: 'Organization/o1',
  patientReference: `Patient/${PATIENT_ID}`,
};

const today = DateTime.now().toISODate();

describe('get-eligibility — date of service', () => {
  describe('makeCoverageEligibilityRequest', () => {
    it('defaults servicedDate to today', () => {
      expect(makeCoverageEligibilityRequest(requestInput).servicedDate).toBe(today);
    });

    it('uses the requested servicedDate and still stamps created with today', () => {
      const cer = makeCoverageEligibilityRequest({ ...requestInput, servicedDate: '2025-03-04' });
      expect(cer.servicedDate).toBe('2025-03-04');
      expect(cer.created).toBe(today);
    });
  });

  describe('validateRequestParameters', () => {
    const validate = (body: object): ReturnType<typeof validateRequestParameters> =>
      validateRequestParameters({ body: JSON.stringify(body), secrets: null } as any);

    it('passes a valid servicedDate through on the standard path', () => {
      expect(validate({ patientId: PATIENT_ID, coverageToCheck: 'primary', servicedDate: '2025-03-04' })).toMatchObject(
        {
          type: 'standard',
          servicedDate: '2025-03-04',
        }
      );
    });

    it.each(['2025-03', '2025', '03/04/2025', '2025-02-31', 20250304])('rejects servicedDate %s', (servicedDate) => {
      expect(() => validate({ patientId: PATIENT_ID, coverageToCheck: 'primary', servicedDate })).toThrow();
    });

    it('treats servicedDate as optional', () => {
      const result = validate({ patientId: PATIENT_ID, coverageToCheck: 'primary' });
      expect(result).toMatchObject({ type: 'standard', servicedDate: undefined });
    });
  });

  describe('isFullFhirDateString', () => {
    it('only accepts a complete, real calendar date', () => {
      expect(isFullFhirDateString('2025-03-04')).toBe(true);
      expect(isFullFhirDateString('2025-03')).toBe(false);
      expect(isFullFhirDateString('2025-13-01')).toBe(false);
    });
  });

  describe('getAppointmentDateOfService', () => {
    const location: Location = {
      resourceType: 'Location',
      id: LOCATION_ID,
      extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'Pacific/Auckland' }],
    };
    const oystehr = { fhir: { get: async () => location } } as unknown as Oystehr;
    const appointmentAt = (start: string): Appointment => ({
      resourceType: 'Appointment',
      status: 'fulfilled',
      start,
      participant: [{ actor: { reference: `Location/${LOCATION_ID}` }, status: 'accepted' }],
    });

    it('is the visit day in the location timezone, not UTC or the default zone', async () => {
      // 20:00 UTC on the 4th is already the morning of the 5th in Auckland (UTC+13 in March).
      expect(await getAppointmentDateOfService(appointmentAt('2025-03-04T20:00:00.000Z'), oystehr)).toBe('2025-03-05');
    });

    it('falls back to today without an appointment', async () => {
      expect(await getAppointmentDateOfService(undefined, oystehr)).toBe(today);
    });

    it('clamps a visit that has not happened yet to today', async () => {
      const future = DateTime.now().plus({ days: 10 }).toISO()!;
      expect(await getAppointmentDateOfService(appointmentAt(future), oystehr)).toBe(today);
    });
  });

  describe('parseCoverageEligibilityResponse', () => {
    const response = (extra: Partial<CoverageEligibilityResponse>): CoverageEligibilityResponse => ({
      resourceType: 'CoverageEligibilityResponse',
      status: 'active',
      purpose: ['benefits'],
      patient: { reference: `Patient/${PATIENT_ID}` },
      created: '2026-01-02T10:00:00.000Z',
      request: { reference: 'CoverageEligibilityRequest/r1' },
      outcome: 'complete',
      insurer: { reference: 'Organization/i1' },
      ...extra,
    });

    it('surfaces the date of service the check was for', () => {
      expect(parseCoverageEligibilityResponse(response({ servicedDate: '2025-03-04' })).servicedDate).toBe(
        '2025-03-04'
      );
    });

    it('leaves it unset for checks that did not record one', () => {
      expect(parseCoverageEligibilityResponse(response({}))).not.toHaveProperty('servicedDate');
    });
  });
});
