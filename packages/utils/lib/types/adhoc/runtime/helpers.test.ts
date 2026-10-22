import type { Appointment, Condition, Encounter, Observation, Procedure } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  diagnosesOf,
  icd10Code,
  index,
  labResultsOf,
  procedureKind,
  proceduresOf,
  visitTiming,
  vitalsOf,
} from './helpers';

const tagged = <T extends { resourceType: string }>(resource: T, code: string): T => ({
  ...resource,
  meta: { tag: [{ code }] },
});

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'e1',
  status: 'finished',
  class: { code: 'AMB' },
  diagnosis: [
    { condition: { reference: 'Condition/c2' }, rank: 2 },
    { condition: { reference: 'Condition/c1' }, rank: 1 },
    { condition: { reference: 'Condition/missing' } },
  ],
};

const conditions: Condition[] = [
  tagged(
    {
      resourceType: 'Condition',
      id: 'c1',
      subject: { reference: 'Patient/p' },
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'J02.9', display: 'Acute pharyngitis' }] },
    },
    'diagnosis'
  ),
  tagged(
    {
      resourceType: 'Condition',
      id: 'c2',
      subject: { reference: 'Patient/p' },
      code: {
        coding: [
          { system: 'http://snomed.info/sct', code: '1' },
          { system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'R50.9', display: 'Fever' },
        ],
      },
    },
    'diagnosis'
  ),
];

const procedures: Procedure[] = [
  tagged(
    {
      resourceType: 'Procedure',
      id: 'pr1',
      status: 'completed',
      subject: { reference: 'Patient/p' },
      encounter: { reference: 'Encounter/e1' },
      code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '87880', display: 'Rapid Strep A' }] },
    },
    'cpt-code'
  ),
  tagged(
    {
      resourceType: 'Procedure',
      id: 'pr2',
      status: 'completed',
      subject: { reference: 'Patient/p' },
      encounter: { reference: 'Encounter/e1' },
      code: { coding: [{ code: '99213', display: 'Office visit, established, low complexity' }] },
    },
    'em-code'
  ),
  tagged(
    {
      resourceType: 'Procedure',
      id: 'pr3',
      status: 'completed',
      subject: { reference: 'Patient/p' },
      encounter: { reference: 'Encounter/e1' },
      code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '87880' }] },
    },
    'cpt-code'
  ),
];

describe('codes', () => {
  it('icd10Code prefers the icd-10 coding (either system)', () => {
    expect(icd10Code(conditions[0])).toBe('J02.9');
    expect(icd10Code(conditions[1])).toBe('R50.9');
    expect(icd10Code(undefined)).toBeUndefined();
  });

  it('procedureKind reads the meta tag', () => {
    expect(procedureKind(procedures[0])).toBe('cpt');
    expect(procedureKind(procedures[1])).toBe('em');
    expect(procedureKind({ ...procedures[0], meta: {} })).toBeUndefined();
  });

  it('diagnosesOf orders by rank, skips missing Conditions and flags the primary', () => {
    const idx = index([encounter], conditions);
    expect(diagnosesOf(encounter, idx).map((d) => [d.code, d.primary])).toEqual([
      ['J02.9', true],
      ['R50.9', false],
    ]);
  });

  it('proceduresOf dedupes codes and puts the E&M first', () => {
    const idx = index([encounter], procedures);
    expect(proceduresOf(encounter, idx).map((p) => `${p.kind}:${p.code}`)).toEqual(['em:99213', 'cpt:87880']);
    expect(proceduresOf({ ...encounter, id: 'other' }, idx)).toEqual([]);
  });
});

describe('labResultsOf', () => {
  it('pairs lab orders with results and counts abnormal tags', () => {
    const idx = index(
      [encounter],
      [
        {
          resourceType: 'ServiceRequest',
          id: 'sr1',
          status: 'completed',
          intent: 'order',
          subject: { reference: 'Patient/p' },
          encounter: { reference: 'Encounter/e1' },
          code: {
            coding: [
              { code: 'Rapid Strep A', system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code' },
              { code: '87880', system: 'http://www.ama-assn.org/go/cpt' },
            ],
          },
        },
        tagged(
          {
            resourceType: 'ServiceRequest',
            id: 'sr2',
            status: 'active',
            intent: 'plan',
            subject: { reference: 'Patient/p' },
            encounter: { reference: 'Encounter/e1' },
            code: { coding: [{ system: 'http://snomed.info/sct', code: '185389009' }] },
          },
          'sub-follow-up'
        ),
        tagged(
          {
            resourceType: 'DiagnosticReport',
            id: 'dr1',
            status: 'final',
            code: {
              coding: [
                { code: 'Rapid Strep A', system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code' },
              ],
            },
            encounter: { reference: 'Encounter/e1' },
          },
          'abnormal'
        ),
      ]
    );
    const labs = labResultsOf(encounter, idx);
    expect(labs.orders.map((o) => o.name)).toEqual(['Rapid Strep A']);
    expect(labs.results.map((r) => [r.name, r.abnormal])).toEqual([['Rapid Strep A', true]]);
    expect(labs.abnormal).toBe(1);
  });
});

describe('vitalsOf', () => {
  const vital = (tag: string, value: number, unit: string, at: string, extra: Partial<Observation> = {}): Observation =>
    tagged(
      {
        resourceType: 'Observation',
        id: `${tag}-${at}`,
        status: 'final',
        code: { text: tag },
        effectiveDateTime: at,
        valueQuantity: { value, unit },
        ...extra,
      },
      tag
    );

  it('takes the latest reading per vital, converts °C and reads BP components', () => {
    const vitals = vitalsOf([
      vital('vital-temperature', 37, 'C', '2026-01-01T10:00:00Z'),
      vital('vital-temperature', 38.5, 'C', '2026-01-01T11:00:00Z'),
      vital('vital-heartbeat', 88, 'beats/min', '2026-01-01T10:00:00Z'),
      vital('vital-oxygen-sat', 97, 'beats/min', '2026-01-01T10:00:00Z'),
      {
        ...vital('vital-blood-pressure', 0, '', '2026-01-01T10:00:00Z'),
        valueQuantity: undefined,
        component: [
          { code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: 120 } },
          { code: { coding: [{ code: '271650006' }] }, valueQuantity: { value: 80 } },
        ],
      },
    ]);
    expect(vitals.temperatureF).toBe(101.3);
    expect(vitals.heartRate).toBe(88);
    expect(vitals.oxygenSaturation).toBe(97);
    expect(vitals.systolicBP).toBe(120);
    expect(vitals.diastolicBP).toBe(80);
    expect(vitals.hasBloodPressure).toBe(true);
    expect(vitals.respirationRate).toBeUndefined();
    expect(vitals.count).toBe(5);
  });

  it('keeps Fahrenheit and reports a component-less BP as present but without values', () => {
    const vitals = vitalsOf([
      vital('vital-temperature', 99.1, 'F', '2026-01-01T10:00:00Z'),
      { ...vital('vital-blood-pressure', 0, '', '2026-01-01T10:00:00Z'), valueQuantity: undefined },
    ]);
    expect(vitals.temperatureF).toBe(99.1);
    expect(vitals.hasBloodPressure).toBe(true);
    expect(vitals.systolicBP).toBeUndefined();
    expect(vitalsOf([]).count).toBe(0);
  });
});

describe('visitTiming', () => {
  const status = (code: string, start: string, end?: string): NonNullable<Encounter['statusHistory']>[number] => ({
    status: 'in-progress',
    period: { start, end },
    extension: [{ url: 'https://extensions.fhir.zapehr.com/visit-status', valueCode: code }],
  });
  const appointment: Appointment = { resourceType: 'Appointment', id: 'a1', status: 'fulfilled', participant: [] };
  const timed: Encounter = {
    ...encounter,
    statusHistory: [
      status('pending', '2026-01-01T13:50:00Z', '2026-01-01T14:00:00Z'),
      status('arrived', '2026-01-01T14:00:00Z', '2026-01-01T14:10:00Z'),
      status('ready', '2026-01-01T14:10:00Z', '2026-01-01T14:20:00Z'),
      status('intake', '2026-01-01T14:20:00Z', '2026-01-01T14:30:00Z'),
      status('ready for provider', '2026-01-01T14:30:00Z', '2026-01-01T14:45:00Z'),
      status('provider', '2026-01-01T14:45:00Z', '2026-01-01T15:05:00Z'),
      status('discharged', '2026-01-01T15:05:00Z', '2026-01-01T15:15:00Z'),
      status('completed', '2026-01-01T15:15:00Z'),
    ],
  };

  it('reads the key instants and intervals from the status timeline', () => {
    const t = visitTiming(appointment, timed);
    expect(t.arrived).toBe('2026-01-01T14:00:00Z');
    expect(t.arrivedToIntake).toBe(20);
    expect(t.intakeToProvider).toBe(25);
    expect(t.arrivedToProvider).toBe(45);
    expect(t.providerToDischarge).toBe(20);
    expect(t.total).toBe(65);
    expect(t.withProvider).toBe(20);
    expect(t.completed).toBe('2026-01-01T15:15:00Z');
  });

  it('leaves intervals undefined when a status never happened', () => {
    const t = visitTiming(appointment, { ...encounter, statusHistory: [status('arrived', '2026-01-01T14:00:00Z')] });
    expect(t.arrived).toBe('2026-01-01T14:00:00Z');
    expect(t.provider).toBeUndefined();
    expect(t.arrivedToProvider).toBeUndefined();
    expect(t.total).toBeUndefined();
    expect(t.withProvider).toBeUndefined();
  });
});
