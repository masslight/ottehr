import Oystehr from '@oystehr/sdk';
import {
  EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL,
  EASY_CHART_PRECOMPUTED_PLAN_VERSION,
  EasyChartPlannerOutput,
  EasyChartPrecomputedPlan,
} from 'utils';
import { describe, expect, it } from 'vitest';
import { buildPrecomputedPlanExtension, precomputeEasyChartPlan } from '../src/shared/easy-chart/precompute';

describe('easy-chart precomputed-plan cache', () => {
  it('round-trips the cache payload through the extension (v/chartState/steps/usage)', () => {
    const plan: EasyChartPlannerOutput = {
      steps: [
        { kind: 'add-diagnosis', display: 'Acute otitis media, right ear', code: 'H66.001', isPrimary: true },
        { kind: 'set-em-code', code: '99213', display: 'Office visit, established, level 3' },
      ] as EasyChartPlannerOutput['steps'],
      usage: { provider: 'gemini', model: 'gemini-3.1-flash-lite', inputTokens: 1234, outputTokens: 567 },
    };
    const chartState = 'Diagnoses: H66.001 — Acute otitis media, right ear (primary)';

    const extension = buildPrecomputedPlanExtension(chartState, plan);

    expect(extension.url).toBe(EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL);
    expect(extension.url).toBe('https://extensions.fhir.zapehr.com/easy-chart-precomputed-plan');
    const parsed = JSON.parse(extension.valueString!) as EasyChartPrecomputedPlan;
    expect(parsed.v).toBe(EASY_CHART_PRECOMPUTED_PLAN_VERSION);
    expect(parsed.chartState).toBe(chartState);
    expect(parsed.steps).toEqual(plan.steps);
    expect(parsed.usage).toEqual(plan.usage);
  });

  it('omits usage from the payload when the planner produced none', () => {
    const extension = buildPrecomputedPlanExtension('', { steps: [] });
    const parsed = JSON.parse(extension.valueString!) as EasyChartPrecomputedPlan;
    expect(parsed.v).toBe(EASY_CHART_PRECOMPUTED_PLAN_VERSION);
    expect(parsed.chartState).toBe('');
    expect(parsed.steps).toEqual([]);
    expect('usage' in parsed).toBe(false);
  });

  it('resolves undefined (never rejects) when the chart fetch fails', async () => {
    // getChartData's first FHIR call rejects → the whole precompute must swallow it, so the
    // ambient-scribe pipeline that Promise.all's this alongside field extraction is unaffected.
    const failingOystehr = {
      fhir: {
        search: () => Promise.reject(new Error('boom: FHIR unavailable')),
        batch: () => Promise.reject(new Error('boom: FHIR unavailable')),
      },
    } as unknown as Oystehr;

    await expect(
      precomputeEasyChartPlan(failingOystehr, 'fake-token', 'enc-123', 'a transcript', null)
    ).resolves.toBeUndefined();
  });
});
