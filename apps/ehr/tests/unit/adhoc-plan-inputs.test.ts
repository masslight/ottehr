import { FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import { controlsFromInputs, inputsForPlan } from '../../src/features/report-builder/query/plan-inputs';

// A saved plan report declares what it takes from the screen that runs it: the date range (with the picker's
// setting as its default) when the plan templates one, the patient when it is about one patient.

const controls = {
  dateRange: 'last-7-days' as const,
  customDate: '2026-10-01',
  customStartDate: '2026-09-01',
  customEndDate: '2026-09-30',
};

const datedPlan = FetchPlanSchema.parse({
  version: 1,
  steps: [
    {
      id: 'visits',
      resourceType: 'Appointment',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
      ],
    },
  ],
});

const patientPlan = FetchPlanSchema.parse({
  version: 1,
  steps: [{ id: 'vitals', resourceType: 'Observation', params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] }],
});

describe('inputsForPlan', () => {
  it('declares a dateRange input defaulting to the picker (a relative filter)', () => {
    expect(inputsForPlan(datedPlan, controls)).toEqual([
      { name: 'range', kind: 'dateRange', required: false, default: { preset: 'last-7-days' } },
    ]);
  });

  it('keeps custom days as start/end', () => {
    expect(inputsForPlan(datedPlan, { ...controls, dateRange: 'custom' })[0].default).toEqual({
      start: '2026-10-01',
      end: '2026-10-01',
    });
    expect(inputsForPlan(datedPlan, { ...controls, dateRange: 'customRange' })[0].default).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });

  it("declares the patient, and no date range, for one patient's report", () => {
    expect(inputsForPlan(patientPlan, controls)).toEqual([{ name: 'patientId', kind: 'id', required: true }]);
  });
});

describe('controlsFromInputs', () => {
  it('restores the picker from the dateRange input', () => {
    expect(controlsFromInputs(inputsForPlan(datedPlan, controls))).toEqual({ dateRange: 'last-7-days' });
    expect(controlsFromInputs(inputsForPlan(datedPlan, { ...controls, dateRange: 'custom' }))).toEqual({
      dateRange: 'custom',
      customDate: '2026-10-01',
    });
    expect(controlsFromInputs(inputsForPlan(datedPlan, { ...controls, dateRange: 'customRange' }))).toEqual({
      dateRange: 'customRange',
      customStartDate: '2026-09-01',
      customEndDate: '2026-09-30',
    });
  });

  it('gives nothing for a report without a date range, or a default the picker does not know', () => {
    expect(controlsFromInputs(inputsForPlan(patientPlan, controls))).toBeUndefined();
    expect(controlsFromInputs(undefined)).toBeUndefined();
    expect(
      controlsFromInputs([{ name: 'range', kind: 'dateRange', required: false, default: { preset: 'last-decade' } }])
    ).toBeUndefined();
  });
});
