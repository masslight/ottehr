import Oystehr from '@oystehr/sdk';
import { Appointment, Condition, Encounter, Observation, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PRIVATE_EXTENSION_BASE_URL, SERVICE_CATEGORY_SYSTEM, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS, FollowupSubtype } from 'utils/lib/fhir/encounter';
import {
  LOINC_SYSTEM,
  makeVitalsObservationDTO,
  VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
} from 'utils/lib/fhir/vitals';
import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { ServiceMode } from 'utils/lib/types/common';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { DEFAULT_VITALS_ALERT_CONFIG, vitalsAlertConfigToVitalsDef } from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test, vi } from 'vitest';
import { index } from '../../src/ehr/get-flowsheet/index';
import { describeVisit, fetchVisits, VisitResources } from '../../src/ehr/get-flowsheet/visits';
import { buildVitalsFlowsheet, VitalsFlowsheetResources } from '../../src/ehr/get-flowsheet/vitals';
import { resolveVitalAlertCriticality } from '../../src/shared/vitals-alert-config';

vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
}));

const PATIENT = 'Patient/p1';
const NOW = DateTime.fromISO('2026-11-20T12:00:00.000Z');
const vitalsAlertConfig = vitalsAlertConfigToVitalsDef(DEFAULT_VITALS_ALERT_CONFIG);

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
  performer: [{ reference: 'Practitioner/dr1' }],
  effectiveDateTime,
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`, code: field }] },
  ...extra,
});

const bloodPressure = (
  encounterId: string,
  effectiveDateTime: string,
  systolic: number,
  diastolic: number
): Observation =>
  vital(VitalFieldNames.VitalBloodPressure, encounterId, effectiveDateTime, {
    component: [
      {
        code: { coding: [{ system: LOINC_SYSTEM, code: VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE }] },
        valueQuantity: { value: systolic },
      },
      {
        code: { coding: [{ system: LOINC_SYSTEM, code: VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE }] },
        valueQuantity: { value: diastolic },
      },
    ],
  });

const appointment = (id: string, start: string, extra: Partial<Appointment> = {}): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'fulfilled',
  start,
  appointmentType: { text: 'walkin' },
  meta: { tag: [{ code: 'OTTEHR-IP' }] },
  participant: [],
  ...extra,
});

const encounter = (id: string, appointmentId?: string, extra: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  ...(appointmentId ? { appointment: [{ reference: `Appointment/${appointmentId}` }] } : {}),
  ...extra,
});

const followUp = (
  id: string,
  subtype: FollowupSubtype,
  appointmentId?: string,
  extra: Partial<Encounter> = {}
): Encounter =>
  encounter(id, appointmentId, {
    partOf: { reference: 'Encounter/e1' },
    type: buildFollowupEncounterType(subtype),
    ...extra,
  });

const appointments: Appointment[] = [
  appointment('a1', '2026-03-09T15:00:00.000Z', { description: 'Cough' }),
  appointment('a2', '2026-11-06T14:00:00.000Z', { meta: { tag: [{ code: 'OTTEHR-TM' }] } }),
];

const encounters: Encounter[] = [
  encounter('e1', 'a1', {
    diagnosis: [{ condition: { reference: 'Condition/c2' } }, { condition: { reference: 'Condition/c1' }, rank: 1 }],
    participant: [{ type: [{ coding: PRACTITIONER_CODINGS.Attender }], individual: { reference: 'Practitioner/dr1' } }],
  }),
  encounter('e2', 'a2'),
];

const conditions: Condition[] = [
  {
    resourceType: 'Condition',
    id: 'c1',
    subject: { reference: PATIENT },
    code: { coding: [{ code: 'J06.9', display: 'Acute upper respiratory infection, unspecified' }] },
  },
  {
    resourceType: 'Condition',
    id: 'c2',
    subject: { reference: PATIENT },
    code: { coding: [{ code: 'R05.9', display: 'Cough' }] },
  },
];
const practitioners: Practitioner[] = [
  { resourceType: 'Practitioner', id: 'dr1', name: [{ given: ['Ann', 'Marie'], family: 'Lee' }] },
];

const observations: Observation[] = [
  vital(VitalFieldNames.VitalTemperature, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 37.2 } }),
  vital(VitalFieldNames.VitalHeartbeat, 'e1', '2026-03-09T15:30:00.000Z', { valueQuantity: { value: 92 } }),
  vital(VitalFieldNames.VitalHeartbeat, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 180 } }),
  bloodPressure('e1', '2026-03-09T15:05:00.000Z', 122, 78),
  vital(VitalFieldNames.VitalBMI, 'e1', '2026-03-09T15:05:00.000Z', { valueQuantity: { value: 23.4 } }),
  vital(VitalFieldNames.VitalWeight, 'e2', '2026-11-06T14:10:00.000Z', { valueQuantity: { value: 61.5 } }),
];

const baseResources: VisitResources = { appointments, encounters, conditions, practitioners, locations: [] };

const build = (overrides: Partial<VitalsFlowsheetResources> = {}, currentEncounterId?: string): FlowsheetVisit[] =>
  buildVitalsFlowsheet(
    {
      ...baseResources,
      observations,
      performers: practitioners,
      birthDate: '1990-01-01',
      gender: 'female',
      vitalsAlertConfig,
      ...overrides,
    },
    { now: NOW, currentEncounterId }
  );

describe('buildVitalsFlowsheet readings', () => {
  const visits = build();

  test('lists every reading of a measure in its visit, oldest first', () => {
    expect(visits.map((v) => v.encounterId)).toEqual(['e2', 'e1']);
    expect(visits[1].values[VitalFieldNames.VitalHeartbeat]?.map((r) => [r.time, r.values])).toEqual([
      ['2026-03-09T15:05:00.000Z', [180]],
      ['2026-03-09T15:30:00.000Z', [92]],
    ]);
    expect(visits[1].values[VitalFieldNames.VitalTemperature]).toEqual([
      { time: '2026-03-09T15:05:00.000Z', values: [37.2], flag: undefined },
    ]);
    expect(visits[0].values).toEqual({
      [VitalFieldNames.VitalWeight]: [{ time: '2026-11-06T14:10:00.000Z', values: [61.5], flag: undefined }],
    });
  });

  test('reads a blood pressure as one reading of systolic and diastolic', () => {
    expect(visits[1].values[VitalFieldNames.VitalBloodPressure]?.map((r) => r.values)).toEqual([[122, 78]]);
  });

  test('keeps a blood pressure with a diastolic of 0', () => {
    const visits = build({ observations: [bloodPressure('e1', '2026-03-09T15:05:00.000Z', 110, 0)] });
    expect(visits[1].values[VitalFieldNames.VitalBloodPressure]?.map((r) => r.values)).toEqual([[110, 0]]);
  });

  test('leaves out a reading without a value or without a time', () => {
    const refused = vital(VitalFieldNames.VitalWeight, 'e1', '2026-03-09T15:05:00.000Z', {});
    const undated = { ...observations[0], effectiveDateTime: undefined };
    expect(build({ observations: [refused, undated] }).map((v) => v.values)).toEqual([{}, {}]);
  });

  test('an undated reading does not hide the dated ones of a visit without an appointment', () => {
    const dated = vital(VitalFieldNames.VitalHeartbeat, 'e-missing', '2025-12-01T09:00:00.000Z', {
      valueQuantity: { value: 66 },
    });
    const visits = build({ observations: [{ ...dated, id: 'undated', effectiveDateTime: undefined }, dated] });
    expect(visits.map((v) => v.start)).toContain('2025-12-01T09:00:00.000Z');
  });

  test('finds the vital by its vitals tag wherever it sits among the tags', () => {
    const tagged = {
      ...observations[0],
      meta: { tag: [{ system: 'other', code: 'first' }, ...(observations[0].meta?.tag ?? [])] },
    };
    const visits = build({ observations: [tagged] });
    expect(visits[1].values[VitalFieldNames.VitalTemperature]?.map((r) => r.values)).toEqual([[37.2]]);
  });

  test('leaves out a reading whose author is unknown, as the Vitals screen does', () => {
    expect(build({ performers: [] }).map((v) => v.values)).toEqual([{}, {}]);
  });

  test("flags each reading by the practice's current thresholds, as get-vitals does", () => {
    const flagOf = (o: Observation): VitalAlertCriticality | undefined =>
      resolveVitalAlertCriticality(o, makeVitalsObservationDTO(o)!, {
        patientDOB: '1990-01-01',
        patientSex: 'female',
        vitalsAlertConfig,
      });
    expect(flagOf(observations[2])).toBeDefined();
    expect(visits[1].values[VitalFieldNames.VitalHeartbeat]?.map((r) => r.flag)).toEqual([
      flagOf(observations[2]),
      flagOf(observations[1]),
    ]);
  });

  test('drops a saved BMI for a visit when the patient was under 24 months', () => {
    const bmiAt = (birthDate: string): unknown =>
      build({ birthDate }).find((v) => v.encounterId === 'e1')?.values[VitalFieldNames.VitalBMI];
    expect(bmiAt('2025-01-01')).toBeUndefined();
    expect(bmiAt('2024-03-09')).toMatchObject([{ values: [23.4] }]);
  });

  test('leaves out vision screenings', () => {
    const vision = vital(VitalFieldNames.VitalVision, 'e1', '2026-03-09T15:05:00.000Z', {
      component: [{ code: { text: 'left' }, valueString: '20/20' }],
    });
    expect(build({ observations: [vision] }).map((v) => v.values)).toEqual([{}, {}]);
  });
});

const LOS_ANGELES = {
  resourceType: 'Location' as const,
  id: 'l-la',
  extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/Los_Angeles' }],
};
const freeFormInLosAngeles = encounter('ff', undefined, {
  type: buildFollowupEncounterType('free-form'),
  location: [{ location: { reference: 'Location/l-la' } }],
});

describe('buildVitalsFlowsheet in the clinic time zone', () => {
  test('a BMI taken on the eve of the second birthday at the clinic is dropped', () => {
    const bmi = vital(VitalFieldNames.VitalBMI, 'ff', '2026-03-14T05:30:00.000Z', { valueQuantity: { value: 16.2 } });
    const weight = vital(VitalFieldNames.VitalWeight, 'ff', '2026-03-14T05:30:00.000Z', {
      valueQuantity: { value: 12 },
    });
    const visits = build({
      birthDate: '2024-03-14',
      observations: [bmi, weight],
      locations: [LOS_ANGELES],
      encounters: [...encounters, freeFormInLosAngeles],
    });
    expect(visits.find((v) => v.encounterId === 'ff')?.values).toEqual({
      [VitalFieldNames.VitalWeight]: [{ time: '2026-03-14T05:30:00.000Z', values: [12], flag: undefined }],
    });
  });
});

describe('buildVitalsFlowsheet columns', () => {
  test('a visit without vitals still gets its column', () => {
    const visits = build({ observations: [] });
    expect(visits.map((v) => [v.encounterId, v.start])).toEqual([
      ['e2', '2026-11-06T14:00:00.000Z'],
      ['e1', '2026-03-09T15:00:00.000Z'],
    ]);
  });

  test('a cancelled or no-show visit without vitals has no column', () => {
    const visits = build({
      observations: [],
      appointments: [
        appointments[0],
        appointments[1],
        appointment('a3', '2026-10-01T14:00:00.000Z', { status: 'cancelled' }),
        appointment('a4', '2026-10-02T14:00:00.000Z', { status: 'noshow' }),
        appointment('a5', '2026-10-03T14:00:00.000Z'),
      ],
      encounters: [
        ...encounters,
        encounter('e3', 'a3'),
        encounter('e4', 'a4'),
        encounter('e5', 'a5', { status: 'cancelled' }),
      ],
    });
    expect(visits.map((v) => v.encounterId)).toEqual(['e2', 'e1']);
  });

  test('the opened visit keeps its column even when it was cancelled', () => {
    const resources = {
      observations: [],
      appointments: [...appointments, appointment('a3', '2026-10-01T14:00:00.000Z', { status: 'cancelled' as const })],
      encounters: [...encounters, encounter('e3', 'a3')],
    };
    expect(build(resources).map((v) => v.encounterId)).toEqual(['e2', 'e1']);
    expect(build(resources, 'e3').map((v) => v.encounterId)).toEqual(['e2', 'e3', 'e1']);
  });

  test('a cancelled visit that has vitals keeps its column', () => {
    const visits = build({
      appointments: [...appointments, appointment('a3', '2026-10-01T14:00:00.000Z', { status: 'cancelled' })],
      encounters: [...encounters, encounter('e3', 'a3')],
      observations: [
        vital(VitalFieldNames.VitalHeartbeat, 'e3', '2026-10-01T14:05:00.000Z', { valueQuantity: { value: 70 } }),
      ],
    });
    expect(visits.map((v) => v.encounterId)).toEqual(['e2', 'e3', 'e1']);
  });

  test('a visit after today has no column unless it is the opened visit', () => {
    const resources = {
      observations: [],
      appointments: [
        ...appointments,
        appointment('a-today', '2026-11-20T22:00:00.000Z'),
        appointment('a-future', '2026-11-25T14:00:00.000Z'),
      ],
      encounters: [
        ...encounters,
        encounter('e-today', 'a-today', { status: 'planned' }),
        encounter('e-future', 'a-future', { status: 'planned' }),
      ],
    };
    expect(build(resources).map((v) => v.encounterId)).toEqual(['e-today', 'e2', 'e1']);
    expect(build(resources, 'e-future').map((v) => v.encounterId)).toEqual(['e-future', 'e-today', 'e2', 'e1']);
  });

  test("today is counted on the visit location's calendar", () => {
    const location = {
      resourceType: 'Location' as const,
      id: 'l1',
      extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/Los_Angeles' }],
    };
    const tonight = appointment('a-tonight', '2026-11-21T03:00:00.000Z', {
      participant: [{ actor: { reference: 'Location/l1' }, status: 'accepted' }],
    });
    const visits = build({
      observations: [],
      locations: [location],
      appointments: [...appointments, tonight],
      encounters: [...encounters, encounter('e-tonight', 'a-tonight', { status: 'planned' })],
    });
    expect(visits.map((v) => v.encounterId)).toEqual(['e-tonight', 'e2', 'e1']);
  });

  test('a scheduled follow-up gets its own column dated by its own appointment', () => {
    const visits = build({
      observations: [],
      appointments: [...appointments, appointment('a-fu', '2026-04-01T10:00:00.000Z')],
      encounters: [...encounters, followUp('fu-s', 'scheduled', 'a-fu', { status: 'planned' })],
    });
    expect(visits.map((v) => [v.encounterId, v.start, v.isFollowUp])).toEqual([
      ['e2', '2026-11-06T14:00:00.000Z', false],
      ['fu-s', '2026-04-01T10:00:00.000Z', true],
      ['e1', '2026-03-09T15:00:00.000Z', false],
    ]);
  });

  test('an annotation or free-form follow-up gets a column only with vitals, dated by its first vital', () => {
    const resources = {
      encounters: [...encounters, followUp('fu-a', 'annotation', 'a1'), followUp('fu-f', 'free-form')],
    };
    expect(build({ ...resources, observations: [] }).map((v) => v.encounterId)).toEqual(['e2', 'e1']);
    const withVitals = build({
      ...resources,
      observations: [
        vital(VitalFieldNames.VitalHeartbeat, 'fu-a', '2026-03-12T10:30:00.000Z', { valueQuantity: { value: 72 } }),
        vital(VitalFieldNames.VitalHeartbeat, 'fu-a', '2026-03-12T10:00:00.000Z', { valueQuantity: { value: 75 } }),
      ],
    });
    expect(withVitals.map((v) => [v.encounterId, v.start])).toEqual([
      ['e2', '2026-11-06T14:00:00.000Z'],
      ['fu-a', '2026-03-12T10:00:00.000Z'],
      ['e1', '2026-03-09T15:00:00.000Z'],
    ]);
  });

  test('a scheduled follow-up opened as the visit keeps its column even when it starts after today', () => {
    const resources = {
      observations: [],
      appointments: [...appointments, appointment('a-fu', '2026-12-01T10:00:00.000Z')],
      encounters: [...encounters, followUp('fu-s', 'scheduled', 'a-fu', { status: 'planned' as const })],
    };
    expect(build(resources).map((v) => v.encounterId)).toEqual(['e2', 'e1']);
    expect(build(resources, 'fu-s').map((v) => v.encounterId)).toEqual(['fu-s', 'e2', 'e1']);
  });

  test('vitals of an unknown encounter are placed by their own date', () => {
    const visits = build({
      observations: [
        vital(VitalFieldNames.VitalHeartbeat, 'e-missing', '2025-12-01T09:00:00.000Z', {
          valueQuantity: { value: 66 },
        }),
      ],
    });
    expect(visits.map((v) => [v.encounterId, v.start])).toEqual([
      ['e2', '2026-11-06T14:00:00.000Z'],
      ['e1', '2026-03-09T15:00:00.000Z'],
      [undefined, '2025-12-01T09:00:00.000Z'],
    ]);
  });

  test('an encounter entered in error has no column, even with vitals', () => {
    const visits = build({
      appointments: [...appointments, appointment('a3', '2026-10-01T14:00:00.000Z')],
      encounters: [...encounters, encounter('e3', 'a3', { status: 'entered-in-error' })],
      observations: [
        vital(VitalFieldNames.VitalHeartbeat, 'e3', '2026-10-01T14:05:00.000Z', { valueQuantity: { value: 70 } }),
      ],
    });
    expect(visits.map((v) => [v.encounterId, v.start])).toEqual([
      ['e2', '2026-11-06T14:00:00.000Z'],
      ['e1', '2026-03-09T15:00:00.000Z'],
    ]);
  });
});

describe('describeVisit', () => {
  test('describes the visit as the Visits tab does, with the primary diagnosis as code and name', () => {
    expect(describeVisit('e1', baseResources)).toMatchObject({
      appointmentId: 'a1',
      appointmentType: 'walk-in',
      serviceMode: ServiceMode['in-person'],
      reason: 'Cough',
      primaryDiagnosis: 'J06.9: Acute upper respiratory infection, unspecified',
      provider: 'Ann Lee',
      isFollowUp: false,
    });
    expect(describeVisit('e2', baseResources)).toMatchObject({
      appointmentId: 'a2',
      serviceMode: ServiceMode.virtual,
      reason: '',
      primaryDiagnosis: '',
      provider: '',
    });
  });

  test("a visit without an appointment takes its time zone from the encounter's location", () => {
    const resources: VisitResources = {
      ...baseResources,
      locations: [LOS_ANGELES],
      encounters: [...encounters, freeFormInLosAngeles],
    };
    expect(describeVisit('ff', resources).timezone).toBe('America/Los_Angeles');
  });

  test('a free-form encounter, which has no original visit, still reads its own type and reason', () => {
    const resources: VisitResources = {
      ...baseResources,
      encounters: [
        ...encounters,
        encounter('ff', undefined, {
          type: buildFollowupEncounterType('free-form'),
          reasonCode: [{ text: 'Phone call' }],
        }),
      ],
    };
    expect(describeVisit('ff', resources)).toMatchObject({
      isFollowUp: true,
      followupSubtype: 'free-form',
      followUpType: 'Follow-up Encounter',
      reason: 'Phone call',
      start: undefined,
    });
  });

  test('a follow-up carries its subtype, its original visit appointment and its own type, category and reason', () => {
    const resources: VisitResources = {
      ...baseResources,
      appointments: [
        {
          ...appointments[0],
          serviceCategory: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: 'urgent-care' }] }],
        },
        appointments[1],
        appointment('a-fu', '2026-04-01T10:00:00.000Z', { description: 'Recheck rash' }),
      ],
      encounters: [
        ...encounters,
        followUp('fu-a', 'annotation', 'a1', { reasonCode: [{ text: 'Result - Lab' }] }),
        followUp('fu-s', 'scheduled', 'a-fu'),
      ],
    };
    expect(describeVisit('fu-a', resources)).toMatchObject({
      isFollowUp: true,
      followupSubtype: 'annotation',
      originalAppointmentId: 'a1',
      start: undefined,
      followUpType: 'Follow-up Encounter',
      serviceCategory: 'urgent-care',
      reason: 'Result - Lab',
    });
    expect(describeVisit('fu-s', resources)).toMatchObject({
      isFollowUp: true,
      followupSubtype: 'scheduled',
      appointmentId: 'a-fu',
      originalAppointmentId: 'a1',
      start: '2026-04-01T10:00:00.000Z',
      followUpType: 'Follow-up Encounter',
      serviceCategory: 'urgent-care',
      reason: 'Recheck rash',
    });
    expect(describeVisit('e1', resources)).not.toHaveProperty('followupSubtype');
  });
});

describe('fetchVisits', () => {
  const unlinkedFollowUp: Encounter = {
    ...encounter('e-fu'),
    subject: { reference: PATIENT },
    type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
    diagnosis: [{ condition: { reference: 'Condition/c1' } }],
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
          return bundle([appointments[0]], [encounters[0]]);
        case 'Encounter':
          return bundle(
            has(params, 'subject', PATIENT) &&
              has(params, 'type', `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}`)
              ? [unlinkedFollowUp]
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

  test('reaches a follow-up that has no appointment', async () => {
    const resources = await fetchVisits({ fhir: { search } } as unknown as Oystehr, 'p1');
    expect(resources.encounters.map((e) => e.id)).toEqual(['e1', 'e-fu']);
    expect(describeVisit('e-fu', resources)).toMatchObject({
      encounterId: 'e-fu',
      appointmentId: undefined,
      isFollowUp: true,
      start: undefined,
      primaryDiagnosis: 'J06.9: Acute upper respiratory infection, unspecified',
    });
  });
});

describe('get-flowsheet handler', () => {
  test('refuses an unauthenticated call before looking at the body', async () => {
    const handler = index as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({ headers: {}, body: '{}', secrets: null })).rejects.toMatchObject({
      code: APIErrorCode.NOT_AUTHORIZED,
      statusCode: 401,
    });
  });
});
