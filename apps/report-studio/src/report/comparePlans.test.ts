import type { FhirResource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { comparePlanRuns } from './comparePlans';

const run = (resources: Record<string, FhirResource[]>, totalMs: number) => ({
  resources,
  totalMs,
  totalBytes: 10,
  stats: Object.entries(resources).map(([id, list]) => ({
    id,
    resourceType: list[0]?.resourceType ?? 'Appointment',
    ms: totalMs,
    count: list.length,
    byType: { [list[0]?.resourceType ?? 'Appointment']: list.length },
    bytes: 10,
    mode: 'normal' as const,
    requests: 1,
    params: [],
  })),
});

const obs = (id: string, value?: number): FhirResource => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: {},
  valueQuantity: value === undefined ? undefined : { value },
});

describe('comparePlanRuns', () => {
  it('is equivalent when both runs hold the same ids per type, however the steps are arranged', () => {
    const a = run({ vitals: [obs('o1', 1), obs('o2', 2)] }, 5000);
    const b = run({ first: [obs('o1', 1)], second: [obs('o2', 2)] }, 1200);
    const c = comparePlanRuns(a, b);
    expect(c.equivalent).toBe(true);
    expect(c.faster).toBe('b');
    expect(c.b.countsByType).toEqual({ Observation: 2 });
    expect(c.a.steps[0].ms).toBe(5000);
  });

  it('reports ids only one side has', () => {
    const c = comparePlanRuns(run({ v: [obs('o1'), obs('o2')] }, 1), run({ v: [obs('o1')] }, 1));
    expect(c.equivalent).toBe(false);
    expect(c.differences).toEqual(['1 Observation(s) only in A']);
    expect(c.faster).toBe('same');
  });

  it('compares the fields the code reads when asked (a trimmed variant)', () => {
    const a = run({ v: [obs('o1', 1)] }, 1);
    const b = run({ v: [obs('o1')] }, 1);
    expect(comparePlanRuns(a, b).equivalent).toBe(true);
    const checked = comparePlanRuns(a, b, { Observation: ['valueQuantity', 'status'] });
    expect(checked.equivalent).toBe(false);
    expect(checked.differences).toEqual(['Observation.valueQuantity differs on 1 resource(s) the code reads']);
  });
});
