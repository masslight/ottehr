import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';
import { FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// The plan runner's bulk jobs: pre-sized from a density hint (one job without it), and halved when a job fills
// the async-bulk cap. The fake honours whatever `_count` a job sends, so a plan step can cap it at 5.
type Params = { name: string; value: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_START = Date.parse('2026-05-01T00:00:00.000Z');
const tenDays = {
  start: new Date(RANGE_START).toISOString(),
  end: new Date(RANGE_START + 10 * DAY_MS - 1).toISOString(),
};

const appointments = (days: number, perDay: number): Appointment[] =>
  Array.from({ length: days * perDay }, (_, i) => ({
    resourceType: 'Appointment',
    id: `appt-${i}`,
    status: 'fulfilled',
    participant: [],
    start: new Date(RANGE_START + Math.floor(i / perDay) * DAY_MS + DAY_MS / 2 + (i % perDay) * 60_000).toISOString(),
  }));

const encounters = (n: number): Encounter[] =>
  Array.from({ length: n }, (_, i) => ({ resourceType: 'Encounter', id: `enc-${i}`, status: 'finished', class: {} }));

let data: FhirResource[] = [];
const jobs = new Map<string, Params>();
const bulkCalls: Params[] = [];
const pagedCalls: Params[] = [];

const matches = (params: Params): FhirResource[] => {
  const count = Number(params.find((p) => p.name === '_count')?.value);
  const ge = params.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value.slice(2);
  const le = params.find((p) => p.name === 'date' && p.value.startsWith('le'))?.value.slice(2);
  const primary = data.filter((r) => {
    if (r.resourceType !== 'Appointment') return r.resourceType === 'Encounter';
    const start = Date.parse((r as Appointment).start!);
    return !ge || !le || (start >= Date.parse(ge) && start <= Date.parse(le));
  });
  return primary.slice(0, count);
};

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const params = jobs.get(String(input).replace('https://example.test/', ''));
  if (!params) return { ok: false, status: 404, text: async () => 'not found' };
  return {
    ok: true,
    status: 200,
    text: async () =>
      matches(params)
        .map((r) => JSON.stringify(r))
        .join('\n'),
  };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: Params }, request?: { mode?: string }) => {
      if (request?.mode !== 'async-bulk') {
        pagedCalls.push(params ?? []); // the probe / count / paged search
        return { unbundle: () => [], link: [] };
      }
      const jobId = `job-${jobs.size}`;
      jobs.set(jobId, params ?? []);
      bulkCalls.push(params ?? []);
      return { jobId, contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async (jobId: string) => ({
      status: 200,
      mode: 'bulk',
      manifest: { requiresAccessToken: true, output: [{ type: 'mixed', url: `https://example.test/${jobId}` }] },
    }),
  },
} as unknown as Oystehr;

const datedPlan = (extra: Params = []): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({
    version: 1,
    steps: [
      {
        id: 'visits',
        resourceType: 'Appointment',
        mode: 'bulk',
        params: [{ name: 'date', value: 'ge{{start}}' }, { name: 'date', value: 'le{{end}}' }, ...extra],
      },
    ],
  });

const scopedPlan = FetchPlanSchema.parse({
  version: 1,
  steps: [
    { id: 'encounters', resourceType: 'Encounter', mode: 'bulk', params: [{ name: 'status', value: 'finished' }] },
    {
      id: 'vitals',
      resourceType: 'Observation',
      mode: 'bulk',
      from: { step: 'encounters', path: 'id', param: 'encounter', keepType: 'Encounter' },
    },
  ],
});

const windowBounds = (params: Params): string =>
  params
    .filter((p) => p.name === 'date')
    .map((p) => p.value)
    .join(' ');
const batchSizes = (calls = bulkCalls): number[] =>
  calls
    .map((params) => params.find((p) => p.name === 'encounter')?.value.split(',').length)
    .filter((n): n is number => n !== undefined);

describe('the plan runner sizes bulk jobs from density hints', () => {
  beforeEach(() => {
    jobs.clear();
    bulkCalls.length = 0;
    pagedCalls.length = 0;
    data = [];
  });

  it('runs a date-bounded step as one job without a hint', async () => {
    const { stats } = await runFetchPlan(fakeOystehr, datedPlan(), tenDays, undefined);
    expect(bulkCalls).toHaveLength(1);
    expect(windowBounds(bulkCalls[0])).toBe(`ge${tenDays.start} le${tenDays.end}`);
    expect(stats[0]).toMatchObject({ mode: 'bulk', requests: 2 });
  });

  it('cuts the range into as many windows as the density calls for, tiling it', async () => {
    // 6,000 a day over ten days = 60,000, three jobs of 20,000.
    const { stats } = await runFetchPlan(fakeOystehr, datedPlan(), tenDays, undefined, {
      visits: { recordsPerDay: 6000 },
    });
    expect(bulkCalls).toHaveLength(3);
    const bounds = bulkCalls.map((params) =>
      params.filter((p) => p.name === 'date').map((p) => Date.parse(p.value.slice(2)))
    );
    expect(bounds[0][0]).toBe(Date.parse(tenDays.start));
    expect(bounds[2][1]).toBe(Date.parse(tenDays.end));
    // Each window starts a millisecond after the previous one ended.
    expect(bounds[1][0]).toBe(bounds[0][1] + 1);
    expect(bounds[2][0]).toBe(bounds[1][1] + 1);
    expect(stats[0]).toMatchObject({ mode: 'bulk', requests: 4 });
  });

  it('ignores a hint for another step', async () => {
    await runFetchPlan(fakeOystehr, datedPlan(), tenDays, undefined, { other: { recordsPerDay: 6000 } });
    expect(bulkCalls).toHaveLength(1);
  });

  it('halves a window whose job fills the cap and still returns every resource once', async () => {
    data = appointments(10, 2);
    const { resources, stats } = await runFetchPlan(
      fakeOystehr,
      datedPlan([{ name: '_count', value: '5' }]),
      tenDays,
      undefined
    );
    // 10 days / 20 (cap) → 5 days / 10 (cap) → 2.5 days / 4–5 (some cap) → 1.25 days / 2–3.
    expect(resources.visits).toHaveLength(20);
    expect(new Set(resources.visits.map((r) => r.id)).size).toBe(20);
    expect(bulkCalls.length).toBeGreaterThanOrEqual(1 + 2 + 4);
    expect(stats[0]).toMatchObject({ count: 20, requests: 1 + bulkCalls.length });
    expect(stats[0].error).toBeUndefined();
  });

  it('sizes scoped batches from records per id, within the batch maximum', async () => {
    data = encounters(450);
    await runFetchPlan(fakeOystehr, scopedPlan, undefined, undefined, { vitals: { recordsPerId: 100 } });
    // 20,000 / 100 = 200 ids a batch.
    expect(batchSizes()).toEqual([200, 200, 50]);

    jobs.clear();
    bulkCalls.length = 0;
    await runFetchPlan(fakeOystehr, scopedPlan, undefined, undefined);
    // Today's 100 without a hint.
    expect(batchSizes()).toEqual([100, 100, 100, 100, 50]);
  });

  it('sizes paged scoped batches to about a page from records per id, a full batch without a hint', async () => {
    data = encounters(2500);
    const pagedPlan = FetchPlanSchema.parse({
      ...scopedPlan,
      steps: [scopedPlan.steps[0], { ...scopedPlan.steps[1], mode: 'auto' }],
    });
    await runFetchPlan(fakeOystehr, pagedPlan, undefined, undefined, { vitals: { recordsPerId: 6.5 } });
    // 1,000 / 6.5 = 153 ids a batch.
    expect(batchSizes(pagedCalls)).toHaveLength(Math.ceil(2500 / 153));
    expect(batchSizes(pagedCalls)[0]).toBe(153);

    pagedCalls.length = 0;
    await runFetchPlan(fakeOystehr, pagedPlan, undefined, undefined);
    expect(batchSizes(pagedCalls)).toEqual([1000, 1000, 500]);
  });
});
