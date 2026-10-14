import type { FetchPlanInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import type { RunState } from '../state/store';
import { applyElements, suggestElements } from './trim';

const plan: FetchPlanInput = {
  version: 1,
  steps: [
    { id: 'vitals', resourceType: 'Observation', params: [] },
    { id: 'visits', resourceType: 'Appointment', params: [] },
  ],
};

const run = {
  status: 'done',
  fetch: {
    totalMs: 1,
    totalBytes: 1,
    stats: [
      {
        id: 'vitals',
        resourceType: 'Observation',
        ms: 1,
        count: 3,
        byType: { Observation: 3 },
        bytes: 1,
        mode: 'normal',
        requests: 1,
        params: [],
      },
      {
        id: 'visits',
        resourceType: 'Appointment',
        ms: 1,
        count: 2,
        byType: { Appointment: 1, Encounter: 1 },
        bytes: 1,
        mode: 'normal',
        requests: 1,
        params: [],
      },
    ],
  },
  render: {
    ok: true,
    ms: 1,
    profile: {
      byType: {},
      byStep: {
        vitals: { Observation: ['valueQuantity', 'effectiveDateTime', 'encounter', 'resourceType'] },
        visits: { Appointment: ['status'] },
      },
      blankThreshold: 0.8,
    },
  },
} as unknown as RunState;

describe('suggestElements', () => {
  it('uses FHIR base names for choice-type fields and skips mixed-type steps', () => {
    expect(suggestElements(plan, run)).toEqual({ vitals: ['effective', 'encounter', 'id', 'meta', 'value'] });
  });

  it('applies the suggestion to the plan', () => {
    const trimmed = applyElements(plan, suggestElements(plan, run));
    expect(trimmed.steps[0].elements).toEqual(['effective', 'encounter', 'id', 'meta', 'value']);
    expect(trimmed.steps[1].elements).toBeUndefined();
  });
});
