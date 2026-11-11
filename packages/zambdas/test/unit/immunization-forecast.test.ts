import Oystehr from '@oystehr/sdk';
import { Encounter, Immunization, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  IMMUNIZATION_ENTERING_PROVIDER_CODE,
  IMMUNIZATION_INFORMATION_SOURCE_SYSTEM,
  IMMUNIZATION_MARK_REASON_SYSTEM,
  IMMUNIZATION_MARKS,
  IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM,
  VACCINE_GROUP_CODE_SYSTEM,
} from 'utils/lib/fhir/immunization';
import { CVX_CODE_SYSTEM_URL } from 'utils/lib/types/api/medication-administration.constants';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assessmentDate } from '../../src/ehr/immunization/forecast';
import { getImmunizationForecast, validateRequestParameters } from '../../src/ehr/immunization/get-forecast';
import { assertImmunizationStaff, IMMUNIZATION_STAFF_ROLES } from '../../src/ehr/immunization/records';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const { mockGetAllPages, mockCallerHasRole } = vi.hoisted(() => ({
  mockGetAllPages: vi.fn(),
  mockCallerHasRole: vi.fn(),
}));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: mockGetAllPages }));
vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callerHasRole: mockCallerHasRole,
}));

const TZ = 'America/New_York';

const maya: Patient = { resourceType: 'Patient', id: 'pat-maya', birthDate: '2026-07-08', gender: 'female' };

const thrown = (fn: () => unknown): any => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
};

describe('assessmentDate', () => {
  it("is the visit's day in the practice zone when the encounter has started, else today", () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { code: 'AMB' },
      period: { start: '2026-11-11T03:30:00.000Z' }, // 10:30 pm on the 10th in New York
    };
    const now = DateTime.fromISO('2026-12-01T12:00:00', { zone: TZ });

    expect(assessmentDate(encounter, now, TZ)).toBe('2026-11-10');
    expect(assessmentDate(encounter, now)).toBe('2026-11-11');
    expect(assessmentDate(undefined, now)).toBe('2026-12-01');
    expect(assessmentDate({ ...encounter, period: undefined }, now)).toBe('2026-12-01');
  });
});

const outsideDose = (id: string, cvx: string, date: string): Immunization => ({
  resourceType: 'Immunization',
  id,
  status: 'completed',
  primarySource: false,
  reportOrigin: { coding: [{ system: IMMUNIZATION_INFORMATION_SOURCE_SYSTEM, code: '03' }] },
  vaccineCode: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }], text: 'Engerix-B' },
  patient: { reference: 'Patient/pat-maya' },
  occurrenceDateTime: date,
});

const declinedRota: Immunization = {
  resourceType: 'Immunization',
  id: 'mark-rota',
  status: 'not-done',
  statusReason: { coding: [{ system: IMMUNIZATION_MARK_REASON_SYSTEM, code: IMMUNIZATION_MARKS.declined.code }] },
  vaccineCode: { coding: [{ system: VACCINE_GROUP_CODE_SYSTEM, code: 'rota' }], text: 'Rotavirus' },
  patient: { reference: 'Patient/pat-maya' },
  occurrenceDateTime: '2026-11-10T15:00:00.000Z',
  recorded: '2026-11-10T15:00:00.000Z',
  performer: [
    {
      function: {
        coding: [{ system: IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM, code: IMMUNIZATION_ENTERING_PROVIDER_CODE }],
      },
      actor: { reference: 'Practitioner/nurse', display: 'J. Nurse' },
    },
  ],
};

const mockOystehr = (resources: Record<string, unknown>): Oystehr =>
  ({
    fhir: {
      get: vi.fn(async ({ resourceType, id }: { resourceType: string; id: string }) => {
        const resource = resources[`${resourceType}/${id}`];
        if (!resource) throw new Error('not found');
        return resource;
      }),
    },
  }) as unknown as Oystehr;

describe('getImmunizationForecast', () => {
  const clinic: Location = {
    resourceType: 'Location',
    id: 'loc-ny',
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: TZ }],
  };
  // 11:30 pm on the 10th in New York: the visit's day is the 10th, not the UTC 11th
  const visit: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { code: 'AMB' },
    subject: { reference: 'Patient/pat-maya' },
    location: [{ location: { reference: 'Location/loc-ny' } }],
    period: { start: '2026-11-11T04:30:00.000Z' },
  };

  it("runs the engine on the patient's records as of the visit's day in its location's zone, and returns them with the CVX → group map and the dob", async () => {
    mockGetAllPages.mockResolvedValue([
      outsideDose('hepb-1', '08', '2026-07-08'),
      // 10:30 pm on Aug 10 in New York: the second dose is 33 days after the first, not 34
      { ...outsideDose('hepb-2', '08', '2026-08-11T02:30:00.000Z'), primarySource: true, reportOrigin: undefined },
      declinedRota,
    ]);
    const oystehr = mockOystehr({ 'Patient/pat-maya': maya, 'Encounter/enc-1': visit, 'Location/loc-ny': clinic });

    const response = await getImmunizationForecast(oystehr, { patientId: 'pat-maya', encounterId: 'enc-1' });

    expect(mockGetAllPages).toHaveBeenCalledWith(
      { resourceType: 'Immunization', params: [{ name: 'patient', value: 'Patient/pat-maya' }] },
      oystehr
    );
    expect(response.forecast.asOf).toBe('2026-11-10');
    expect(response.dob).toBe('2026-07-08');
    expect(response.immunizations.map((record) => record.id)).toEqual(['hepb-2', 'hepb-1']);
    expect(response.marks.map((mark) => mark.id)).toEqual(['mark-rota']);
    const byGroup = Object.fromEntries(response.forecast.groups.map((group) => [group.group, group]));
    expect(byGroup.hepb.doses.map((dose) => dose.doseNumber)).toEqual([1, 2]);
    expect(byGroup.hepb.doses[1].date).toBe('2026-08-10');
    expect(byGroup.hepb.status).toBe('uptodate');
    expect(byGroup.rota.status).toBe('declined');
    expect(byGroup.rota.mark).toMatchObject({ type: 'declined', by: 'J. Nurse' });
    expect(['due', 'pastdue']).toContain(byGroup.dtap.status);
    // The CDC data names forecast vaccine types only where the recommendation is product-specific (PCV15/PCV20);
    // DTaP's list is empty, which is why the Due today box also reads the CVX → group map below.
    expect(byGroup.dtap.next?.cvx).toEqual([]);
    expect(byGroup.pcv.next?.cvx).toEqual(['215', '216']);
    expect(response.cvxGroups['120']).toEqual(expect.arrayContaining(['dtap', 'hib', 'ipv']));
    expect(response.cvxGroups['146']).toEqual(expect.arrayContaining(['dtap', 'hib', 'ipv', 'hepb']));
  });

  it('takes the given day without a visit, and today without either', async () => {
    mockGetAllPages.mockResolvedValue([]);
    const oystehr = mockOystehr({ 'Patient/pat-maya': maya });
    const now = DateTime.fromISO('2026-12-01T12:00:00', { zone: TZ });

    expect(
      (await getImmunizationForecast(oystehr, { patientId: 'pat-maya', asOf: '2026-11-20' }, now)).forecast.asOf
    ).toBe('2026-11-20');
    expect((await getImmunizationForecast(oystehr, { patientId: 'pat-maya' }, now)).forecast.asOf).toBe('2026-12-01');
  });

  it('says not found when the patient cannot be read', async () => {
    await expect(getImmunizationForecast(mockOystehr({}), { patientId: 'pat-maya' })).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
  });

  it("refuses an encounter that is not the patient's", async () => {
    const oystehr = mockOystehr({
      'Patient/pat-maya': maya,
      'Encounter/enc-other': { ...visit, id: 'enc-other', subject: { reference: 'Patient/someone-else' } },
    });

    await expect(
      getImmunizationForecast(oystehr, { patientId: 'pat-maya', encounterId: 'enc-other' })
    ).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
    expect(mockGetAllPages).not.toHaveBeenCalledWith(expect.anything(), oystehr);
  });

  it('accepts an optional yyyy-mm-dd asOf and rejects anything else', () => {
    expect(validateRequestParameters(createMockZambdaInput({ patientId: 'maya', asOf: '2026-11-10' }))).toEqual({
      patientId: 'maya',
      asOf: '2026-11-10',
      secrets: null,
    });
    for (const asOf of ['11/10/2026', '2026-13-01', '2026-11-10T00:00:00Z', 5]) {
      expect(thrown(() => validateRequestParameters(createMockZambdaInput({ patientId: 'maya', asOf }))).code).toBe(
        APIErrorCode.INVALID_INPUT
      );
    }
  });

  it('validates the ids and takes the encounter as optional', () => {
    expect(validateRequestParameters(createMockZambdaInput({ patientId: 'pat-1' }))).toEqual({
      patientId: 'pat-1',
      secrets: null,
    });
    expect(validateRequestParameters(createMockZambdaInput({ patientId: 'pat-1', encounterId: 'enc-1' }))).toEqual({
      patientId: 'pat-1',
      encounterId: 'enc-1',
      secrets: null,
    });
    expect(thrown(() => validateRequestParameters(createMockZambdaInput({}))).code).toBe(
      APIErrorCode.MISSING_REQUIRED_PARAMETERS
    );
    expect(
      thrown(() => validateRequestParameters(createMockZambdaInput({ patientId: 'pat-1', encounterId: 'Encounter/x' })))
        .code
    ).toBe(APIErrorCode.INVALID_INPUT);
  });
});

describe('get-immunization-forecast role check', () => {
  beforeEach(() => mockCallerHasRole.mockReset());
  const input = (body: unknown): any => ({
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer user-token' },
    secrets: null,
  });

  it('allows every staff role, Customer Support included', () => {
    expect(IMMUNIZATION_STAFF_ROLES).toEqual(
      expect.arrayContaining([RoleType.Provider, RoleType.Clinician, RoleType.Staff, RoleType.CustomerSupport])
    );
  });

  it('refuses a caller without a staff role and lets a staff caller through', async () => {
    mockCallerHasRole.mockResolvedValue(false);
    await expect(assertImmunizationStaff(input({ patientId: 'maya' }), 'read immunization forecasts')).rejects.toEqual(
      expect.objectContaining({ code: APIErrorCode.NOT_AUTHORIZED })
    );
    expect(mockCallerHasRole).toHaveBeenCalledWith('Bearer user-token', null, IMMUNIZATION_STAFF_ROLES);
    mockCallerHasRole.mockResolvedValue(true);
    await expect(
      assertImmunizationStaff(input({ patientId: 'maya' }), 'read immunization forecasts')
    ).resolves.toBeUndefined();
  });
});
