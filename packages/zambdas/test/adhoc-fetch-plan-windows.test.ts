import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource, Patient } from 'fhir/r4b';
import { FETCH_PLAN_LIMITS, FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLimiter, runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// A paged date-bounded step runs its range in as many windows as the density hint calls for, side by side, under
// one limit on searches in flight for the whole run; the windows' results are deduped and match a single search.
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

// Rides along with every page, like an included Patient shared by appointments in different windows.
const sharedPatient: Patient = { resourceType: 'Patient', id: 'pat-shared' };

let data: FhirResource[] = [];
const calls: Params[] = [];
let inFlight = 0;
let maxInFlight = 0;
let delayMs = 0;

const fakeOystehr = {
  fhir: {
    search: async ({ params = [] }: { resourceType: string; params?: Params }) => {
      calls.push(params);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      inFlight -= 1;
      const ge = params.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value.slice(2);
      const le = params.find((p) => p.name === 'date' && p.value.startsWith('le'))?.value.slice(2);
      const count = Number(params.find((p) => p.name === '_count')?.value ?? 1000);
      const offset = Number(params.find((p) => p.name === '_offset')?.value ?? 0);
      const matched = data.filter((r) => {
        if (r.resourceType !== 'Appointment' || !ge || !le) return false;
        const start = Date.parse((r as Appointment).start!);
        return start >= Date.parse(ge) && start <= Date.parse(le);
      });
      if (count === 0) return { total: matched.length, unbundle: () => [], link: [] };
      const page = matched.slice(offset, offset + count);
      return {
        unbundle: () => [...page, sharedPatient],
        link: offset + count < matched.length ? [{ relation: 'next', url: 'next' }] : [],
      };
    },
  },
} as unknown as Oystehr;

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

const twoDatedSteps = FetchPlanSchema.parse({
  version: 1,
  steps: [datedPlan.steps[0], { ...datedPlan.steps[0], id: 'visits2' }],
});

const windowBounds = (params: Params): number[] =>
  params.filter((p) => p.name === 'date').map((p) => Date.parse(p.value.slice(2)));

describe('a paged date-bounded step runs in windows sized from the density hint', () => {
  beforeEach(() => {
    data = appointments(10, 4);
    calls.length = 0;
    inFlight = 0;
    maxInFlight = 0;
    delayMs = 0;
  });

  it('searches the whole range once without a hint (after counting it: 40 is one window)', async () => {
    const { resources, stats } = await runFetchPlan(fakeOystehr, datedPlan, tenDays, undefined);
    expect(calls).toHaveLength(2);
    expect(windowBounds(calls[1])).toEqual([Date.parse(tenDays.start), Date.parse(tenDays.end)]);
    expect(resources.visits).toHaveLength(41);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 2, byType: { Appointment: 40, Patient: 1 } });
  });

  it('cuts the range into tiled windows and returns the same resources, each once', async () => {
    // 1,000 a day over ten days = 10,000 → four windows of 2,500.
    const { resources, stats } = await runFetchPlan(fakeOystehr, datedPlan, tenDays, undefined, {
      visits: { recordsPerDay: 1000 },
    });
    expect(calls).toHaveLength(4);
    const bounds = calls.map(windowBounds).sort((a, b) => a[0] - b[0]);
    expect(bounds[0][0]).toBe(Date.parse(tenDays.start));
    expect(bounds[3][1]).toBe(Date.parse(tenDays.end));
    for (let i = 1; i < bounds.length; i++) expect(bounds[i][0]).toBe(bounds[i - 1][1] + 1);

    const single = await runFetchPlan(fakeOystehr, datedPlan, tenDays, undefined);
    expect(new Set(resources.visits.map((r) => r.id))).toEqual(new Set(single.resources.visits.map((r) => r.id)));
    expect(resources.visits.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 4, count: 41 });
  });

  it('keeps at most maxConcurrentRequests searches in flight across windows and steps', async () => {
    delayMs = 5;
    // Two steps of 20 windows each, all runnable at once.
    await runFetchPlan(fakeOystehr, twoDatedSteps, tenDays, undefined, {
      visits: { recordsPerDay: 5000 },
      visits2: { recordsPerDay: 5000 },
    });
    expect(calls).toHaveLength(40);
    expect(maxInFlight).toBe(FETCH_PLAN_LIMITS.maxConcurrentRequests);
  });
});

describe('createLimiter', () => {
  it('runs at most N at once, in order, and returns each result', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const order: number[] = [];
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        limit(async () => {
          active += 1;
          peak = Math.max(peak, active);
          order.push(n);
          await new Promise((resolve) => setTimeout(resolve, 2));
          active -= 1;
          return n * 10;
        })
      )
    );
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it('frees the slot when the function throws', async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limit(async () => 'next')).toBe('next');
  });
});
