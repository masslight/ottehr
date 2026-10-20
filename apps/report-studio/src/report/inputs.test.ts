import { describe, expect, it } from 'vitest';
import {
  convertLegacyReport,
  ensureTestCase,
  resolveInputs,
  runParameters,
  toDateRangeSpec,
  toDateRangeValue,
  validateInputs,
} from './inputs';
import { emptyReport, StudioReport } from './types';

// A file saved before inputs existed declares none.
const legacyBase = (): Omit<StudioReport, 'inputs'> => {
  const { inputs: _inputs, ...rest } = emptyReport();
  return rest;
};

const plan = (values: string[]): StudioReport['plan'] => ({
  version: 1,
  steps: [{ id: 'a', resourceType: 'Appointment', params: values.map((value) => ({ name: 'x', value })) }],
});

describe('convertLegacyReport', () => {
  it('turns the date range and patient parameter into inputs and a Default test case', () => {
    const legacy: StudioReport = {
      ...legacyBase(),
      dateRange: { preset: 'last90days' },
      parameters: { patientId: 'p1' },
      plan: plan(['ge{{start}}', 'Patient/{{patientId}}']),
      code: 'return ReportRoot;',
    };
    const converted = convertLegacyReport(legacy);
    expect(converted.inputs).toEqual([
      {
        name: 'range',
        kind: 'dateRange',
        required: true,
        description: 'The date range the report covers',
        default: { preset: 'last-90-days' },
      },
      { name: 'patientId', kind: 'id', required: true, description: 'The patient this report runs for' },
    ]);
    expect(converted.testCases).toEqual([{ name: 'Default', values: { patientId: 'p1' } }]);
    expect(converted).not.toHaveProperty('dateRange');
    expect(converted).not.toHaveProperty('parameters');
    expect(converted.plan).toBe(legacy.plan);
    expect(converted.code).toBe(legacy.code);
  });

  it('adds no range input when the plan has no date templates; without a patient value the test case is "Default"', () => {
    const converted = convertLegacyReport({
      ...legacyBase(),
      dateRange: { preset: 'last30days' },
      plan: plan(['Patient/{{patientId}}']),
    });
    expect(converted.inputs?.map((i) => i.name)).toEqual(['patientId']);
    expect(converted.testCases).toEqual([{ name: 'Default', values: {} }]);
  });

  it('leaves a report that already declares inputs alone', () => {
    const report = { ...emptyReport(), inputs: [], testCases: [{ name: 'T', values: {} }] };
    expect(convertLegacyReport(report)).toBe(report);
  });

  it('maps a custom range to customRange and back', () => {
    expect(toDateRangeValue({ preset: 'custom', start: '2026-01-01', end: '2026-01-31' })).toEqual({
      preset: 'customRange',
      start: '2026-01-01',
      end: '2026-01-31',
    });
    expect(toDateRangeSpec({ preset: 'custom', start: '2026-01-05' })).toEqual({
      preset: 'custom',
      start: '2026-01-05',
      end: '2026-01-05',
    });
    expect(toDateRangeSpec({ preset: 'last-7-days' })).toEqual({ preset: 'last7days' });
  });
});

describe('ensureTestCase', () => {
  const input = { name: 'patientId', kind: 'id' as const, required: true };

  it('adds a "Default" case with no values to a report with inputs and none', () => {
    expect(ensureTestCase({ inputs: [input] }).testCases).toEqual([{ name: 'Default', values: {} }]);
    expect(ensureTestCase({ inputs: [input], testCases: [] }).testCases).toEqual([{ name: 'Default', values: {} }]);
  });

  it('leaves existing cases, and a report without inputs, alone', () => {
    const cases = [{ name: 'Teen', values: { patientId: 't' } }];
    expect(ensureTestCase({ inputs: [input], testCases: cases }).testCases).toBe(cases);
    expect(ensureTestCase({ inputs: [] }).testCases).toBeUndefined();
    expect(ensureTestCase({}).testCases).toBeUndefined();
  });
});

describe('validateInputs', () => {
  const range = { name: 'range', kind: 'dateRange', required: true, default: { preset: 'last-30-days' } };

  it('accepts well-formed inputs', () => {
    const result = validateInputs([range, { name: 'patientId', kind: 'id', required: true }]);
    expect(result.ok).toBe(true);
  });

  it('rejects bad names, unknown kinds, two date ranges, a date range without a default, and a default of the wrong kind', () => {
    const errorsOf = (inputs: unknown): string[] => {
      const r = validateInputs(inputs);
      return r.ok ? [] : r.errors;
    };
    expect(errorsOf([{ name: '2bad', kind: 'id', required: true }])[0]).toMatch(/identifier/);
    expect(errorsOf([{ name: 'x', kind: 'money', required: true }])[0]).toMatch(/inputs\.0\.kind/);
    expect(errorsOf([range, { ...range, name: 'range2' }])[0]).toMatch(/at most one dateRange/);
    expect(errorsOf([{ name: 'range', kind: 'dateRange', required: true }])[0]).toMatch(/needs a default/);
    expect(errorsOf([{ name: 'n', kind: 'number', required: false, default: 'five' }])[0]).toMatch(/not a number/);
    expect(errorsOf([range, range])[0]).toMatch(/duplicate/);
  });
});

describe('resolveInputs and runParameters', () => {
  const report = {
    inputs: [
      { name: 'range', kind: 'dateRange' as const, required: true, default: { preset: 'last-7-days' as const } },
      { name: 'patientId', kind: 'id' as const, required: true },
      { name: 'thresholds', kind: 'object' as const, required: false, default: { tempF: 100.4 } },
    ],
    testCases: [
      { name: 'Teen', values: { patientId: 'teen' } },
      { name: 'Empty', values: {} },
    ],
  };

  it('is missing a required input with no value, which disables Run', () => {
    expect(resolveInputs(report, 'Empty').missing).toEqual(['patientId']);
    expect(resolveInputs(report, undefined).missing).toEqual(['patientId']);
    expect(resolveInputs(report, 'Teen').missing).toEqual([]);
  });

  it('overlays the test case on the defaults and hands the values to params.inputs, the plan and the patient', () => {
    const { values } = resolveInputs(report, 'Teen');
    expect(values).toEqual({ range: { preset: 'last-7-days' }, patientId: 'teen', thresholds: { tempF: 100.4 } });
    const params = runParameters(report, values);
    expect(params.inputs).toBe(values);
    expect(params.patientId).toBe('teen');
    const days = (Date.parse(params.dateRange.end) - Date.parse(params.dateRange.start)) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it('falls back to the last 30 days when the report has no dateRange input', () => {
    const params = runParameters({ inputs: [] }, {});
    const days = (Date.parse(params.dateRange.end) - Date.parse(params.dateRange.start)) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(params.patientId).toBeUndefined();
  });
});
