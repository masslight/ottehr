import { describe, expect, it } from 'vitest';
import {
  ASYNC_BULK_TARGET,
  bulkWindowCount,
  FETCH_PLAN_LIMITS,
  PAGED_WINDOW_TARGET,
  pagedWindowCount,
  planNeedsPatient,
  resolveParamTemplates,
  RunFetchPlanInputSchema,
  scopedBulkBatchSize,
  scopedPagedBatchSize,
  scopedStepValues,
  stepIsDateBounded,
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

describe('stepIsDateBounded', () => {
  it('needs both ends of the range, as instants or days', () => {
    expect(
      stepIsDateBounded({
        params: [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
        ],
      })
    ).toBe(true);
    expect(
      stepIsDateBounded({
        params: [
          { name: 'date', value: 'ge{{ startDate }}' },
          { name: 'date', value: 'le{{endDate}}' },
        ],
      })
    ).toBe(true);
    expect(stepIsDateBounded({ params: [{ name: 'date', value: 'ge{{start}}' }] })).toBe(false);
    expect(stepIsDateBounded({ params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] })).toBe(false);
    expect(stepIsDateBounded({})).toBe(false);
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

  it('accepts density hints per step, and none at all', () => {
    const hints = { visits: { recordsPerDay: 441.4 }, vitals: { recordsPerId: 6.5 } };
    expect(RunFetchPlanInputSchema.parse({ plan, hints }).hints).toEqual(hints);
    expect(RunFetchPlanInputSchema.parse({ plan }).hints).toBeUndefined();
    expect(() => RunFetchPlanInputSchema.parse({ plan, hints: { visits: { recordsPerDay: -1 } } })).toThrow();
  });
});

describe('bulk job sizing', () => {
  it('cuts a date range into windows of about the target, one without a hint', () => {
    // 161,116 observations over a year of synth: 441 a day → 9 jobs of ~18,000 instead of one cut at 30,000.
    expect(bulkWindowCount(441.4, 365)).toBe(Math.ceil((441.4 * 365) / ASYNC_BULK_TARGET));
    expect(bulkWindowCount(441.4, 365)).toBe(9);
    expect(bulkWindowCount(441.4, 7)).toBe(1);
    expect(bulkWindowCount(undefined, 365)).toBe(1);
    expect(bulkWindowCount(0, 365)).toBe(1);
  });

  it('cuts a paged step into windows of a few pages each', () => {
    // A year of synth visits (7.4 a day, 2,697) → 2 windows; 2,500 a day → 365.
    expect(pagedWindowCount(7.4, 365)).toBe(2);
    expect(pagedWindowCount(2500, 365)).toBe(Math.ceil((2500 * 365) / PAGED_WINDOW_TARGET));
    expect(pagedWindowCount(7.4, 7)).toBe(1);
    expect(pagedWindowCount(undefined, 365)).toBe(1);
    expect(pagedWindowCount(0, 365)).toBe(1);
    expect(PAGED_WINDOW_TARGET).toBeLessThan(FETCH_PLAN_LIMITS.autoBulkThreshold);
  });

  it('fits as many ids in a paged scoped batch as one page holds; a full batch without a hint', () => {
    // 6.5 vitals an encounter → 153 ids a batch; one encounter an appointment → 1,000.
    expect(scopedPagedBatchSize(6.5)).toBe(153);
    expect(scopedPagedBatchSize(1)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(0.9)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(5000)).toBe(1);
    expect(scopedPagedBatchSize(undefined)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(0)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
  });

  it("fits as many ids in a scoped batch as the target allows, within bounds; today's size without a hint", () => {
    expect(scopedBulkBatchSize(300)).toBe(66);
    expect(scopedBulkBatchSize(6.5)).toBe(FETCH_PLAN_LIMITS.scopedBulkBatchMax);
    expect(scopedBulkBatchSize(50_000)).toBe(1);
    expect(scopedBulkBatchSize(undefined)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedBulkBatchSize(0)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
  });
});
