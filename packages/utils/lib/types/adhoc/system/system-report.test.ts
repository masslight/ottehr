import { describe, expect, it } from 'vitest';
import {
  checkSystemReportInputs,
  STUDIO_REPORT_FORMAT,
  systemReportFetchMode,
  systemReportFromStudioFile,
} from './system-report';

const rangeInput = { name: 'range', kind: 'dateRange' as const, required: false, default: { preset: 'last-30-days' } };

/** A Report Studio file as the studio saves it after a run: measurements, densities, a test patient. */
const studioFile = {
  format: STUDIO_REPORT_FORMAT,
  name: 'vitals-flowsheet',
  title: 'Vitals flowsheet',
  description: 'Per-patient vitals',
  prompt: 'Build a vitals flowsheet',
  dateRange: { preset: 'last30days' },
  parameters: { patientId: 'test-patient-id' },
  testCases: [{ name: 'Example patient', values: { patientId: 'real-patient-id' } }],
  plan: {
    version: 1,
    steps: [
      {
        id: 'vitals',
        resourceType: 'Observation',
        params: [{ name: 'patient', value: 'Patient/{{patientId}}' }],
      },
    ],
  },
  code: 'function ReportRoot() { return null; }\nreturn ReportRoot;',
  runtimeVersion: 1,
  updatedAt: '2026-10-15T00:00:00.000Z',
  fetchMode: 'direct',
  measuredFetchSeconds: 0.5,
  measuredRangeDays: 30,
  stepDensity: { vitals: { recordsPerId: 12 } },
};

describe('systemReportFromStudioFile', () => {
  it('keeps the report and the parameter names, and drops measurements, densities, prompt, test values and cases', () => {
    const result = systemReportFromStudioFile(studioFile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.definition).toEqual({
      name: 'vitals-flowsheet',
      title: 'Vitals flowsheet',
      description: 'Per-patient vitals',
      parameters: ['patientId'],
      plan: {
        version: 1,
        steps: [
          {
            id: 'vitals',
            resourceType: 'Observation',
            params: [{ name: 'patient', value: 'Patient/{{patientId}}' }],
            mode: 'auto',
          },
        ],
      },
      code: studioFile.code,
      runtimeVersion: 1,
    });
    for (const dropped of [
      'fetchMode',
      'measuredFetchSeconds',
      'measuredRangeDays',
      'stepDensity',
      'prompt',
      'format',
      'testCases',
      'dateRange',
    ]) {
      expect(result.definition).not.toHaveProperty(dropped);
    }
  });

  it('has no parameters for a practice-wide plan', () => {
    const plan = { version: 1, steps: [{ id: 'visits', resourceType: 'Appointment', params: [] }] };
    const result = systemReportFromStudioFile({ ...studioFile, plan, parameters: undefined });
    expect(result).toMatchObject({ ok: true, definition: { parameters: [] } });
  });

  it('rejects a file that is not a Report Studio report', () => {
    const result = systemReportFromStudioFile({ ...studioFile, format: 'something-else' });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.errors.join(' ')).toContain('format');
  });

  it('rejects a plan the plan schema rejects', () => {
    const plan = { version: 1, steps: [{ id: 'x', resourceType: 'NotInTheDataMap', params: [] }] };
    const result = systemReportFromStudioFile({ ...studioFile, plan });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.errors.join(' ')).toContain('plan.steps.0.resourceType');
  });

  it('rejects missing code or name', () => {
    expect(systemReportFromStudioFile({ ...studioFile, code: '' })).toMatchObject({ ok: false });
    expect(systemReportFromStudioFile({ ...studioFile, name: undefined })).toMatchObject({ ok: false });
  });

  it('keeps declared inputs and rejects malformed ones', () => {
    const inputs = [{ name: 'patientId', kind: 'id', required: true, description: 'The patient' }];
    const ok = systemReportFromStudioFile({ ...studioFile, inputs });
    expect(ok).toMatchObject({ ok: true, definition: { inputs } });
    expect(
      systemReportFromStudioFile({ ...studioFile, inputs: [{ name: 'x', kind: 'blob', required: true }] })
    ).toMatchObject({ ok: false });
    expect(systemReportFromStudioFile({ ...studioFile, inputs: [{ name: 'x', kind: 'id' }] })).toMatchObject({
      ok: false,
    });
  });

  it('allows a report with no plan', () => {
    const { plan: _plan, ...noPlan } = studioFile;
    const result = systemReportFromStudioFile(noPlan);
    expect(result).toMatchObject({ ok: true, definition: { parameters: [] } });
    expect(result.ok && result.definition).not.toHaveProperty('plan');
  });
});

describe('date range input', () => {
  const datedPlan = {
    version: 1,
    steps: [{ id: 'visits', resourceType: 'Appointment', params: [{ name: 'date', value: 'ge{{start}}' }] }],
  };

  it("converts the studio's date range into a `range` input when the plan uses the date templates", () => {
    const result = systemReportFromStudioFile({ ...studioFile, plan: datedPlan });
    expect(result).toMatchObject({ ok: true, definition: { inputs: [rangeInput] } });
    const custom = systemReportFromStudioFile({
      ...studioFile,
      plan: datedPlan,
      dateRange: { preset: 'custom', start: '2026-01-01', end: '2026-01-31' },
    });
    expect(custom).toMatchObject({
      ok: true,
      definition: { inputs: [{ ...rangeInput, default: { start: '2026-01-01', end: '2026-01-31' } }] },
    });
  });

  it('keeps a declared dateRange input over the studio range, and drops the range when the plan has no date templates', () => {
    const declared = { ...rangeInput, name: 'period', default: { preset: 'last-7-days' } };
    const result = systemReportFromStudioFile({ ...studioFile, plan: datedPlan, inputs: [declared] });
    expect(result).toMatchObject({ ok: true, definition: { inputs: [declared] } });
    expect(systemReportFromStudioFile(studioFile).ok && systemReportFromStudioFile(studioFile)).toMatchObject({
      definition: expect.not.objectContaining({ inputs: expect.anything() }),
    });
  });

  it('rejects a dateRange input without a default, two of them, and a templated plan without one', () => {
    const errorsOf = (file: unknown): string => {
      const result = systemReportFromStudioFile(file);
      return result.ok ? '' : result.errors.join(' | ');
    };
    expect(errorsOf({ ...studioFile, inputs: [{ name: 'range', kind: 'dateRange', required: false }] })).toContain(
      'inputs.0.default'
    );
    expect(errorsOf({ ...studioFile, inputs: [rangeInput, { ...rangeInput, name: 'other' }] })).toContain(
      'one dateRange input at most'
    );
    expect(errorsOf({ ...studioFile, plan: datedPlan, dateRange: undefined })).toContain('no dateRange input');
    expect(
      errorsOf({ ...studioFile, inputs: [{ name: 'n', kind: 'number', required: false, default: 'x' }] })
    ).toContain('default must be a number');
  });
});

describe('systemReportFetchMode', () => {
  const patientPlan = {
    steps: [
      { id: 'vitals', resourceType: 'Observation', params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] },
    ],
  };
  const datedPlan = {
    steps: [{ id: 'visits', resourceType: 'Appointment', params: [{ name: 'date', value: 'ge{{start}}' }] }],
  };
  const range = { start: '2026-09-01T04:00:00.000Z', end: '2026-10-01T03:59:59.999Z' };

  it('always runs a per-patient report without a date range directly, measured or not', () => {
    expect(systemReportFetchMode({ plan: patientPlan })).toBe('direct');
    expect(
      systemReportFetchMode({ plan: patientPlan, fetchMode: 'task', measuredFetchSeconds: 30, measuredRangeDays: 0 })
    ).toBe('direct');
  });

  it('otherwise follows the measurements', () => {
    expect(systemReportFetchMode({ plan: datedPlan, inputs: [rangeInput] }, range)).toBe('task');
    expect(
      systemReportFetchMode(
        { plan: datedPlan, inputs: [rangeInput], fetchMode: 'direct', measuredRangeDays: 30 },
        range
      )
    ).toBe('direct');
    expect(
      systemReportFetchMode(
        { plan: { ...patientPlan, steps: [...patientPlan.steps, ...datedPlan.steps] }, inputs: [rangeInput] },
        range
      )
    ).toBe('task');
    expect(systemReportFetchMode({})).toBe('task');
  });
});

describe('checkSystemReportInputs', () => {
  const declared = [
    { name: 'patientId', kind: 'id' as const, required: true },
    { name: 'count', kind: 'number' as const, required: false },
    { name: 'rows', kind: 'table' as const, required: false },
    { name: 'extra', kind: 'object' as const, required: false },
  ];

  it('passes when required inputs are present and kinds match', () => {
    expect(checkSystemReportInputs(declared, { patientId: 'p1', count: 3, rows: [], extra: {} })).toEqual([]);
    expect(checkSystemReportInputs(declared, { patientId: 'p1' })).toEqual([]);
    expect(checkSystemReportInputs(undefined, {})).toEqual([]);
  });

  it('names a missing required input and a wrong kind', () => {
    expect(checkSystemReportInputs(declared, {})).toEqual(['input "patientId" is required']);
    expect(checkSystemReportInputs(declared, { patientId: 7, count: 'x', rows: {}, extra: [] })).toEqual([
      'input "patientId" must be a id',
      'input "count" must be a number',
      'input "rows" must be a table',
      'input "extra" must be a object',
    ]);
  });
});
