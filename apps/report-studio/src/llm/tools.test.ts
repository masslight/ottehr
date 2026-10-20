import type { Observation } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudio } from '../state/store';
import { executeTool, withoutRecordContents } from './tools';

// The runner pulls in the sandbox (a Vite virtual module); none of it runs here.
vi.mock('../report/runner', () => ({ runReport: vi.fn(), fetchOnly: vi.fn(), validatePlan: vi.fn() }));

const production = { name: 'prod', zambdaBaseUrl: 'http://localhost:3009/local', accessToken: 't', production: true };

const observations: Observation[] = [
  { resourceType: 'Observation', id: '1', status: 'final', code: { text: 'Heart rate' } },
  { resourceType: 'Observation', id: '2', status: 'amended', code: { text: 'Heart rate' } },
  { resourceType: 'Observation', id: '3', status: 'final', code: {} },
];

describe('withoutRecordContents', () => {
  it('run_report keeps steps, errors, field usage and warnings but not the rendered text', () => {
    const summary = {
      ok: true,
      fetch: { totalMs: 10, totalBytes: 5, steps: [{ id: 'a', count: 3, ms: 10, error: undefined }] },
      render: { ok: true, ms: 4, text: 'Heart rate 72 bpm for Jane' },
      fieldUsage: { Observation: { fetched: 3, fieldsRead: ['status'], mostlyBlank: { note: 0.9 } } },
      warnings: ['step "a" returned 3'],
    };
    const out = withoutRecordContents('run_report', summary) as typeof summary & { production: string };
    expect(out.render.text).toBeUndefined();
    expect(out.render.ok).toBe(true);
    expect(out.fetch).toEqual(summary.fetch);
    expect(out.fieldUsage).toEqual(summary.fieldUsage);
    expect(out.warnings).toEqual(summary.warnings);
    expect(out.production).toMatch(/withheld/);
  });

  it('run_fetch drops samples and the values of summaries, keeping their counts', () => {
    const out = withoutRecordContents('run_fetch', {
      totalMs: 1,
      steps: [{ id: 'a', count: 2 }],
      samples: { 'a:Observation': [{ resourceType: 'Observation', id: '1' }] },
      summaries: { 'a.status': { distinct: 2, blank: 1, top: [{ value: 'final', count: 2 }] } },
    }) as Record<string, unknown>;
    expect(out.samples).toBeUndefined();
    expect(out.summaries).toEqual({ 'a.status': { distinct: 2, blank: 1 } });
    expect(out.steps).toEqual([{ id: 'a', count: 2 }]);
  });

  it('inspect_data keeps totals and presence counts only', () => {
    const out = withoutRecordContents('inspect_data', {
      step: 'a',
      total: 3,
      byType: [['Observation', 3]],
      values: { distinct: 2, blank: 1, top: [{ value: 'final', count: 2 }] },
      sample: [{ resourceType: 'Observation', id: '1' }],
    }) as Record<string, unknown>;
    expect(out.values).toEqual({ distinct: 2, blank: 1 });
    expect(out.sample).toBeUndefined();
    expect(out.total).toBe(3);
  });

  it('compare_plans results carry only counts and timings already, so they pass through with the note', () => {
    const comparison = { equivalent: false, differences: ['2 Observation(s) only in A'], a: { totalMs: 3 } };
    expect(withoutRecordContents('compare_plans', comparison)).toEqual({
      ...comparison,
      production: expect.stringMatching(/withheld/),
    });
  });
});

describe('executeTool on a production environment', () => {
  beforeEach(() => {
    useStudio.setState({
      run: { status: 'done', resources: { obs: observations } },
      environment: undefined,
    });
  });

  it('inspect_data returns values and samples on a non-production environment', async () => {
    const out = JSON.parse(await executeTool('inspect_data', { step: 'obs', path: 'status', sample: 1 }));
    expect(out.values.top).toEqual([
      { value: 'final', count: 2 },
      { value: 'amended', count: 1 },
    ]);
    expect(out.sample).toHaveLength(1);
    expect(out.production).toBeUndefined();
  });

  it('inspect_data returns no values or samples once a production environment is selected', async () => {
    useStudio.setState({ environment: production });
    const text = await executeTool('inspect_data', { step: 'obs', path: 'status', sample: 1 });
    const out = JSON.parse(text);
    expect(out).toMatchObject({ step: 'obs', total: 3, values: { distinct: 2, blank: 0 } });
    expect(out.values.top).toBeUndefined();
    expect(out.sample).toBeUndefined();
    expect(text).not.toContain('final');
    expect(text).not.toContain('Heart rate');
  });
});
