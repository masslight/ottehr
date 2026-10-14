import Oystehr from '@oystehr/sdk';
import { FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { beforeEach, describe, expect, it } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// A date-bounded step with no density hint (a report's first run) first asks how many resources it matches —
// one `_count=0&_total=accurate` request, includes left out — and sizes its windows or bulk jobs from the total.
type Params = { name: string; value: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_START = Date.parse('2026-05-01T00:00:00.000Z');
const tenDays = {
  start: new Date(RANGE_START).toISOString(),
  end: new Date(RANGE_START + 10 * DAY_MS - 1).toISOString(),
};

let total = 0;
const calls: { params: Params; mode?: string }[] = [];
const has = (params: Params, name: string, value?: string): boolean =>
  params.some((p) => p.name === name && (value === undefined || p.value === value));
const countCalls = (): Params[] => calls.filter((c) => has(c.params, '_count', '0')).map((c) => c.params);
const pageCalls = (): Params[] => calls.filter((c) => !c.mode && !has(c.params, '_count', '0')).map((c) => c.params);
const jobCalls = (): Params[] => calls.filter((c) => c.mode === 'async-bulk').map((c) => c.params);

const fakeOystehr = {
  fhir: {
    search: async ({ params = [] }: { resourceType: string; params?: Params }, request?: { mode?: string }) => {
      calls.push({ params, mode: request?.mode });
      if (request?.mode === 'async-bulk') return { jobId: `job-${calls.length}`, contentLocation: '', mode: 'bulk' };
      if (has(params, '_count', '0')) return { total, unbundle: () => [], link: [] };
      return { unbundle: () => [], link: [] };
    },
    waitForAsyncJob: async () => ({ status: 200, mode: 'bulk', manifest: { output: [] } }),
  },
} as unknown as Oystehr;

const step = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'visits',
  resourceType: 'Appointment',
  params: [
    { name: 'date', value: 'ge{{start}}' },
    { name: 'date', value: 'le{{end}}' },
    { name: '_tag', value: 'OTTEHR-IP,OTTEHR-TM' },
    { name: '_include', value: 'Appointment:patient' },
    { name: '_revinclude:iterate', value: 'Encounter:appointment' },
  ],
  elements: ['start', 'status'],
  ...extra,
});
const plan = (extra: Record<string, unknown> = {}): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({ version: 1, steps: [step(extra)] });

describe('a date-bounded step without a hint counts its matches first', () => {
  beforeEach(() => {
    calls.length = 0;
    total = 0;
  });

  it('asks for the total without rows or includes, then sizes the paged windows from it', async () => {
    total = 10_000;
    const { stats } = await runFetchPlan(fakeOystehr, plan(), tenDays, undefined);
    expect(countCalls()).toHaveLength(1);
    const [count] = countCalls();
    expect(count.map((p) => p.name).sort()).toEqual(['_count', '_tag', '_total', 'date', 'date']);
    expect(has(count, '_total', 'accurate')).toBe(true);
    expect(count.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value).toBe(`ge${tenDays.start}`);
    // 10,000 over ten days → four windows of 2,500, each one page here.
    expect(pageCalls()).toHaveLength(4);
    expect(pageCalls()[0].map((p) => p.name)).toContain('_include');
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 5 });
  });

  it('runs the whole range at once when the count is small', async () => {
    total = 300;
    const { stats } = await runFetchPlan(fakeOystehr, plan(), tenDays, undefined);
    expect(countCalls()).toHaveLength(1);
    expect(pageCalls()).toHaveLength(1);
    expect(stats[0]).toMatchObject({ requests: 2 });
  });

  it('does not count when a hint is saved, or when the step has no date range', async () => {
    total = 10_000;
    await runFetchPlan(fakeOystehr, plan(), tenDays, undefined, { visits: { recordsPerDay: 1000 } });
    expect(countCalls()).toHaveLength(0);
    expect(pageCalls()).toHaveLength(4);

    calls.length = 0;
    await runFetchPlan(fakeOystehr, plan({ params: [{ name: 'status', value: 'booked' }] }), tenDays, undefined);
    expect(countCalls()).toHaveLength(0);
    expect(pageCalls()).toHaveLength(1);
  });

  it('sizes the bulk jobs of a bulk step from the count', async () => {
    total = 50_000;
    const { stats } = await runFetchPlan(fakeOystehr, plan({ mode: 'bulk' }), tenDays, undefined);
    expect(countCalls()).toHaveLength(1);
    // 50,000 over ten days → three jobs of about 20,000; plus the probe and the count.
    expect(jobCalls()).toHaveLength(3);
    expect(stats[0]).toMatchObject({ mode: 'bulk', requests: 5 });
  });
});
