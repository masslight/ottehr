import { describe, expect, it } from 'vitest';
import {
  planNeedsPatient,
  resolveParamTemplates,
  RunFetchPlanInputSchema,
  scopedStepValues,
  toElementName,
} from './fetch-plan';

describe('toElementName', () => {
  it('maps choice-type JSON keys to their FHIR base element name', () => {
    expect(toElementName('valueQuantity')).toBe('value');
    expect(toElementName('valueString')).toBe('value');
    expect(toElementName('effectiveDateTime')).toBe('effective');
    expect(toElementName('onsetDateTime')).toBe('onset');
    expect(toElementName('performedDateTime')).toBe('performed');
    expect(toElementName('medicationCodeableConcept')).toBe('medication');
    expect(toElementName('deceasedBoolean')).toBe('deceased');
  });

  it('leaves plain and look-alike names alone', () => {
    expect(toElementName('value')).toBe('value');
    expect(toElementName('performer')).toBe('performer');
    expect(toElementName('status')).toBe('status');
    expect(toElementName('component')).toBe('component');
    expect(toElementName('meta')).toBe('meta');
  });
});

describe('scopedStepValues', () => {
  const visits = [
    { resourceType: 'Appointment', id: 'a1', participant: [{ actor: { reference: 'Patient/p1' } }] },
    { resourceType: 'Encounter', id: 'e1', participant: [{ individual: { reference: 'Practitioner/d1' } }] },
    { resourceType: 'Encounter', id: 'e2', participant: [{ individual: { reference: 'Practitioner/d1' } }] },
    { resourceType: 'Patient', id: 'p1' },
  ];

  it('takes bare ids only from resources of keepType', () => {
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: 'encounter', keepType: 'Encounter' })).toEqual(
      ['Encounter/e1', 'Encounter/e2']
    );
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: '_id', keepType: 'Patient' })).toEqual(['p1']);
  });

  it('filters references by keepType regardless of the source resource type', () => {
    expect(
      scopedStepValues(visits, {
        step: 'visits',
        path: 'participant.individual.reference',
        param: '_id',
        keepType: 'Practitioner',
      })
    ).toEqual(['d1']);
    expect(
      scopedStepValues(visits, {
        step: 'visits',
        path: 'participant.actor.reference',
        param: 'beneficiary',
        keepType: 'Patient',
      })
    ).toEqual(['Patient/p1']);
  });

  it('takes every id when there is no keepType', () => {
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: '_id' })).toEqual(['a1', 'e1', 'e2', 'p1']);
  });
});

describe('resolveParamTemplates', () => {
  const range = { start: '2026-01-01T05:00:00.000Z', end: '2026-01-31T04:59:59.999Z' };

  it('fills the date range and the patient id', () => {
    expect(resolveParamTemplates('ge{{start}}', range)).toBe('ge2026-01-01T05:00:00.000Z');
    expect(resolveParamTemplates('{{startDate}}', range)).toBe('2026-01-01');
    expect(resolveParamTemplates('Patient/{{patientId}}', undefined, { patientId: 'p1' })).toBe('Patient/p1');
    expect(resolveParamTemplates('Patient/{{ patientId }}', range, { patientId: 'p1' })).toBe('Patient/p1');
  });

  it('names what is missing', () => {
    expect(() => resolveParamTemplates('Patient/{{patientId}}', range)).toThrow(/needs a patient id/);
    expect(() => resolveParamTemplates('ge{{start}}')).toThrow(/needs a date range/);
  });
});

describe('planNeedsPatient and the run input', () => {
  const plan = {
    version: 1 as const,
    steps: [
      { id: 'visits', resourceType: 'Appointment', params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] },
    ],
  };

  it('spots the template in any step', () => {
    expect(planNeedsPatient(plan)).toBe(true);
    expect(planNeedsPatient({ steps: [{ params: [{ name: 'date', value: 'ge{{start}}' }] }] })).toBe(false);
  });

  it('accepts parameters on the run input', () => {
    const parsed = RunFetchPlanInputSchema.parse({ plan, parameters: { patientId: 'p1' } });
    expect(parsed.parameters?.patientId).toBe('p1');
    expect(() => RunFetchPlanInputSchema.parse({ plan, parameters: { patientId: '' } })).toThrow();
  });
});
