import Oystehr from '@oystehr/sdk';
import { Encounter, Immunization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  IMMUNIZATION_ENTERING_PROVIDER_CODE,
  IMMUNIZATION_INFORMATION_SOURCE_SYSTEM,
  IMMUNIZATION_MARK_REASON_SYSTEM,
  IMMUNIZATION_MARKS,
  IMMUNIZATION_PERFORMER_FUNCTION_SYSTEM,
  VACCINE_GROUP_CODE_SYSTEM,
} from 'utils/lib/fhir/immunization';
import { CVX_CODE_SYSTEM_URL } from 'utils/lib/types/api/medication-administration.constants';
import {
  GetPatientImmunizationsResponse,
  ImmunizationMark,
  PatientImmunizationRecord,
} from 'utils/lib/types/data/immunization/types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import { assessmentDate, isoDateOf, toForecastInput } from '../../src/ehr/immunization/forecast';
import { getImmunizationForecast, validateRequestParameters } from '../../src/ehr/immunization/get-forecast';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const { mockGetAllPages } = vi.hoisted(() => ({ mockGetAllPages: vi.fn() }));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({ getAllFhirSearchPages: mockGetAllPages }));

const TZ = 'America/New_York';

const record = (overrides: Partial<PatientImmunizationRecord> & { id: string }): PatientImmunizationRecord => ({
  vaccineName: 'Vaccine',
  outside: false,
  dateUnknown: !overrides.dateGiven,
  ...overrides,
});

const mark = (overrides: Partial<ImmunizationMark> & { id: string; group: string }): ImmunizationMark => ({
  vaccineGroup: { code: overrides.group, display: overrides.group },
  mark: 'declined',
  markedAt: '2026-11-10T15:00:00.000Z',
  markedBy: { name: 'J. Nurse' },
  ...overrides,
});

const maya: Patient = { resourceType: 'Patient', id: 'pat-maya', birthDate: '2026-07-08', gender: 'female' };

const thrown = (fn: () => unknown): any => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
};

describe('toForecastInput', () => {
  it('maps dated doses to ISO days in the practice zone, keeps undated and outside doses, drops doses without a CVX', () => {
    const records: GetPatientImmunizationsResponse = {
      immunizations: [
        record({ id: 'here', cvx: '08', dateGiven: '2026-08-11T02:30:00.000Z' }), // 10:30 pm on the 10th in New York
        record({ id: 'outside', cvx: '20', outside: true, dateGiven: '2026-10-01', sourceCode: '03' }),
        record({ id: 'undated', cvx: '20', outside: true, sourceCode: '01' }),
        record({ id: 'no-cvx', vaccineName: 'Mystery shot', dateGiven: '2026-09-01' }),
      ],
      marks: [],
    };

    const input = toForecastInput(maya, records, '2026-11-10', TZ);

    expect(input).toMatchObject({ dob: '2026-07-08', sex: 'female', asOf: '2026-11-10' });
    expect(input.doses).toEqual([
      { id: 'here', cvx: '08', date: '2026-08-10', source: 'administered' },
      { id: 'outside', cvx: '20', date: '2026-10-01', source: 'outside', outsideSource: '03' },
      { id: 'undated', cvx: '20', date: null, source: 'outside', outsideSource: '01' },
    ]);
  });

  it('keeps one active mark per group (the newest), ignoring cleared marks and unknown groups', () => {
    const records: GetPatientImmunizationsResponse = {
      immunizations: [],
      marks: [
        mark({ id: 'm-newest', group: 'rota', markedAt: '2026-11-10T15:00:00.000Z', note: 'Parents declined' }),
        mark({ id: 'm-older', group: 'rota', mark: 'contraindicated', markedAt: '2026-09-01T15:00:00.000Z' }),
        mark({
          id: 'm-cleared',
          group: 'dtap',
          cleared: { at: '2026-10-01T00:00:00.000Z', by: { name: 'Dr. Patel' } },
        }),
        mark({ id: 'm-unknown', group: 'not-a-group' }),
      ],
    };

    const input = toForecastInput(maya, records, '2026-11-10', TZ);

    expect(input.marks).toEqual({
      rota: { type: 'declined', date: '2026-11-10', by: 'J. Nurse', note: 'Parents declined' },
    });
  });

  it('refuses a patient without a date of birth', () => {
    const error = thrown(() =>
      toForecastInput({ resourceType: 'Patient' }, { immunizations: [], marks: [] }, '2026-11-10')
    );
    expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
  });
});

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
    expect(isoDateOf('not a date')).toBeUndefined();
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
  const visit: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { code: 'AMB' },
    subject: { reference: 'Patient/pat-maya' },
    period: { start: '2026-11-10T14:00:00.000Z' },
  };

  it("runs the engine on the patient's records as of the visit and returns the CVX → group map", async () => {
    mockGetAllPages.mockResolvedValue([
      outsideDose('hepb-1', '08', '2026-07-08'),
      { ...outsideDose('hepb-2', '08', '2026-08-10'), primarySource: true, reportOrigin: undefined },
      declinedRota,
    ]);
    const oystehr = mockOystehr({ 'Patient/pat-maya': maya, 'Encounter/enc-1': visit });

    const response = await getImmunizationForecast(oystehr, { patientId: 'pat-maya', encounterId: 'enc-1' });

    expect(mockGetAllPages).toHaveBeenCalledWith(
      { resourceType: 'Immunization', params: [{ name: 'patient', value: 'Patient/pat-maya' }] },
      oystehr
    );
    expect(response.forecast.asOf).toBe('2026-11-10');
    const byGroup = Object.fromEntries(response.forecast.groups.map((group) => [group.group, group]));
    expect(byGroup.hepb.doses.map((dose) => dose.doseNumber)).toEqual([1, 2]);
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
