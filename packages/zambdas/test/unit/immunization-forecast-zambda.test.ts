// get-immunization-forecast: input validation, the staff role check and the server-side engine run.
import { Immunization, Patient } from 'fhir/r4b';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCallerHasRole } = vi.hoisted(() => ({ mockCallerHasRole: vi.fn() }));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callerHasRole: mockCallerHasRole,
}));

import { getImmunizationForecast, validateRequestParameters } from '../../src/ehr/immunization/get-forecast';
import { assertImmunizationStaff, IMMUNIZATION_STAFF_ROLES } from '../../src/ehr/immunization/records';

const input = (body: unknown): any => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer user-token' },
  secrets: null,
});

describe('get-immunization-forecast validateRequestParameters', () => {
  it('requires a patient id', () => {
    expect(() => validateRequestParameters(input({}))).toThrow(
      expect.objectContaining({ code: APIErrorCode.MISSING_REQUIRED_PARAMETERS })
    );
  });

  it('rejects a patient id that is not a FHIR id (no query strings reach the FHIR server)', () => {
    expect(() => validateRequestParameters(input({ patientId: 'x?_has:Encounter' }))).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  it('accepts an optional yyyy-mm-dd asOf and rejects anything else', () => {
    expect(validateRequestParameters(input({ patientId: 'maya', asOf: '2026-11-10' }))).toEqual({
      patientId: 'maya',
      asOf: '2026-11-10',
      secrets: null,
    });
    expect(validateRequestParameters(input({ patientId: 'maya' }))).toEqual({ patientId: 'maya', secrets: null });
    for (const asOf of ['11/10/2026', '2026-13-01', '2026-11-10T00:00:00Z', 5]) {
      expect(() => validateRequestParameters(input({ patientId: 'maya', asOf }))).toThrow(
        expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
      );
    }
  });
});

describe('get-immunization-forecast role check', () => {
  beforeEach(() => mockCallerHasRole.mockReset());

  it('allows every staff role, Customer Support included', () => {
    expect(IMMUNIZATION_STAFF_ROLES).toEqual(
      expect.arrayContaining([RoleType.Provider, RoleType.Clinician, RoleType.Staff, RoleType.CustomerSupport])
    );
  });

  it('refuses a caller without a staff role', async () => {
    mockCallerHasRole.mockResolvedValue(false);
    await expect(assertImmunizationStaff(input({ patientId: 'maya' }), 'read immunization forecasts')).rejects.toEqual(
      expect.objectContaining({ code: APIErrorCode.NOT_AUTHORIZED })
    );
    expect(mockCallerHasRole).toHaveBeenCalledWith('Bearer user-token', null, IMMUNIZATION_STAFF_ROLES);
  });

  it('lets a staff caller through', async () => {
    mockCallerHasRole.mockResolvedValue(true);
    await expect(
      assertImmunizationStaff(input({ patientId: 'maya' }), 'read immunization forecasts')
    ).resolves.toBeUndefined();
  });
});

describe('getImmunizationForecast', () => {
  const patient: Patient = { resourceType: 'Patient', id: 'maya', birthDate: '2026-07-08', gender: 'female' };
  const pentacel: Immunization = {
    resourceType: 'Immunization',
    id: 'dose-1',
    status: 'completed',
    primarySource: true,
    vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '120' }], text: 'Pentacel' },
    patient: { reference: 'Patient/maya' },
    occurrenceDateTime: '2026-09-09T14:30:00.000Z',
  };
  const oystehrWith = (resources: Immunization[], found = true): any => ({
    fhir: {
      get: vi.fn(async () => {
        if (!found) throw new Error('404');
        return patient;
      }),
      search: vi.fn(async () => ({
        unbundle: () => resources,
        link: [],
        entry: resources.map((resource) => ({ resource })),
        total: resources.length,
      })),
    },
  });

  it('runs the engine on the patient records and returns them with the forecast and the dob', async () => {
    const response = await getImmunizationForecast(oystehrWith([pentacel]), { patientId: 'maya', asOf: '2026-11-10' });
    expect(response.dob).toBe('2026-07-08');
    expect(response.immunizations.map((record) => record.id)).toEqual(['dose-1']);
    expect(response.forecast.asOf).toBe('2026-11-10');
    const dtap = response.forecast.groups.find((group) => group.group === 'dtap');
    expect(dtap?.doses[0]).toEqual(expect.objectContaining({ id: 'dose-1', doseNumber: 1, counted: true }));
    expect(dtap?.status).toBe('due');
  });

  it('says not found when the patient cannot be read', async () => {
    await expect(getImmunizationForecast(oystehrWith([], false), { patientId: 'maya' })).rejects.toEqual(
      expect.objectContaining({ code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND })
    );
  });
});
