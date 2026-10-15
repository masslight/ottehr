import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource } from 'fhir/r4b';
import { FETCH_PLAN_LIMITS, FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// How the plan runner chooses between paged searches and bulk jobs. A plain `auto` step with no density hint reads
// one page and finishes in bulk when a next link shows there is more; with a hint it goes bulk from the start when
// the hint expects more than autoBulkThreshold, else it pages windows. A scoped step pages its id batches in `auto`
// however long the list, and runs bulk jobs only in mode "bulk". The fake answers paged searches with real pages
// (`_count` / `_offset`, a next link) and bulk jobs through the stubbed ndjson download.
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

const encountersOf = (visits: Appointment[]): Encounter[] =>
  visits.map((visit, i) => ({
    resourceType: 'Encounter',
    id: `enc-${i}`,
    status: 'finished',
    class: {},
    appointment: [{ reference: `Appointment/${visit.id}` }],
  }));

let data: FhirResource[] = [];
const jobs = new Map<string, { resourceType: string; params: Params }>();
const bulkCalls: Params[] = [];
const pagedCalls: Params[] = [];

const matches = (resourceType: string, params: Params): FhirResource[] => {
  const ge = params.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value.slice(2);
  const le = params.find((p) => p.name === 'date' && p.value.startsWith('le'))?.value.slice(2);
  const appointmentIds = params.find((p) => p.name === 'appointment')?.value.split(',');
  return data.filter((r) => {
    if (r.resourceType !== resourceType) return false;
    if (r.resourceType === 'Appointment' && ge && le) {
      const start = Date.parse(r.start!);
      return start >= Date.parse(ge) && start <= Date.parse(le);
    }
    if (r.resourceType === 'Encounter' && appointmentIds) return appointmentIds.includes(r.appointment![0].reference!);
    return true;
  });
};

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const job = jobs.get(String(input).replace('https://example.test/', ''));
  if (!job) return { ok: false, status: 404, text: async () => 'not found' };
  const count = Number(job.params.find((p) => p.name === '_count')?.value);
  return {
    ok: true,
    status: 200,
    text: async () =>
      matches(job.resourceType, job.params)
        .slice(0, count)
        .map((r) => JSON.stringify(r))
        .join('\n'),
  };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

const fakeOystehr = {
  fhir: {
    search: async (
      { resourceType, params = [] }: { resourceType: string; params?: Params },
      request?: { mode?: string }
    ) => {
      if (request?.mode === 'async-bulk') {
        const jobId = `job-${jobs.size}`;
        jobs.set(jobId, { resourceType, params });
        bulkCalls.push(params);
        return { jobId, contentLocation: '', mode: 'bulk' };
      }
      pagedCalls.push(params);
      const count = Number(params.find((p) => p.name === '_count')?.value ?? FETCH_PLAN_LIMITS.pageSize);
      const offset = Number(params.find((p) => p.name === '_offset')?.value ?? 0);
      const matched = matches(resourceType, params);
      return {
        unbundle: () => matched.slice(offset, offset + count),
        link: offset + count < matched.length ? [{ relation: 'next', url: 'next' }] : [],
      };
    },
    waitForAsyncJob: async (jobId: string) => ({
      status: 200,
      mode: 'bulk',
      manifest: { requiresAccessToken: true, output: [{ type: 'mixed', url: `https://example.test/${jobId}` }] },
    }),
  },
} as unknown as Oystehr;

const dated = [
  { name: 'date', value: 'ge{{start}}' },
  { name: 'date', value: 'le{{end}}' },
];
const visitsPlan = (mode: 'auto' | 'normal' | 'bulk'): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({ version: 1, steps: [{ id: 'visits', resourceType: 'Appointment', mode, params: dated }] });

// The visits step is bulk so the fixture's id list arrives in one job; the scoped step under test varies.
const scopedPlan = (mode: 'auto' | 'bulk'): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({
    version: 1,
    steps: [
      { id: 'visits', resourceType: 'Appointment', mode: 'bulk', params: dated },
      {
        id: 'encounters',
        resourceType: 'Encounter',
        mode,
        from: { step: 'visits', path: 'id', param: 'appointment', keepType: 'Appointment' },
        params: [],
      },
    ],
  });

const countParam = (params: Params): string | undefined => params.find((p) => p.name === '_count')?.value;
const batchSizes = (calls: Params[]): number[] =>
  calls
    .map((params) => params.find((p) => p.name === 'appointment')?.value.split(',').length)
    .filter((n): n is number => n !== undefined);

describe('a plain auto step without a hint reads one page before going bulk', () => {
  beforeEach(() => {
    jobs.clear();
    bulkCalls.length = 0;
    pagedCalls.length = 0;
  });

  it('finishes in bulk when the first page has a next link, and returns every resource once', async () => {
    data = appointments(10, 250);
    const { resources, stats } = await runFetchPlan(fakeOystehr, visitsPlan('auto'), tenDays, undefined);
    expect(pagedCalls).toHaveLength(1);
    expect(countParam(pagedCalls[0])).toBe(String(FETCH_PLAN_LIMITS.pageSize));
    expect(bulkCalls).toHaveLength(1);
    expect(resources.visits).toHaveLength(2500);
    expect(new Set(resources.visits.map((r) => r.id)).size).toBe(2500);
    expect(stats[0]).toMatchObject({ mode: 'bulk', requests: 2, count: 2500 });
  });

  it('stays paged when everything fits in that page', async () => {
    data = appointments(10, 50);
    const { stats } = await runFetchPlan(fakeOystehr, visitsPlan('auto'), tenDays, undefined);
    expect(pagedCalls).toHaveLength(1);
    expect(bulkCalls).toHaveLength(0);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 1, count: 500 });
  });

  it('pages to the step maximum in mode normal', async () => {
    data = appointments(10, 250);
    const { stats } = await runFetchPlan(fakeOystehr, visitsPlan('normal'), tenDays, undefined);
    expect(pagedCalls).toHaveLength(3);
    expect(bulkCalls).toHaveLength(0);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 3, count: 2500 });
  });
});

describe('a plain auto step with a hint is sized before it runs', () => {
  beforeEach(() => {
    jobs.clear();
    bulkCalls.length = 0;
    pagedCalls.length = 0;
    data = appointments(10, 250);
  });

  it('goes bulk from the start when the hint expects more than the threshold — a probe and one job, no pages', async () => {
    // 600 a day over ten days = 6,000 expected, past autoBulkThreshold (5,000).
    const { stats } = await runFetchPlan(fakeOystehr, visitsPlan('auto'), tenDays, undefined, {
      visits: { recordsPerDay: 600 },
    });
    expect(pagedCalls.map(countParam)).toEqual(['1']);
    expect(bulkCalls).toHaveLength(1);
    expect(stats[0]).toMatchObject({ mode: 'bulk', requests: 2, count: 2500 });
  });

  it('pages its windows when the hint expects less, and never goes bulk', async () => {
    // 250 a day over ten days = 2,500 expected: one window of three pages.
    const { stats } = await runFetchPlan(fakeOystehr, visitsPlan('auto'), tenDays, undefined, {
      visits: { recordsPerDay: 250 },
    });
    expect(pagedCalls).toHaveLength(3);
    expect(bulkCalls).toHaveLength(0);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 3, count: 2500 });
  });
});

describe('a scoped step pages its id list however long it is', () => {
  beforeEach(() => {
    jobs.clear();
    bulkCalls.length = 0;
    pagedCalls.length = 0;
  });

  it('runs 6,000 ids as paged batches of the plain size in auto, not as bulk jobs', async () => {
    const visits = appointments(10, 600);
    data = [...visits, ...encountersOf(visits)];
    const { resources, stats } = await runFetchPlan(fakeOystehr, scopedPlan('auto'), tenDays, undefined);
    // The visits step: one bulk job (and its probe). The encounters step: 24 paged batches, no job.
    expect(bulkCalls).toHaveLength(1);
    expect(batchSizes(pagedCalls)).toEqual(Array(24).fill(FETCH_PLAN_LIMITS.scopedBatchSize));
    expect(resources.encounters).toHaveLength(6000);
    expect(stats[1]).toMatchObject({ mode: 'normal', requests: 24, count: 6000, scopedValues: 6000 });
  });

  it('runs bulk jobs of the plain batch size only in mode bulk', async () => {
    const visits = appointments(10, 100);
    data = [...visits, ...encountersOf(visits)];
    const { resources, stats } = await runFetchPlan(fakeOystehr, scopedPlan('bulk'), tenDays, undefined);
    expect(batchSizes(bulkCalls)).toEqual(Array(4).fill(FETCH_PLAN_LIMITS.scopedBatchSize));
    expect(batchSizes(pagedCalls)).toEqual([FETCH_PLAN_LIMITS.scopedBatchSize]); // the probe
    expect(resources.encounters).toHaveLength(1000);
    expect(stats[1]).toMatchObject({ mode: 'bulk', requests: 5, count: 1000, scopedValues: 1000 });
  });
});
