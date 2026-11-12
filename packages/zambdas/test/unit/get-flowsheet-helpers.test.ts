import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter, Observation, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import {
  VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
} from 'utils/lib/fhir/vitals';
import {
  FHIRObservationInterpretation,
  FHIRObservationInterpretationSystem,
  VitalAlertCriticality,
  VitalFieldNames,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test, vi } from 'vitest';
import { buildVitalsFlowsheet, describeVisit, fetchVisits } from '../../src/ehr/get-flowsheet/helpers';
import { index } from '../../src/ehr/get-flowsheet/index';

// wrapHandler's Sentry plumbing is not under test; make `index` the bare handler so its errors surface.
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
}));

const PATIENT = 'Patient/p1';
const interpretation = (code: FHIRObservationInterpretation): Observation['interpretation'] => [
  { coding: [{ system: FHIRObservationInterpretationSystem, code }] },
];

const vital = (
  field: VitalFieldNames,
  encounterId: string,
  effectiveDateTime: string,
  extra: Partial<Observation>
): Observation => ({
  resourceType: 'Observation',
  id: `${field}-${encounterId}-${effectiveDateTime}`,
  status: 'final',
  code: { text: field },
  subject: { reference: PATIENT },
  encounter: { reference: `Encounter/${encounterId}` },
  effectiveDateTime,
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`, code: field }] },
  ...extra,
});

const appointments: Appointment[] = [
  {
    resourceType: 'Appointment',
    id: 'a1',
    status: 'fulfilled',
    start: '2026-03-09T15:00:00.000Z',
    description: 'Cough',
    appointmentType: { text: 'walkin' },
    meta: { tag: [{ code: 'OTTEHR-IP' }] },
    participant: [],
  },
  {
    resourceType: 'Appointment',
    id: 'a2',
    status: 'fulfilled',
    start: '2026-11-06T14:00:00.000Z',
    meta: { tag: [{ code: 'OTTEHR-TM' }] },
    participant: [],
  },
];

const encounters: Encounter[] = [
  {
    resourceType: 'Encounter',
    id: 'e1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/a1' }],
    diagnosis: [{ condition: { reference: 'Condition/c2' } }, { condition: { reference: 'Condition/c1' }, rank: 1 }],
    participant: [{ type: [{ coding: PRACTITIONER_CODINGS.Attender }], individual: { reference: 'Practitioner/dr1' } }],
  },
  {
    resourceType: 'Encounter',
    id: 'e2',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/a2' }],
  },
  {
    resourceType: 'Encounter',
    id: 'e3',
    status: 'finished',
    class: { code: 'AMB' },
    type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
    appointment: [{ reference: 'Appointment/a1' }],
  },
];

const conditions: Condition[] = [
  {
    resourceType: 'Condition',
    id: 'c1',
    subject: { reference: PATIENT },
    code: { coding: [{ code: 'J06.9', display: 'Acute URI' }] },
  },
  {
    resourceType: 'Condition',
    id: 'c2',
    subject: { reference: PATIENT },
    code: { coding: [{ code: 'R05.9', display: 'Cough' }] },
  },
];
const practitioners: Practitioner[] = [
  { resourceType: 'Practitioner', id: 'dr1', name: [{ given: ['Ada'], family: 'Lovelace' }] },
];

const observations: Observation[] = [
  vital(VitalFieldNames.VitalTemperature, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 37.2 } }),
  // Two heart rates in one visit: the later one is kept, with its saved flag.
  vital(VitalFieldNames.VitalHeartbeat, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 80 } }),
  vital(VitalFieldNames.VitalHeartbeat, 'e1', '2026-03-09T15:30:00.000Z', {
    valueQuantity: { value: 131 },
    interpretation: interpretation(FHIRObservationInterpretation.CriticalHigh),
  }),
  vital(VitalFieldNames.VitalBloodPressure, 'e1', '2026-03-09T15:05:00.000Z', {
    component: [
      {
        code: { coding: [{ code: VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE }] },
        valueQuantity: { value: 142 },
        interpretation: interpretation(FHIRObservationInterpretation.AbnormalHigh),
      },
      { code: { coding: [{ code: VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE }] }, valueQuantity: { value: 88 } },
    ],
  }),
  // A saved BMI is read as-is, with no height/weight to derive it from.
  vital(VitalFieldNames.VitalBMI, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 23.4 } }),
  vital(VitalFieldNames.VitalWeight, 'e2', '2026-11-06T14:10:00.000Z', { valueQuantity: { value: 61.5 } }),
  // Follow-up readings are dated by the reading, not the parent appointment.
  vital(VitalFieldNames.VitalHeartbeat, 'e3', '2026-03-12T10:00:00.000Z', { valueQuantity: { value: 72 } }),
  // Readings whose encounter is unknown are placed by their own date.
  vital(VitalFieldNames.VitalHeartbeat, 'e-missing', '2025-12-01T09:00:00.000Z', { valueQuantity: { value: 66 } }),
];

describe('buildVitalsFlowsheet', () => {
  const visits = buildVitalsFlowsheet({ appointments, encounters, observations, conditions, practitioners });

  test('one column per encounter, newest first', () => {
    expect(visits.map((v) => v.encounterId)).toEqual(['e2', 'e3', 'e1', undefined]);
    expect(visits.map((v) => v.start)).toEqual([
      '2026-11-06T14:00:00.000Z',
      '2026-03-12T10:00:00.000Z',
      '2026-03-09T15:00:00.000Z',
      '2025-12-01T09:00:00.000Z',
    ]);
    expect(visits.map((v) => v.isFollowUp)).toEqual([false, true, false, false]);
  });

  test('keeps the latest reading per measure with the flag saved on the Observation', () => {
    const e1 = visits[2];
    expect(e1.values.temperature).toMatchObject({ value: 37.2, flag: undefined });
    expect(e1.values.heartRate).toMatchObject({ value: 131, flag: VitalAlertCriticality.Critical });
    expect(e1.values.systolic).toMatchObject({ value: 142, flag: VitalAlertCriticality.Abnormal });
    expect(e1.values.diastolic).toMatchObject({ value: 88, flag: VitalAlertCriticality.Abnormal });
    expect(e1.values.bmi).toMatchObject({ value: 23.4, flag: undefined });
    expect(e1.values.weight).toBeUndefined();
    expect(visits[0].values).toEqual({
      weight: { time: '2026-11-06T14:10:00.000Z', value: 61.5, flag: undefined, readings: [expect.any(Object)] },
    });
  });

  test('lists every reading of a measure in the visit, oldest first', () => {
    expect(visits[2].values.heartRate.readings).toEqual([
      { time: '2026-03-09T15:05:00.000Z', value: 80, flag: undefined },
      { time: '2026-03-09T15:30:00.000Z', value: 131, flag: VitalAlertCriticality.Critical },
    ]);
    expect(visits[2].values.temperature.readings).toHaveLength(1);
  });

  test('describes the visit from its appointment, encounter and attending provider', () => {
    expect(visits[2]).toMatchObject({
      appointmentId: 'a1',
      visitType: 'Walk-in · In-person',
      reason: 'Cough',
      primaryDiagnosis: 'J06.9 — Acute URI',
      attending: 'Ada Lovelace',
    });
    expect(visits[0]).toMatchObject({
      appointmentId: 'a2',
      visitType: 'Walk-in · Telemed',
      reason: '',
      primaryDiagnosis: '',
      attending: '',
    });
    expect(visits[3]).toMatchObject({ appointmentId: undefined, encounterId: undefined, visitType: '' });
  });
});

describe('fetchVisits', () => {
  // A follow-up charted without an appointment (save-followup-encounter only links one when given an appointment id).
  const followUp: Encounter = {
    resourceType: 'Encounter',
    id: 'e-fu',
    status: 'finished',
    class: { code: 'VR' },
    subject: { reference: PATIENT },
    type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
    diagnosis: [{ condition: { reference: 'Condition/c1' } }],
    participant: [{ type: [{ coding: PRACTITIONER_CODINGS.Attender }], individual: { reference: 'Practitioner/dr1' } }],
  };
  const bundle = (matches: unknown[], includes: unknown[] = []): unknown => ({
    total: matches.length,
    entry: [
      ...matches.map((resource) => ({ resource, search: { mode: 'match' } })),
      ...includes.map((resource) => ({ resource, search: { mode: 'include' } })),
    ],
    unbundle: () => [...matches, ...includes],
  });
  const has = (params: { name: string; value: string }[], name: string, value: string): boolean =>
    params.some((p) => p.name === name && p.value === value);
  const search = vi.fn(
    async ({ resourceType, params }: { resourceType: string; params: { name: string; value: string }[] }) => {
      switch (resourceType) {
        case 'Appointment':
          return bundle([appointments[0]], [encounters[0], encounters[2]]);
        case 'Encounter':
          // Only a server-built query by this patient and the follow-up type reaches the unlinked follow-up.
          return bundle(
            has(params, 'subject', PATIENT) &&
              has(params, 'type', `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}`)
              ? [encounters[2], followUp]
              : []
          );
        case 'Condition':
          return bundle(conditions);
        case 'Practitioner':
          return bundle(practitioners);
        default:
          return bundle([]);
      }
    }
  );
  const oystehr = { fhir: { search } } as unknown as Oystehr;

  test('reaches a follow-up with no appointment, so its column is described', async () => {
    const resources = await fetchVisits(oystehr, 'p1');
    expect(resources.encounters.map((e) => e.id)).toEqual(['e1', 'e3', 'e-fu']);
    expect(describeVisit('e-fu', resources)).toMatchObject({
      encounterId: 'e-fu',
      appointmentId: undefined,
      isFollowUp: true,
      start: undefined,
      primaryDiagnosis: 'J06.9 — Acute URI',
      attending: 'Ada Lovelace',
    });
  });
});

describe('get-flowsheet handler', () => {
  test('refuses an unauthenticated call before looking at the body', async () => {
    // An invalid body would be INVALID_INPUT if validation ran first; the missing bearer must win.
    const handler = index as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({ headers: {}, body: '{}', secrets: null })).rejects.toMatchObject({
      code: APIErrorCode.NOT_AUTHORIZED,
      statusCode: 401,
    });
  });
});
